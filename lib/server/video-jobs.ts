import "server-only";
import { randomUUID } from "node:crypto";
import { admin } from "./supabase";
import { configured, creditsEnabled } from "./config";
import { AppError } from "@/lib/errors";
import {
  VIDEO_PRESETS,
  videoCredits,
  type VideoPreset,
  type VideoJobView,
} from "@/lib/video";
import { runFeature } from "./ai/features";
import { ProviderError, ProviderReadError } from "./ai/errors";
import { readQueue, downloadFalVideo, deleteFalPayload } from "./ai/fal-queue";
import { videoWebhookUrl } from "./ai/fal-webhook";
import { inspectMp4 } from "./video-mp4";

export type VideoJob = {
  id: string;
  user_id: string;
  fingerprint: string;
  preset: VideoPreset;
  status: VideoJobView["status"];
  credits_charged: number;
  provider_model: string;
  provider_request_id: string | null;
  created_at: string;
  expires_at: string;
  error_code: string | null;
  provider_cleaned: boolean;
  files_deleted: boolean;
};
export const VIDEO_BUCKET = "videos";
export const videoPath = (
  job: Pick<VideoJob, "id" | "user_id">,
  kind: "original" | "reference" | "video",
) => `${job.user_id}/${job.id}/${kind}.${kind === "original" ? "jpg" : "mp4"}`;
export const expiredVideo = (job: VideoJob) =>
  job.status === "expired" || Date.parse(job.expires_at) <= Date.now();
