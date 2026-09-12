import { beforeEach, describe, expect, it, vi } from "vitest";
import sharp from "sharp";
import { AppError } from "@/lib/errors";
const fake = vi.hoisted(() => ({
  user: vi.fn(),
  reserve: vi.fn(),
  run: vi.fn(),
  get: vi.fn(),
  download: vi.fn(),
}));
vi.mock("@/lib/server/supabase", () => ({
  requireUser: fake.user,
  admin: () => ({ storage: { from: () => ({ download: fake.download }) } }),
}));
vi.mock("@/lib/server/jobs", async (original) => {
  const real = await original<typeof import("@/lib/server/jobs")>();
  return {
    ...real,
    reserveJob: fake.reserve,
    runJob: fake.run,
    getJob: fake.get,
  };
});
import { POST } from "@/app/api/portraits/route";
import { GET } from "@/app/api/portraits/[id]/image/route";
const id = "b827395f-a85b-48a4-83dd-106a7348a7f6";
const job = {
  id,
  user_id: "owner",
  preset: "studio",
  quality: "medium",
  status: "succeeded",
  created_at: new Date().toISOString(),
  expires_at: new Date(Date.now() + 86400000).toISOString(),
};
beforeEach(() => {
  vi.stubEnv("APP_URL", "http://localhost:3001");
  Object.values(fake).forEach((mock) => mock.mockReset());
  fake.user.mockResolvedValue({ id: "owner" });
  fake.get.mockResolvedValue(job);
  fake.reserve.mockResolvedValue({ fresh: true, job });
  fake.run.mockResolvedValue(job);
  fake.download.mockResolvedValue({
    data: new Blob(["private image"]),
    error: null,
  });
});
async function form(valid = true) {
  const data = new FormData();
  const bytes = valid
    ? await sharp({
        create: { width: 300, height: 300, channels: 3, background: "#ccc" },
      })
        .png()
        .toBuffer()
    : Buffer.from("bad image");
  data.set("photo", new Blob([bytes], { type: "image/png" }), "selfie.png");
  data.set("preset", "studio");
  data.set("quality", "medium");
  data.set("requestId", id);
  data.set("consent", "true");
  return data;
}
describe("HTTP route boundaries", () => {
  it("validates upload before reservation and generates only a fresh reservation", async () => {
    const invalid = await POST(
      new Request("http://localhost:3001/api/portraits", {
        method: "POST",
        headers: { origin: "http://localhost:3001" },
        body: await form(false),
      }),
    );
    expect(invalid.status).toBe(400);
    expect(fake.reserve).not.toHaveBeenCalled();
    const send = async () =>
      POST(
        new Request("http://localhost:3001/api/portraits", {
          method: "POST",
          headers: { origin: "http://localhost:3001" },
          body: await form(),
        }),
      );
    expect((await send()).status).toBe(200);
    expect(fake.run).toHaveBeenCalledTimes(1);
    fake.reserve.mockResolvedValue({ fresh: false, job });
    expect((await send()).status).toBe(200);
    expect(fake.run).toHaveBeenCalledTimes(1);
  });
  it("rejects cross-origin and unauthenticated requests before dispatch", async () => {
    const cross = await POST(
      new Request("http://localhost:3001/api/portraits", {
        method: "POST",
        headers: { origin: "https://evil.example" },
        body: await form(),
      }),
    );
    expect(cross.status).toBe(403);
    expect(fake.user).not.toHaveBeenCalled();
    fake.user.mockRejectedValue(new AppError("AUTH_REQUIRED", "Sign in", 401));
    const unauth = await POST(
      new Request("http://localhost:3001/api/portraits", {
        method: "POST",
        headers: { origin: "http://localhost:3001" },
        body: await form(),
      }),
    );
    expect(unauth.status).toBe(401);
    expect(fake.run).not.toHaveBeenCalled();
  });
  it("serves private downloads with no-store and passes authenticated ownership into lookup", async () => {
    const response = await GET(
      new Request(`http://localhost:3001/api/portraits/${id}/image?download=1`),
      { params: Promise.resolve({ id }) },
    );
    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toBe("no-store, private");
    expect(response.headers.get("content-disposition")).toContain("attachment");
    expect(fake.get).toHaveBeenCalledWith(id, "owner");
  });
  it("blocks expired photos, another user and incomplete results before storage access", async () => {
    const read = () =>
      GET(new Request(`http://localhost:3001/api/portraits/${id}/image`), {
        params: Promise.resolve({ id }),
      });
    fake.get.mockResolvedValue({
      ...job,
      expires_at: new Date(0).toISOString(),
    });
    expect((await read()).status).toBe(410);
    fake.get.mockRejectedValue(new AppError("NOT_FOUND", "Not found", 404));
    expect((await read()).status).toBe(404);
    fake.get.mockResolvedValue({ ...job, status: "processing" });
    expect((await read()).status).toBe(409);
    expect(fake.download).not.toHaveBeenCalled();
  });
});
