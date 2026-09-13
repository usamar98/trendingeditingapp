import { createHash } from "node:crypto";
import { sameOrigin, creditsEnabled, requireConfig } from "@/lib/server/config";
import { requireUser } from "@/lib/server/supabase";
import { normalizePhoto, uploadForm } from "@/lib/server/upload";
import {
  reserveJob,
  reserveCreditJob,
  runJob,
  publicJob,
} from "@/lib/server/jobs";
import { type Preset, type Quality } from "@/lib/presets";
import { FEATURES } from "@/lib/server/ai/registry";
import { AppError, errorResponse } from "@/lib/errors";
import {
  toolForFeature,
  type ImageFeature,
  type ImagePreset,
} from "@/lib/tools";
export const runtime = "nodejs";
export const maxDuration = 300;
export async function POST(request: Request) {
  try {
    sameOrigin(request);
    const user = await requireUser();
    requireConfig();
    const form = await uploadForm(request);
    const id = form.get("requestId");
    const preset = form.get("preset");
    const featureId = form.get("featureId") || "retro-portrait";
    const quality = form.get("quality");
    const file = form.get("photo");
    if (
      typeof id !== "string" ||
      !/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
        id,
      )
    )
      throw new AppError("ID", "Invalid portrait request.");
    if (
      !["retro-portrait", "ai-figurine"].includes(String(featureId)) ||
      !toolForFeature(featureId as ImageFeature)?.presets.some(
        (p) => p.id === preset,
      ) ||
      !["medium", "high"].includes(String(quality))
    )
      throw new AppError("PRESET", "Choose one of the available styles.");
    if (form.get("consent") !== "true")
      throw new AppError(
        "CONSENT",
        "Please confirm you have permission to use this photo.",
      );
    if (!(file instanceof File))
      throw new AppError("PHOTO", "Choose a photo first.");
    const photo = await normalizePhoto(file);
    if (featureId !== "retro-portrait" && !creditsEnabled())
      throw new AppError(
        "CREDITS_SETUP",
        "The figurine studio is not available yet. Try the retro portrait studio while we finish connecting it.",
        503,
      );
    const feature = FEATURES[featureId as ImageFeature];
    const fingerprint = createHash("sha256")
      .update(photo)
      .update(
        `:${preset}:${quality}:fal:${feature.endpoint}:${feature.version}:${featureId}:${creditsEnabled() ? "credits-v1" : "legacy"}`,
      )
      .digest("hex");
    const input = {
      id,
      userId: user.id,
      fingerprint,
      preset: preset as ImagePreset,
      quality: quality as Quality,
    };
    const reservation = creditsEnabled()
      ? await reserveCreditJob({
          ...input,
          featureId: featureId as ImageFeature,
        })
      : await reserveJob({ ...input, preset: preset as Preset });
    const job = reservation.fresh
      ? await runJob(reservation.job, photo)
      : reservation.job;
    return Response.json(publicJob(job), {
      status: ["reserved", "processing"].includes(job.status) ? 202 : 200,
    });
  } catch (error) {
    return errorResponse(error);
  }
}
