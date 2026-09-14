import { beforeEach, describe, it, expect, vi } from "vitest";
import { syntheticVideo } from "./fixtures/video";
const fake = vi.hoisted(() => ({
  admin: vi.fn(),
  run: vi.fn(),
  read: vi.fn(),
  download: vi.fn(),
  clean: vi.fn(),
}));
vi.mock("@/lib/server/supabase", () => ({ admin: fake.admin }));
vi.mock("@/lib/server/ai/features", () => ({ runFeature: fake.run }));
vi.mock("@/lib/server/ai/fal-queue", () => ({
  readQueue: fake.read,
  downloadFalVideo: fake.download,
  deleteFalPayload: fake.clean,
}));
vi.mock("@/lib/server/ai/fal-webhook", () => ({
  videoWebhookUrl: () => "https://app.test/callback",
}));
import {
  reconcileVideo,
  submitVideo,
  deleteVideo,
  type VideoJob,
} from "@/lib/server/video-jobs";
import { ProviderError, ProviderReadError } from "@/lib/server/ai/errors";
let job: VideoJob & { lease_id?: string | null };
const rpc = vi.fn(),
  upload = vi.fn(),
  list = vi.fn(),
  remove = vi.fn();
const id = "b827395f-a85b-48a4-83dd-106a7348a7f6";
beforeEach(() => {
  Object.values(fake).forEach((f) => f.mockReset());
  [rpc, upload, list, remove].forEach((f) => f.mockReset());
  job = {
    id,
    user_id: "owner",
    fingerprint: "photo",
    preset: "cinematic",
    status: "queued",
    credits_charged: 60,
    provider_model: "fal-ai/kling-video/v3/standard/image-to-video",
    provider_request_id: "fal-request-12345",
    created_at: new Date().toISOString(),
    expires_at: new Date(Date.now() + 86400000).toISOString(),
    error_code: null,
    provider_cleaned: false,
    files_deleted: false,
  };
  fake.admin.mockImplementation(() => ({
    rpc,
    from: () => {
      let values: Record<string, unknown> | undefined;
      let states: string[] | undefined;
      let lease: string | undefined;
      const q = {
        select: () => q,
        update: (v: Record<string, unknown>) => {
          values = v;
          return q;
        },
        eq: (k: string, v: string) => {
          if (k === "lease_id") lease = v;
          return q;
        },
        in: (_k: string, v: string[]) => {
          states = v;
          return q;
        },
        maybeSingle: async () => ({ data: { ...job }, error: null }),
        then: (resolve: (v: unknown) => void) => {
          if (
            values &&
            (!lease || lease === job.lease_id) &&
            (!states || states.includes(job.status))
          )
            Object.assign(job, values);
          return Promise.resolve({ error: null }).then(resolve);
        },
      };
      return q;
    },
    storage: {
      from: () => ({
        upload,
        list,
        remove,
        createSignedUrl: async () => ({
          data: { signedUrl: "https://private.test/input" },
          error: null,
        }),
      }),
    },
  }));
  rpc.mockImplementation(async (name: string, p: Record<string, unknown>) => {
    if (name === "claim_video_job") {
      job.lease_id = String(p.p_lease);
      return { data: { ...job }, error: null };
    }
    if (name === "settle_video_failure") {
      if (!["succeeded", "failed", "expired"].includes(job.status)) {
        job.status = p.p_uncertain ? "uncertain" : "failed";
        job.error_code = String(p.p_error);
      }
      return { error: null };
    }
    throw new Error("Unexpected RPC");
  });
  upload.mockResolvedValue({ error: null });
  remove.mockResolvedValue({ error: null });
  list.mockResolvedValue({ data: [], error: null });
  fake.clean.mockResolvedValue(true);
});
describe("video reconciliation with simulated provider/storage boundaries", () => {
  it("persists the MP4 before deleting provider output and never submits inference", async () => {
    fake.read
      .mockResolvedValueOnce({ status: "COMPLETED" })
      .mockResolvedValueOnce({ video: { url: "private" } });
    fake.download.mockResolvedValue(syntheticVideo());
    expect((await reconcileVideo({ ...job })).status).toBe("succeeded");
    expect(upload).toHaveBeenCalledWith(
      `owner/${id}/video.mp4`,
      expect.any(Buffer),
      { contentType: "video/mp4", upsert: true },
    );
    expect(upload.mock.invocationCallOrder[0]).toBeLessThan(
      fake.clean.mock.invocationCallOrder[0],
    );
    expect(job.provider_cleaned).toBe(true);
    expect(job.lease_id).toBeNull();
    expect(fake.run).not.toHaveBeenCalled();
  });
  it("recovers an already saved video without fetching or generating it again", async () => {
    list.mockResolvedValue({ data: [{ name: "video.mp4" }], error: null });
    expect((await reconcileVideo({ ...job })).status).toBe("succeeded");
    expect(fake.read).not.toHaveBeenCalled();
    expect(fake.download).not.toHaveBeenCalled();
    expect(upload).not.toHaveBeenCalled();
    expect(fake.run).not.toHaveBeenCalled();
  });
  it("preserves the outcome and releases the lease on temporary status errors", async () => {
    fake.read.mockRejectedValue(new Error("queue unavailable"));
    expect(await reconcileVideo({ ...job })).toMatchObject({
      status: "queued",
      error_code: "VIDEO_STATUS_UNAVAILABLE",
    });
    expect(job.status).toBe("queued");
    expect(job.lease_id).toBeNull();
    expect(
      rpc.mock.calls.some(([name]) => name === "settle_video_failure"),
    ).toBe(false);
    expect(fake.run).not.toHaveBeenCalled();
  });
  it("refunds a confirmed provider failure and does not try to download", async () => {
    fake.read.mockResolvedValue({
      status: "COMPLETED",
      error_type: "content_policy_violation",
    });
    expect((await reconcileVideo({ ...job })).status).toBe("failed");
    expect(rpc).toHaveBeenCalledWith(
      "settle_video_failure",
      expect.objectContaining({ p_uncertain: false }),
    );
    expect(fake.download).not.toHaveBeenCalled();
  });
  it("keeps provider output for recovery if private storage fails", async () => {
    fake.read
      .mockResolvedValueOnce({ status: "COMPLETED" })
      .mockResolvedValueOnce({ video: { url: "private" } });
    fake.download.mockResolvedValue(syntheticVideo());
    upload.mockResolvedValue({ error: new Error("storage down") });
    expect(await reconcileVideo({ ...job })).toMatchObject({
      status: "queued",
      error_code: "VIDEO_STORAGE_UNAVAILABLE",
    });
    expect(fake.clean).not.toHaveBeenCalled();
    expect(job.status).toBe("queued");
    expect(job.lease_id).toBeNull();
    fake.read
      .mockResolvedValueOnce({ status: "COMPLETED" })
      .mockResolvedValueOnce({ video: { url: "private" } });
    upload.mockResolvedValue({ error: null });
    expect(await reconcileVideo({ ...job })).toMatchObject({
      status: "succeeded",
      error_code: null,
    });
    expect(fake.run).not.toHaveBeenCalled();
    expect(
      rpc.mock.calls.some(([name]) => name === "settle_video_failure"),
    ).toBe(false);
  });
  it("refunds a completed request whose failure is only on the result endpoint", async () => {
    fake.read
      .mockResolvedValueOnce({ status: "COMPLETED" })
      .mockRejectedValueOnce(
        new ProviderReadError("GENERATION_FAILED", 422, true),
      );
    expect(await reconcileVideo({ ...job })).toMatchObject({
      status: "failed",
      error_code: "GENERATION_FAILED",
    });
    expect(rpc).toHaveBeenCalledWith("settle_video_failure", {
      p_id: id,
      p_uncertain: false,
      p_error: "GENERATION_FAILED",
    });
    expect(fake.download).not.toHaveBeenCalled();
    expect(fake.run).not.toHaveBeenCalled();
  });
  it("preserves a completed request on an ambiguous result failure and exposes no private error data", async () => {
    const log = vi.spyOn(console, "error").mockImplementation(() => {});
    try {
      fake.read
        .mockResolvedValueOnce({ status: "COMPLETED" })
        .mockRejectedValueOnce(
          new Error("private URL and key must not be logged"),
        );
      expect(await reconcileVideo({ ...job })).toMatchObject({
        status: "queued",
        error_code: "VIDEO_RESULT_UNAVAILABLE",
      });
      expect(log).toHaveBeenCalledWith("Video recovery paused", {
        jobId: id,
        stage: "VIDEO_RESULT_UNAVAILABLE",
        code: "VIDEO_RESULT_UNAVAILABLE",
      });
      expect(fake.clean).not.toHaveBeenCalled();
      expect(fake.run).not.toHaveBeenCalled();
      expect(
        rpc.mock.calls.some(([name]) => name === "settle_video_failure"),
      ).toBe(false);
    } finally {
      log.mockRestore();
    }
  });
  it.each([
    new ProviderReadError("VIDEO_CDN_AUTH_UNAVAILABLE", 403),
    new ProviderReadError("VIDEO_ASSET_AUTH_UNAVAILABLE", 403),
    new ProviderReadError("VIDEO_ACCESS_DENIED", 403),
    new ProviderReadError("VIDEO_SIGNING_UNAVAILABLE", 503),
    new ProviderReadError("VIDEO_SIGNED_URL_INVALID"),
    new ProviderReadError("VIDEO_OUTPUT_URL_UNSUPPORTED"),
  ])(
    "retains provider output and credits when private delivery is blocked: $reason",
    async (error) => {
      fake.read
        .mockResolvedValueOnce({ status: "COMPLETED" })
        .mockResolvedValueOnce({ video: { url: "private" } });
      fake.download.mockRejectedValue(error);
      expect(await reconcileVideo({ ...job })).toMatchObject({
        error_code: error.reason,
      });
      expect(fake.clean).not.toHaveBeenCalled();
      expect(upload).not.toHaveBeenCalled();
      expect(fake.run).not.toHaveBeenCalled();
      expect(
        rpc.mock.calls.some(([name]) => name === "settle_video_failure"),
      ).toBe(false);
    },
  );
  it("retains a durable result if provider cleanup needs a broader key scope", async () => {
    job.status = "succeeded";
    fake.clean.mockResolvedValue(false);
    expect((await reconcileVideo({ ...job })).status).toBe("succeeded");
    expect(job.provider_cleaned).toBe(false);
  });
  it("does not replay an uncertain submission and can bind its signed callback", async () => {
    job.status = "uncertain";
    job.provider_request_id = null;
    await reconcileVideo({ ...job });
    expect(fake.run).not.toHaveBeenCalled();
    expect(fake.read).not.toHaveBeenCalled();
    fake.read.mockResolvedValue({ status: "IN_PROGRESS" });
    await reconcileVideo({ ...job }, "recovered-fal-id");
    expect(job.provider_request_id).toBe("recovered-fal-id");
    expect(job.status).toBe("processing");
    expect(fake.run).not.toHaveBeenCalled();
  });
  it("ignores a duplicate worker when the lease is held and rejects mismatched callbacks", async () => {
    rpc.mockResolvedValueOnce({ data: null, error: null });
    await reconcileVideo({ ...job });
    expect(fake.read).not.toHaveBeenCalled();
    await expect(
      reconcileVideo({ ...job }, "different-fal-id"),
    ).rejects.toThrow("mismatch");
  });
  it("tombstones files before removal, preventing callback resurrection", async () => {
    job.status = "succeeded";
    remove.mockImplementation(async () => {
      expect(job.status).toBe("expired");
      return { error: null };
    });
    await deleteVideo({ ...job });
    expect(job.files_deleted).toBe(true);
    expect(remove.mock.calls[0][0]).toHaveLength(3);
    await reconcileVideo({ ...job });
    expect(fake.read).not.toHaveBeenCalled();
    expect(upload).not.toHaveBeenCalled();
  });
  it("marks network ambiguity uncertain but pre-dispatch storage failure refundable", async () => {
    job.status = "reserved";
    job.provider_request_id = null;
    fake.run.mockRejectedValue(new ProviderError(true, "CONNECTION_UNCERTAIN"));
    expect((await submitVideo({ ...job }, Buffer.from("photo"))).status).toBe(
      "uncertain",
    );
    expect(fake.run).toHaveBeenCalledTimes(1);
    job.status = "reserved";
    upload.mockResolvedValue({ error: new Error("storage failed") });
    expect((await submitVideo({ ...job }, Buffer.from("photo"))).status).toBe(
      "failed",
    );
    expect(fake.run).toHaveBeenCalledTimes(1);
  });
});
