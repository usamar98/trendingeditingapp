import { beforeEach, afterEach, describe, it, expect, vi } from "vitest";
import { generateKeyPairSync, createHash, sign } from "node:crypto";
import { FEATURES } from "@/lib/server/ai/registry";
import { runFeature } from "@/lib/server/ai/features";
import {
  submitFal,
  readQueue,
  queueUrl,
  videoOutputUrl,
  downloadFalVideo,
  deleteFalPayload,
  boundedBytes,
} from "@/lib/server/ai/fal-queue";
import {
  webhookToken,
  validWebhookToken,
  verifyFalWebhook,
} from "@/lib/server/ai/fal-webhook";
import { inspectMp4, validateReferenceVideo } from "@/lib/server/video-mp4";
import { syntheticVideo } from "./fixtures/video";
const fetcher = vi.fn();
const requestId = "test-request-12345";
const cdn = "https://v3b.fal.media/files/b/koala/test-video.mp4";
beforeEach(() => {
  vi.stubEnv("FAL_KEY", "test-key");
  vi.stubGlobal("fetch", fetcher);
  fetcher.mockReset();
});
afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});
describe("reviewed video adapters and private delivery", () => {
  it("maps only the documented, bounded silent-video fields", () => {
    expect(
      FEATURES["photo-to-video"].buildInput({
        imageUrl: "https://private.test/photo",
        preset: "cinematic",
      }),
    ).toEqual({
      start_image_url: "https://private.test/photo",
      duration: "5",
      generate_audio: false,
      prompt: expect.any(String),
    });
    expect(
      FEATURES["photo-motion"].buildInput({
        imageUrl: "image",
        videoUrl: "video",
        preset: "motion",
      }),
    ).toEqual({
      image_url: "image",
      video_url: "video",
      character_orientation: "video",
      keep_original_sound: false,
      prompt: expect.any(String),
    });
  });
  it("submits exactly once, disables retries and requests private expiring files", async () => {
    fetcher.mockResolvedValue(Response.json({ request_id: requestId }));
    expect(
      await runFeature(
        "photo-to-video",
        { imageUrl: "https://private.test/photo", preset: "cinematic" },
        { webhookUrl: "https://app.test/callback?token=bound" },
      ),
    ).toEqual({ requestId });
    expect(fetcher).toHaveBeenCalledTimes(1);
    const [url, options] = fetcher.mock.calls[0];
    expect(url).toContain("/v3/standard/image-to-video?fal_webhook=https%3A");
    expect(options.headers["X-Fal-No-Retry"]).toBe("1");
    expect(
      JSON.parse(options.headers["X-Fal-Object-Lifecycle-Preference"]),
    ).toEqual({
      expiration_duration_seconds: 86400,
      initial_acl: { default: "forbid" },
    });
  });
  it.each([408, 500, 502])(
    "keeps HTTP %s uncertain without replay",
    async (status) => {
      fetcher.mockResolvedValue(new Response("failure", { status }));
      await expect(
        submitFal(FEATURES["photo-to-video"].endpoint, {}, "https://app.test"),
      ).rejects.toMatchObject({ uncertain: true });
      expect(fetcher).toHaveBeenCalledTimes(1);
    },
  );
  it.each([400, 401, 422, 429])(
    "treats HTTP %s submission rejection as definitive",
    async (status) => {
      fetcher.mockResolvedValue(new Response("failure", { status }));
      await expect(
        submitFal(FEATURES["photo-to-video"].endpoint, {}, "https://app.test"),
      ).rejects.toMatchObject({ uncertain: false });
      expect(fetcher).toHaveBeenCalledTimes(1);
    },
  );
  it("does not replay a disconnected or malformed successful submission", async () => {
    fetcher.mockRejectedValueOnce(new TypeError("disconnected"));
    await expect(
      submitFal(FEATURES["photo-to-video"].endpoint, {}, "https://app.test"),
    ).rejects.toMatchObject({ uncertain: true });
    fetcher.mockResolvedValueOnce(Response.json({ request_id: "../evil" }));
    await expect(
      runFeature(
        "photo-to-video",
        { imageUrl: "image", preset: "memory" },
        { webhookUrl: "https://app.test" },
      ),
    ).rejects.toMatchObject({ uncertain: true });
    expect(fetcher).toHaveBeenCalledTimes(2);
  });
  it("rejects arbitrary endpoints and escaping request IDs before network access", async () => {
    await expect(
      submitFal("https://evil.test", {}, "https://app.test"),
    ).rejects.toThrow();
    expect(() => queueUrl("../outside", "result")).toThrow();
    expect(fetcher).not.toHaveBeenCalled();
    expect(queueUrl(requestId, "status")).toBe(
      `https://queue.fal.run/fal-ai/kling-video/requests/${requestId}/status`,
    );
  });
  it("checks a queue using read-only authenticated GETs", async () => {
    fetcher.mockResolvedValue(Response.json({ status: "IN_PROGRESS" }));
    await readQueue(requestId, "status");
    expect(fetcher.mock.calls[0][1].method).toBeUndefined();
    expect(fetcher.mock.calls[0][1].headers.Authorization).toBe("Key test-key");
  });
  it.each([
    "https://evil.test/video.mp4",
    "http://v3b.fal.media/files/b/a/x.mp4",
    "https://v3b.fal.media.evil.test/files/b/a/x.mp4",
    "https://key@v3b.fal.media/files/b/a/x.mp4",
    cdn + "?redirect=evil",
    "https://v3.fal.media/files/a/x.mp4",
  ])("rejects unreviewed media URL %s", (url) =>
    expect(() => videoOutputUrl({ video: { url } })).toThrow(),
  );
  it("exchanges the fal key for a short-lived CDN token without exposing the key", async () => {
    fetcher
      .mockResolvedValueOnce(Response.json({ token: "short-lived-token" }))
      .mockResolvedValueOnce(new Response("mp4-bytes"));
    expect((await downloadFalVideo({ video: { url: cdn } })).toString()).toBe(
      "mp4-bytes",
    );
    expect(fetcher.mock.calls[0][0]).toBe(
      "https://rest.fal.ai/storage/auth/token?storage_type=fal-cdn-v3",
    );
    expect(fetcher.mock.calls[1]).toEqual([
      cdn,
      expect.objectContaining({
        headers: { Authorization: "Bearer short-lived-token" },
        redirect: "error",
      }),
    ]);
  });
  it("bounds chunked provider media and deletes payload only on confirmed cleanup", async () => {
    await expect(boundedBytes(new Response("123456"), 5)).rejects.toThrow();
    fetcher
      .mockResolvedValueOnce(
        Response.json({
          cdn_delete_results: [{ link: cdn, exception: "denied" }],
        }),
      )
      .mockResolvedValueOnce(
        Response.json({ cdn_delete_results: [{ link: cdn, exception: null }] }),
      );
    expect(await deleteFalPayload(requestId)).toBe(false);
    expect(await deleteFalPayload(requestId)).toBe(true);
    expect(fetcher.mock.calls[0][1].method).toBe("DELETE");
  });
});
describe("signed callbacks", () => {
  it("binds the callback secret to one job", () => {
    expect(validWebhookToken("job-a", webhookToken("job-a"))).toBe(true);
    expect(validWebhookToken("job-b", webhookToken("job-a"))).toBe(false);
    expect(validWebhookToken("job-a", "bad")).toBe(false);
  });
  it("verifies authentic Ed25519 signatures and rejects tampering, expiry and forged headers", async () => {
    const keys = generateKeyPairSync("ed25519"),
      body = Buffer.from(
        JSON.stringify({ request_id: requestId, status: "OK" }),
      ),
      time = String(Math.floor(Date.now() / 1000));
    const message = Buffer.from(
      [
        requestId,
        "fal-user",
        time,
        createHash("sha256").update(body).digest("hex"),
      ].join("\n"),
    );
    const headers = new Headers({
      "x-fal-webhook-request-id": requestId,
      "x-fal-webhook-user-id": "fal-user",
      "x-fal-webhook-timestamp": time,
      "x-fal-webhook-signature": sign(null, message, keys.privateKey).toString(
        "hex",
      ),
    });
    fetcher.mockResolvedValue(
      Response.json({ keys: [keys.publicKey.export({ format: "jwk" })] }),
    );
    expect(await verifyFalWebhook(headers, body)).toBe(true);
    expect(await verifyFalWebhook(headers, Buffer.from("changed"))).toBe(false);
    headers.set("x-fal-webhook-timestamp", String(Number(time) - 600));
    expect(await verifyFalWebhook(headers, body)).toBe(false);
    expect(await verifyFalWebhook(new Headers(), body)).toBe(false);
    expect(fetcher).toHaveBeenCalledTimes(1);
  });
});
describe("MP4 container validation with synthetic H.264 fixtures", () => {
  it("accepts a playable five-second reference and reports dimensions", () => {
    const bytes = syntheticVideo();
    expect(inspectMp4(bytes)).toEqual({ seconds: 5, width: 300, height: 400 });
    expect(validateReferenceVideo(bytes).seconds).toBe(5);
  });
  it("rejects videos outside the cost-bounded duration and corrupted containers", () => {
    expect(() => validateReferenceVideo(syntheticVideo(6))).toThrow(
      "3–5 second",
    );
    const bytes = syntheticVideo(3);
    expect(validateReferenceVideo(bytes).seconds).toBe(3);
    expect(() => validateReferenceVideo(bytes.subarray(0, 200))).toThrow();
    expect(() => validateReferenceVideo(Buffer.from("not an mp4"))).toThrow();
    const bad = Buffer.from(bytes);
    bad.writeUInt32BE(0x7fffffff, 0);
    expect(() => inspectMp4(bad)).toThrow();
  });
});
