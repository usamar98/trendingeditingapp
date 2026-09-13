import { requireUser, admin } from "@/lib/server/supabase";
import {
  getVideoJob,
  expiredVideo,
  VIDEO_BUCKET,
  videoPath,
} from "@/lib/server/video-jobs";
import { AppError, errorResponse } from "@/lib/errors";
export async function GET(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const user = await requireUser();
    const { id } = await context.params;
    const job = await getVideoJob(id, user.id);
    if (expiredVideo(job))
      throw new AppError("EXPIRED", "This video's files have expired.", 410);
    const url = new URL(request.url);
    const kind =
      url.searchParams.get("kind") === "original" ? "original" : "video";
    if (kind === "video" && job.status !== "succeeded")
      throw new AppError("NOT_READY", "Your video is not ready yet.", 409);
    const filename = `editingapp-${job.preset}-${kind}.${kind === "original" ? "jpg" : "mp4"}`;
    const ttl = Math.max(
      1,
      Math.min(
        60,
        Math.floor((Date.parse(job.expires_at) - Date.now()) / 1000),
      ),
    );
    const { data, error } = await admin()
      .storage.from(VIDEO_BUCKET)
      .createSignedUrl(
        videoPath(job, kind),
        ttl,
        url.searchParams.get("download") === "1"
          ? { download: filename }
          : undefined,
      );
    if (error || !data)
      throw new AppError(
        "MEDIA_MISSING",
        "Your download could not be opened. Check the request again.",
        404,
      );
    // Short-lived, owner-authorized delivery avoids Vercel's function response-size limit and supports byte ranges.
    return new Response(null, {
      status: 302,
      headers: {
        Location: data.signedUrl,
        "Cache-Control": "no-store, private",
      },
    });
  } catch (error) {
    return errorResponse(error);
  }
}
