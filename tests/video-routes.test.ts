import { beforeEach, it, expect, vi } from "vitest";
import fs from "node:fs";
import { AppError } from "@/lib/errors";
import { syntheticVideo } from "./fixtures/video";
const f = vi.hoisted(() => ({
  user: vi.fn(),
  available: vi.fn(),
  reserve: vi.fn(),
  submit: vi.fn(),
  get: vi.fn(),
  source: vi.fn(),
  signed: vi.fn(),
  verify: vi.fn(),
  token: vi.fn(),
  reconcile: vi.fn(),
  download: vi.fn(),
}));
vi.mock("@/lib/server/supabase", () => ({
  requireUser: f.user,
  admin: () => ({
    storage: {
      from: () => ({ createSignedUrl: f.signed, download: f.download }),
    },
  }),
}));
vi.mock("@/lib/server/jobs", () => ({
  getJob: f.source,
  BUCKET: "portraits",
  pathFor: () => "owner/source/portrait.png",
}));
vi.mock("@/lib/server/video-jobs", async (original) => ({
  ...(await original<typeof import("@/lib/server/video-jobs")>()),
  videoAvailable: f.available,
  reserveVideo: f.reserve,
  submitVideo: f.submit,
  getVideoJob: f.get,
  reconcileVideo: f.reconcile,
}));
vi.mock("@/lib/server/ai/fal-webhook", () => ({
  verifyFalWebhook: f.verify,
  validWebhookToken: f.token,
}));
import { POST } from "@/app/api/videos/route";
import { GET as media } from "@/app/api/videos/[id]/media/route";
import { GET as status } from "@/app/api/videos/[id]/route";
import { POST as callback } from "@/app/api/videos/webhook/route";
const id = "b827395f-a85b-48a4-83dd-106a7348a7f6";
const job = {
  id,
  user_id: "owner",
  preset: "cinematic",
  status: "succeeded",
  credits_charged: 60,
  created_at: new Date().toISOString(),
  expires_at: new Date(Date.now() + 86400000).toISOString(),
  error_code: null,
};
beforeEach(() => {
  Object.values(f).forEach((m) => m.mockReset());
  vi.stubEnv("APP_URL", "http://localhost:3001");
  f.user.mockResolvedValue({ id: "owner" });
  f.available.mockResolvedValue(true);
  f.reserve.mockResolvedValue({ fresh: true, job });
  f.submit.mockResolvedValue(job);
  f.get.mockResolvedValue(job);
  f.source.mockResolvedValue(job);
  f.download.mockResolvedValue({
    data: new Blob([fs.readFileSync("public/images/studio.webp")]),
    error: null,
  });
  f.signed.mockResolvedValue({
    data: { signedUrl: "https://private.supabase.test/signed" },
    error: null,
  });
  f.verify.mockResolvedValue(true);
  f.token.mockReturnValue(true);
  f.reconcile.mockResolvedValue(job);
});
function form() {
  const data = new FormData();
  data.set(
    "photo",
    new Blob([fs.readFileSync("public/images/studio.webp")], {
      type: "image/webp",
    }),
    "photo.webp",
  );
  data.set("requestId", id);
  data.set("preset", "cinematic");
  data.set("consent", "true");
  return data;
}
const send = (body: FormData, origin = "http://localhost:3001") =>
  POST(
    new Request("http://localhost:3001/api/videos", {
      method: "POST",
      headers: { origin },
      body,
    }),
  );