export function publicVideo(job: VideoJob): VideoJobView {
  const stale =
    ["reserved", "submitting"].includes(job.status) &&
    Date.now() - Date.parse(job.created_at) > 90_000;
  return {
    id: job.id,
    preset: job.preset,
    status: expiredVideo(job) ? "expired" : stale ? "uncertain" : job.status,
    creditsCharged: job.credits_charged,
    createdAt: job.created_at,
    expiresAt: job.expires_at,
    errorCode: job.error_code,
  };
}
export async function videoAvailable() {
  if (!configured() || !creditsEnabled()) return false;
  const { data, error } = await admin()
    .from("video_prices")
    .select("preset,credits,enabled");
  return (
    !error &&
    VIDEO_PRESETS.every((p) =>
      data?.some(
        (row) =>
          row.preset === p.id &&
          row.enabled &&
          row.credits === videoCredits(p.id),
      ),
    )
  );
}
export async function getVideoJob(id: string, userId?: string) {
  if (!/^[0-9a-f-]{36}$/i.test(id))
    throw new AppError("NOT_FOUND", "Video request not found.", 404);
  let query = admin().from("video_jobs").select("*").eq("id", id);
  if (userId) query = query.eq("user_id", userId);
  const { data, error } = await query.maybeSingle();
  if (error) throw error;
  if (!data) throw new AppError("NOT_FOUND", "Video request not found.", 404);
  return data as VideoJob;
}
export async function reserveVideo(input: {
  id: string;
  userId: string;
  fingerprint: string;
  preset: VideoPreset;
}) {
  const { data, error } = await admin().rpc("reserve_video_job", {
    p_id: input.id,
    p_user: input.userId,
    p_fingerprint: input.fingerprint,
    p_preset: input.preset,
    p_expected_credits: videoCredits(input.preset),
  });
  if (error) {
    const cases = [
      [
        "CREDITS",
        "You need more credits for this video. Choose a plan to continue.",
        402,
      ],
      [
        "BILLING_HOLD",
        "Your billing account needs review before generating.",
        403,
      ],
      ["BUSY", "Finish your current generation before starting another.", 409],
      [
        "CONFLICT",
        "This request ID already belongs to another photo or movement.",
        409,
      ],
      [
        "RATE_LIMIT",
        "Today's generation safety limit has been reached. No credits were charged.",
        429,
      ],
      [
        "FEATURE_DISABLED",
        "Video generation is temporarily unavailable. No credits were charged.",
        503,
      ],
    ] as const;
    const item = cases.find((c) => error.message.includes(c[0]));
    if (item) throw new AppError(item[0], item[1], item[2]);
    throw error;
  }
  return data as { fresh: boolean; job: VideoJob };
}
async function writeVideo(
  id: string,
  values: Record<string, unknown>,
  lease?: string,
  states?: string[],
) {
  let query = admin().from("video_jobs").update(values).eq("id", id);
  if (lease) query = query.eq("lease_id", lease);
  if (states) query = query.in("status", states);
  const { error } = await query;
  if (error) throw error;
}
async function failure(id: string, uncertain: boolean, code: string) {
  const { error } = await admin().rpc("settle_video_failure", {
    p_id: id,
    p_uncertain: uncertain,
    p_error: code,
  });
  if (error) throw error;
}
async function signedInput(job: VideoJob, kind: "original" | "reference") {
  const { data, error } = await admin()
    .storage.from(VIDEO_BUCKET)
    .createSignedUrl(videoPath(job, kind), 3600);
  if (error || !data) throw new Error("Private input unavailable");
  return data.signedUrl;
}
export async function submitVideo(
  job: VideoJob,
  photo: Buffer,
  reference?: Buffer,
) {
  let dispatched = false;
  try {
    const storage = admin().storage.from(VIDEO_BUCKET);
    for (const [kind, bytes] of [
      ["original", photo],
      ["reference", reference],
    ] as const) {
      if (!bytes) continue;
      const { error } = await storage.upload(videoPath(job, kind), bytes, {
        contentType: kind === "original" ? "image/jpeg" : "video/mp4",
        upsert: false,
      });
      if (error) throw error;
    }
    const imageUrl = await signedInput(job, "original");
    const videoUrl = reference ? await signedInput(job, "reference") : null;
    await writeVideo(job.id, { status: "submitting" }, undefined, ["reserved"]);
    const webhookUrl = videoWebhookUrl(job.id);
    dispatched = true;
    const result = videoUrl
      ? await runFeature(
          "photo-motion",
          { imageUrl, videoUrl, preset: job.preset },
          { webhookUrl },
        )
      : await runFeature(
          "photo-to-video",
          { imageUrl, preset: job.preset },
          { webhookUrl },
        );
    // Do not downgrade a fast webhook's result. A signed webhook can also recover a lost submit response.
    await writeVideo(
      job.id,
      { provider_request_id: result.requestId, status: "queued" },
      undefined,
      ["submitting", "uncertain"],
    );
  } catch (error) {
    await failure(
      job.id,
      error instanceof ProviderError ? error.uncertain : dispatched,
      error instanceof ProviderError ? error.reason : "SUBMISSION_INTERRUPTED",
    );
  }
  return getVideoJob(job.id, job.user_id);
}
async function cleanProvider(job: VideoJob, lease: string) {
  if (job.provider_cleaned) return;
  if (!job.provider_request_id) return;
  try {
    if (await deleteFalPayload(job.provider_request_id))
      await writeVideo(job.id, { provider_cleaned: true }, lease);
  } catch {
    /* Retry cleanup on later status/cleanup calls; keep downloaded media available. */
  }
}
export async function reconcileVideo(job: VideoJob, webhookRequestId?: string) {
  if (expiredVideo(job)) {
    if (!job.files_deleted) await deleteVideo(job);
    return getVideoJob(job.id);
  }
  const lease = randomUUID();
  const claimed = await admin().rpc("claim_video_job", {
    p_id: job.id,
    p_lease: lease,
    p_delete: false,
  });
  if (claimed.error) throw claimed.error;
  if (!claimed.data) return getVideoJob(job.id);
  job = claimed.data as VideoJob;
  let stage = "VIDEO_RECOVERY_UNAVAILABLE";
  try {
    if (
      webhookRequestId &&
      job.provider_request_id &&
      job.provider_request_id !== webhookRequestId
    )
      throw new AppError("WEBHOOK_MISMATCH", "Request mismatch.", 403);
    if (!job.provider_request_id && webhookRequestId) {
      await writeVideo(
        job.id,
        { provider_request_id: webhookRequestId },
        lease,
      );
      job.provider_request_id = webhookRequestId;
    }
    if (job.status === "succeeded") {
      await cleanProvider(job, lease);
      return getVideoJob(job.id);
    }
    if (!job.provider_request_id) return job; // No second submission, regardless of age.
    stage = "VIDEO_STORAGE_UNAVAILABLE";
    const storage = admin().storage.from(VIDEO_BUCKET);
    const files = await storage.list(`${job.user_id}/${job.id}`, {
      search: "video.mp4",
      limit: 5,
    });
    if (files.error) throw files.error;
    if (!files.data.some((f) => f.name === "video.mp4")) {
      stage = "VIDEO_STATUS_UNAVAILABLE";
      const status = await readQueue(job.provider_request_id, "status");
      if (status.status === "IN_QUEUE" || status.status === "IN_PROGRESS") {
        await writeVideo(
          job.id,
          {
            status: status.status === "IN_QUEUE" ? "queued" : "processing",
            error_code: null,
          },
          lease,
        );
        return getVideoJob(job.id);
      }
      if (status.status !== "COMPLETED")
        throw new Error("Unexpected queue state");
      if (status.error || status.error_type) {
        await failure(job.id, false, "GENERATION_FAILED");
        await cleanProvider(job, lease);
        return getVideoJob(job.id);
      }
      stage = "VIDEO_RESULT_UNAVAILABLE";
      await writeVideo(job.id, { error_code: "VIDEO_SAVING" }, lease);
      let output: unknown;
      try {
        output = await readQueue(job.provider_request_id, "result");
      } catch (error) {
        if (!(error instanceof ProviderReadError) || !error.definitive)
          throw error;
        await failure(job.id, false, "GENERATION_FAILED");
        await cleanProvider(job, lease);
        return getVideoJob(job.id);
      }
      stage = "VIDEO_DOWNLOAD_UNAVAILABLE";
      const bytes = await downloadFalVideo(output);
      stage = "VIDEO_OUTPUT_INVALID";
      const info = inspectMp4(bytes);
      if (info.seconds < 2.5 || info.seconds > 5.5)
        throw new Error("Unexpected output duration");
      stage = "VIDEO_STORAGE_UNAVAILABLE";
      const saved = await storage.upload(videoPath(job, "video"), bytes, {
        contentType: "video/mp4",
        upsert: true,
      });
      if (saved.error) throw saved.error;
    }
    stage = "VIDEO_SAVE_UNAVAILABLE";
    await writeVideo(job.id, { status: "succeeded", error_code: null }, lease);
    await cleanProvider(job, lease);
  } catch (error) {
    if (error instanceof AppError) throw error;
    const code =
      error instanceof ProviderReadError && error.reason !== "QUEUE_UNAVAILABLE"
        ? error.reason
        : stage;
    // Deliberately exclude raw provider/storage errors, URLs and payloads: they
    // can contain private photos or credentials. IDs + stage identify the fault.
    console.error("Video recovery paused", {
      jobId: job.id,
      stage,
      code,
      ...(error instanceof ProviderReadError && error.httpStatus
        ? { httpStatus: error.httpStatus }
        : {}),
    });
    await writeVideo(job.id, { error_code: code }, lease);
  } finally {
    await writeVideo(job.id, { lease_id: null, lease_until: null }, lease);
  }
  return getVideoJob(job.id);
}
export async function deleteVideo(job: VideoJob) {
  const lease = randomUUID();
  const claimed = await admin().rpc("claim_video_job", {
    p_id: job.id,
    p_lease: lease,
    p_delete: true,
  });
  if (
    claimed.error?.message.includes("BUSY") ||
    (!claimed.data && !claimed.error)
  )
    throw new AppError(
      "BUSY",
      "Your video is still processing or being saved. Check again shortly; interrupted requests can be deleted after one hour.",
      409,
    );
  if (claimed.error) throw claimed.error;
  job = claimed.data as VideoJob;
  try {
    // Tombstone first. A later webhook must not resurrect private files.
    await writeVideo(
      job.id,
      { status: "expired", fingerprint: "deleted" },
      lease,
    );
    const { error } = await admin()
      .storage.from(VIDEO_BUCKET)
      .remove([
        videoPath(job, "original"),
        videoPath(job, "reference"),
        videoPath(job, "video"),
      ]);
    if (error) throw error;
    await writeVideo(job.id, { files_deleted: true }, lease);
    await cleanProvider(job, lease);
  } finally {
    await writeVideo(job.id, { lease_id: null, lease_until: null }, lease);
  }
}
