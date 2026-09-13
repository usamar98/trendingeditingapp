import "server-only";
import sharp from "sharp";
import { admin } from "./supabase";
import { AppError } from "@/lib/errors";
import { ProviderError, editPortrait } from "./provider";
import type { Preset, Quality } from "@/lib/presets";
import type { ImagePreset, ImageFeature, FigurinePreset } from "@/lib/tools";
import { runFeature } from "./ai/features";
import { FEATURES } from "./ai/registry";
export type Job = {
  id: string;
  user_id: string;
  fingerprint: string;
  preset: ImagePreset;
  quality: Quality;
  status:
    | "reserved"
    | "processing"
    | "succeeded"
    | "failed"
    | "uncertain"
    | "expired";
  error_code: string | null;
  created_at: string;
  expires_at: string;
  provider_request_id?: string | null;
  provider?: "openai" | "fal";
  provider_model?: string;
  feature_id?: string;
  credits_charged?: number;
};
export const BUCKET = "portraits";
export const pathFor = (
  job: Pick<Job, "user_id" | "id">,
  kind: "original" | "portrait",
) => `${job.user_id}/${job.id}/${kind}.${kind === "original" ? "jpg" : "png"}`;
export function publicJob(job: Job) {
  let status = job.status;
  if (new Date(job.expires_at).getTime() <= Date.now()) status = "expired";
  else if (
    ["reserved", "processing"].includes(status) &&
    Date.now() - new Date(job.created_at).getTime() > 240_000
  )
    status = "uncertain";
  return {
    id: job.id,
    status,
    preset: job.preset,
    featureId: job.feature_id || "retro-portrait",
    creditsCharged: job.credits_charged || 0,
    errorCode: job.error_code,
    expiresAt: job.expires_at,
  };
}
export async function getJob(id: string, userId: string) {
  const { data, error } = await admin()
    .from("portrait_jobs")
    .select("*")
    .eq("id", id)
    .eq("user_id", userId)
    .maybeSingle();
  if (error) throw error;
  if (!data)
    throw new AppError("NOT_FOUND", "Portrait request not found.", 404);
  return data as Job;
}
export async function remaining(userId: string) {
  const start = `${new Date().toISOString().slice(0, 10)}T00:00:00Z`;
  const { count, error } = await admin()
    .from("portrait_jobs")
    .select("id", { head: true, count: "exact" })
    .eq("user_id", userId)
    .gte("created_at", start)
    .eq("consumes_allowance", true);
  if (error) throw error;
  return Math.max(0, 3 - (count || 0));
}
export async function reserveJob(input: {
  id: string;
  userId: string;
  fingerprint: string;
  preset: Preset;
  quality: Quality;
}) {
  const { data, error } = await admin().rpc("reserve_portrait", {
    p_id: input.id,
    p_user_id: input.userId,
    p_fingerprint: input.fingerprint,
    p_preset: input.preset,
    p_quality: input.quality,
  });
  if (error) {
    if (error.message.includes("LIMIT"))
      throw new AppError(
        "LIMIT",
        "The daily allowance is used up. Please come back after 00:00 UTC.",
        429,
      );
    if (error.message.includes("BUSY"))
      throw new AppError(
        "BUSY",
        "Finish your current portrait before starting another.",
        409,
      );
    if (error.message.includes("CONFLICT"))
      throw new AppError(
        "CONFLICT",
        "This request ID already belongs to a different photo or style.",
        409,
      );
    throw error;
  }
  return data as { fresh: boolean; job: Job };
}
export async function reserveCreditJob(input: {
  id: string;
  userId: string;
  fingerprint: string;
  preset: ImagePreset;
  quality: Quality;
  featureId: ImageFeature;
}) {
  const { data, error } = await admin().rpc("reserve_image_job", {
    p_id: input.id,
    p_user_id: input.userId,
    p_fingerprint: input.fingerprint,
    p_feature: input.featureId,
    p_preset: input.preset,
    p_quality: input.quality,
  });
  if (error) {
    const mappings = [
      [
        "CREDITS",
        "You do not have enough credits for this image. Choose a plan to add more.",
        402,
      ],
      [
        "BILLING_HOLD",
        "Your billing account needs review before you can generate more images.",
        403,
      ],
      [
        "RATE_LIMIT",
        "Generation is temporarily at its daily safety limit. Your credits have not been charged.",
        429,
      ],
      ["BUSY", "Finish your current image before starting another.", 409],
      [
        "CONFLICT",
        "This request ID already belongs to a different image or style.",
        409,
      ],
      [
        "FEATURE_DISABLED",
        "This tool is temporarily unavailable. Your credits have not been charged.",
        503,
      ],
    ] as const;
    const matched = mappings.find(([code]) => error.message.includes(code));
    if (matched) throw new AppError(matched[0], matched[1], matched[2]);
    throw error;
  }
  return data as { fresh: boolean; job: Job };
}
async function updateJob(job: Job, values: Record<string, unknown>) {
  const { error } = await admin()
    .from("portrait_jobs")
    .update(values)
    .eq("id", job.id)
    .eq("user_id", job.user_id);
  if (error) throw error;
}
export async function runJob(job: Job, photo: Buffer) {
  let dispatched = false;
  try {
    const storage = admin().storage.from(BUCKET);
    const uploaded = await storage.upload(pathFor(job, "original"), photo, {
      contentType: "image/jpeg",
      upsert: false,
    });
    if (uploaded.error) throw uploaded.error;
    // The atomic reservation grants exactly one caller permission to reach this step.
    await updateJob(job, {
      status: "processing",
      provider: "fal",
      provider_model:
        FEATURES[
          job.feature_id === "ai-figurine" ? "ai-figurine" : "retro-portrait"
        ].endpoint,
      feature_id: job.feature_id || "retro-portrait",
    });
    dispatched = true;
    const result =
      job.feature_id === "ai-figurine"
        ? await runFeature("ai-figurine", {
            photo,
            preset: job.preset as FigurinePreset,
            quality: job.quality,
          })
        : await editPortrait(photo, job.preset as Preset, job.quality);
    // Fully decode to validate output; keep original PNG bytes and provenance.
    const output = sharp(result.bytes, {
      limitInputPixels: 8_000_000,
      failOn: "warning",
    });
    const metadata = await output.metadata();
    if (
      metadata.format !== "png" ||
      metadata.width !== 1024 ||
      metadata.height !== 1536
    )
      throw new Error("Unexpected output format");
    await output.stats();
    const png = result.bytes;
    const saved = await storage.upload(pathFor(job, "portrait"), png, {
      contentType: "image/png",
      upsert: false,
    });
    if (saved.error) throw saved.error;
    await updateJob(job, {
      status: "succeeded",
      provider_request_id: result.requestId,
      usage: result.usage,
    });
  } catch (error) {
    const uncertain =
      error instanceof ProviderError ? error.uncertain : dispatched;
    // If saving the state fails, leave the reservation in place. It can never dispatch again.
    const values = {
      status: uncertain ? "uncertain" : "failed",
      consumes_allowance: uncertain,
      error_code:
        error instanceof ProviderError ? error.reason : "PROCESSING_FAILED",
    };
    if (job.credits_charged) {
      const settled = await admin().rpc("settle_image_failure", {
        p_id: job.id,
        p_user_id: job.user_id,
        p_uncertain: uncertain,
        p_error: values.error_code,
      });
      if (settled.error) throw settled.error;
    } else await updateJob(job, values);
  }
  return getJob(job.id, job.user_id);
}
export async function recoverJob(job: Job) {
  if (
    ["processing", "uncertain"].includes(job.status) &&
    new Date(job.expires_at).getTime() > Date.now()
  ) {
    // Recover an output saved before a database/network failure, without invoking the provider.
    const { data, error } = await admin()
      .storage.from(BUCKET)
      .list(`${job.user_id}/${job.id}`, { search: "portrait.png", limit: 5 });
    if (!error && data?.some((file) => file.name === "portrait.png")) {
      await updateJob(job, { status: "succeeded", error_code: null });
      return { ...job, status: "succeeded" as const, error_code: null };
    }
  }
  return job;
}
export async function deletePhotos(job: Job) {
  const { error } = await admin()
    .storage.from(BUCKET)
    .remove([pathFor(job, "original"), pathFor(job, "portrait")]);
  if (error) throw error;
  await updateJob(job, {
    status: "expired",
    fingerprint: "deleted",
    usage: null,
  });
}