it("rejects unauthenticated, cross-origin and unconfigured requests before billing", async () => {
  expect((await send(form(), "https://evil.test")).status).toBe(403);
  f.user.mockRejectedValueOnce(new AppError("AUTH", "Sign in", 401));
  expect((await send(form())).status).toBe(401);
  f.available.mockResolvedValue(false);
  expect((await send(form())).status).toBe(503);
  expect(f.reserve).not.toHaveBeenCalled();
});
it("validates consent, presets, malformed photos and bounded uploads before reservation", async () => {
  const consent = form();
  consent.delete("consent");
  expect((await send(consent)).status).toBe(400);
  const preset = form();
  preset.set("preset", "attacker-model");
  expect((await send(preset)).status).toBe(400);
  const corrupt = form();
  corrupt.set(
    "photo",
    new Blob(["not a photo"], { type: "image/jpeg" }),
    "photo.jpg",
  );
  expect((await send(corrupt)).status).toBe(400);
  const large = form();
  large.set(
    "photo",
    new Blob([new Uint8Array(4_200_000)], { type: "image/jpeg" }),
    "photo.jpg",
  );
  expect((await send(large)).status).toBe(413);
  expect(f.reserve).not.toHaveBeenCalled();
});
it("accepts a validated reference only for motion and rejects overlong references without charge", async () => {
  const body = form();
  body.set("preset", "motion");
  body.set(
    "reference",
    new Blob([syntheticVideo(6)], { type: "video/mp4" }),
    "reference.mp4",
  );
  expect((await send(body)).status).toBe(400);
  expect(f.reserve).not.toHaveBeenCalled();
  body.set(
    "reference",
    new Blob([syntheticVideo()], { type: "video/mp4" }),
    "reference.mp4",
  );
  expect((await send(body)).status).toBe(202);
  expect(f.reserve).toHaveBeenCalledWith(
    expect.objectContaining({ preset: "motion" }),
  );
});
it("never trusts a client cost or endpoint and never dispatches a duplicate reservation", async () => {
  const body = form();
  body.set("credits", "0");
  body.set("endpoint", "attacker/model");
  expect((await send(body)).status).toBe(202);
  expect(f.reserve).toHaveBeenCalledWith({
    id,
    userId: "owner",
    fingerprint: expect.any(String),
    preset: "cinematic",
  });
  f.reserve.mockResolvedValue({ fresh: false, job });
  expect((await send(form())).status).toBe(202);
  expect(f.submit).toHaveBeenCalledTimes(1);
  f.reserve.mockRejectedValue(
    new AppError("CREDITS", "Insufficient credits", 402),
  );
  expect((await send(form())).status).toBe(402);
  expect(f.submit).toHaveBeenCalledTimes(1);
});
it("checks ownership and expiry when animating an existing private portrait", async () => {
  const body = form();
  body.delete("photo");
  body.set("sourceJobId", id);
  expect((await send(body)).status).toBe(202);
  expect(f.source).toHaveBeenCalledWith(id, "owner");
  f.source.mockResolvedValue({ ...job, expires_at: new Date(0).toISOString() });
  expect((await send(body)).status).toBe(410);
  expect(f.submit).toHaveBeenCalledTimes(1);
});
it("delivers owner-only short-lived links and blocks expired or unfinished videos", async () => {
  const read = () =>
    media(
      new Request(`http://localhost:3001/api/videos/${id}/media?download=1`),
      { params: Promise.resolve({ id }) },
    );
  const response = await read();
  expect(response.status).toBe(302);
  expect(response.headers.get("cache-control")).toBe("no-store, private");
  expect(f.get).toHaveBeenCalledWith(id, "owner");
  expect(f.signed).toHaveBeenCalledWith(`owner/${id}/video.mp4`, 60, {
    download: "editingapp-cinematic-video.mp4",
  });
  f.signed.mockClear();
  f.get.mockResolvedValue({ ...job, status: "processing" });
  expect((await read()).status).toBe(409);
  f.get.mockResolvedValue({ ...job, expires_at: new Date(0).toISOString() });
  expect((await read()).status).toBe(410);
  f.get.mockRejectedValue(new AppError("NOT_FOUND", "Not found", 404));
  expect((await read()).status).toBe(404);
  expect(f.signed).not.toHaveBeenCalled();
});
it("requires both callback signatures and retries delivery until output is saved", async () => {
  const call = () =>
    callback(
      new Request(
        `http://localhost:3001/api/videos/webhook?job=${id}&token=secret`,
        {
          method: "POST",
          headers: { "x-fal-webhook-request-id": "fal-request-12345" },
          body: JSON.stringify({
            request_id: "fal-request-12345",
            status: "OK",
            payload: { video: { url: "https://evil.test" } },
          }),
        },
      ),
    );
  f.token.mockReturnValueOnce(false);
  expect((await call()).status).toBe(403);
  f.verify.mockResolvedValueOnce(false);
  expect((await call()).status).toBe(403);
  expect(f.reconcile).not.toHaveBeenCalled();
  f.reconcile.mockResolvedValueOnce({ ...job, status: "queued" });
  expect((await call()).status).toBe(503);
  expect((await call()).status).toBe(200);
  expect(f.reconcile).toHaveBeenLastCalledWith(job, "fal-request-12345");
});
it("returns actionable status-check errors while preserving authorization responses", async () => {
  const read = () =>
    status(new Request(`http://localhost:3001/api/videos/${id}`), {
      params: Promise.resolve({ id }),
    });
  f.reconcile.mockRejectedValue(new Error("private database diagnostics"));
  const response = await read();
  expect(response.status).toBe(503);
  expect(await response.json()).toEqual({
    code: "VIDEO_CHECK_UNAVAILABLE",
    error:
      "We couldn’t check your video right now. Use Check video status on this same request; checking will not charge you again.",
  });
  f.user.mockRejectedValue(new AppError("AUTH", "Sign in", 401));
  expect((await read()).status).toBe(401);
});
