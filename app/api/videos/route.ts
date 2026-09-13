import { createHash } from "node:crypto";
import sharp from "sharp";
import { sameOrigin, authConfigured } from "@/lib/server/config";
import { admin, requireUser } from "@/lib/server/supabase";
import { normalizePhoto, readBody } from "@/lib/server/upload";
import { AppError, errorResponse } from "@/lib/errors";
import {
  VIDEO_FORM_MAX_BYTES,
  VIDEO_REFERENCE_MAX_BYTES,
  videoPreset,
} from "@/lib/video";
import {
  videoAvailable,
  publicVideo,
  reserveVideo,
  submitVideo,
  deleteVideo,
  type VideoJob,
} from "@/lib/server/video-jobs";
import { getJob, BUCKET, pathFor } from "@/lib/server/jobs";
import { validateReferenceVideo } from "@/lib/server/video-mp4";
import { FEATURES } from "@/lib/server/ai/registry";
export const runtime = "nodejs";
export const maxDuration = 120;
export async function GET() {
  try {
    const available = await videoAvailable();
    if (!authConfigured()) return Response.json({ available, jobs: [] });
    let user;
    try {
      user = await requireUser();
    } catch (error) {
      if (error instanceof AppError && error.status === 401)
        return Response.json({ available, jobs: [] });
      throw error;
    }
    const { data, error } = await admin()
      .from("video_jobs")
      .select("*")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(12);
    if (error && !available) return Response.json({ available, jobs: [] });
    if (error) throw error;
    // Opportunistic cleanup supplements the optional scheduled cleanup, without new cron credentials.
    for (const job of ((data || []) as VideoJob[])
      .filter(
        (job) => Date.parse(job.expires_at) <= Date.now() && !job.files_deleted,
      )
      .slice(0, 3))
      await deleteVideo(job).catch(() => {});
    return Response.json({
      available,
      jobs: (data || []).map((job) => publicVideo(job as VideoJob)),
    });
  } catch (error) {
    return errorResponse(error);
  }
}
export async function POST(request: Request) {
  try {
    sameOrigin(request);
    const user = await requireUser();
    if (!(await videoAvailable()))
      throw new AppError(
        "VIDEO_UNAVAILABLE",
        "The video studio is not connected yet. You can explore movements and preview your photo.",
        503,
      );
    const contentType = request.headers.get("content-type") || "";
    if (!contentType.startsWith("multipart/form-data;"))
      throw new AppError("FORMAT", "Choose a photo to animate.");
    const body = await readBody(request, VIDEO_FORM_MAX_BYTES);
    let form: FormData;
    try {
      form = await new Response(body, {
        headers: { "content-type": contentType },
      }).formData();
    } catch {
      throw new AppError("FORMAT", "Choose your files again.");
    }
    const id = form.get("requestId"),
      preset = videoPreset(String(form.get("preset")));
    if (
      typeof id !== "string" ||
      !/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
        id,
      )
    )
      throw new AppError("ID", "Invalid video request.");
    if (!preset) throw new AppError("PRESET", "Choose an available movement.");
    if (form.get("consent") !== "true")
      throw new AppError(
        "CONSENT",
        "Confirm you have permission from the people pictured and rights to use these files.",
      );
    const sourceId = form.get("sourceJobId");
    let photo: Buffer;
    if (typeof sourceId === "string" && sourceId) {
      const source = await getJob(sourceId, user.id);
      if (
        source.status !== "succeeded" ||
        Date.parse(source.expires_at) <= Date.now()
      )
        throw new AppError(
          "SOURCE_EXPIRED",
          "That portrait is no longer available. Upload a saved photo instead.",
          410,
        );
      const downloaded = await admin()
        .storage.from(BUCKET)
        .download(pathFor(source, "portrait"));
      if (downloaded.error || !downloaded.data)
        throw new AppError(
          "SOURCE_MISSING",
          "The portrait could not be loaded.",
          404,
        );
      photo = await sharp(Buffer.from(await downloaded.data.arrayBuffer()), {
        limitInputPixels: 8_000_000,
      })
        .rotate()
        .resize({
          width: 1536,
          height: 1536,
          fit: "inside",
          withoutEnlargement: true,
        })
        .jpeg({ quality: 92 })
        .toBuffer();
    } else {
      const file = form.get("photo");
      if (!(file instanceof File))
        throw new AppError("PHOTO", "Choose a photo first.");
      photo = await normalizePhoto(file);
    }
    const info = await sharp(photo).metadata();
    if (
      !info.width ||
      !info.height ||
      Math.min(info.width, info.height) < 300 ||
      info.width / info.height > 2.5 ||
      info.height / info.width > 2.5
    )
      throw new AppError(
        "PHOTO_DIMENSIONS",
        "For video, use a photo at least 300 pixels on each side, with a portrait, square or landscape composition.",
      );
    let reference: Buffer | undefined;
    if (preset.id === "motion") {
      const clip = form.get("reference");
      if (
        !(clip instanceof File) ||
        clip.type !== "video/mp4" ||
        !clip.size ||
        clip.size > VIDEO_REFERENCE_MAX_BYTES
      )
        throw new AppError(
          "REFERENCE",
          "Choose your own 3–5 second MP4 reference clip under 3 MB.",
        );
      reference = Buffer.from(await clip.arrayBuffer());
      validateReferenceVideo(reference);
    } else if (form.get("reference") instanceof File)
      throw new AppError(
        "REFERENCE",
        "A reference clip is only used for Copy a Motion.",
      );
    const feature =
      FEATURES[preset.id === "motion" ? "photo-motion" : "photo-to-video"];
    const fingerprint = createHash("sha256")
      .update(photo)
      .update(reference || Buffer.alloc(0))
      .update(`:${preset.id}:${feature.endpoint}:${feature.version}:silent:5`)
      .digest("hex");
    const reservation = await reserveVideo({
      id,
      userId: user.id,
      fingerprint,
      preset: preset.id,
    });
    const job = reservation.fresh
      ? await submitVideo(reservation.job, photo, reference)
      : reservation.job;
    return Response.json(publicVideo(job), {
      status: job.status === "failed" ? 200 : 202,
    });
  } catch (error) {
    return errorResponse(error);
  }
}
