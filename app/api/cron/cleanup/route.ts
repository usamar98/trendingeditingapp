import { timingSafeEqual } from "node:crypto";
import { admin } from "@/lib/server/supabase";
import { deletePhotos, type Job } from "@/lib/server/jobs";
import { errorResponse } from "@/lib/errors";
import { deleteVideo, type VideoJob } from "@/lib/server/video-jobs";
import { creditsEnabled } from "@/lib/server/config";
export const maxDuration = 300;
export async function GET(request: Request) {
  const supplied = Buffer.from(request.headers.get("authorization") || "");
  const expected = Buffer.from(`Bearer ${process.env.CRON_SECRET || ""}`);
  if (
    !process.env.CRON_SECRET ||
    supplied.length !== expected.length ||
    !timingSafeEqual(supplied, expected)
  )
    return new Response("Unauthorized", { status: 401 });
  try {
    const { data, error } = await admin()
      .from("portrait_jobs")
      .select("*")
      .lt("expires_at", new Date().toISOString())
      .neq("status", "expired")
      .order("expires_at")
      .limit(100);
    if (error) throw error;
    let deleted = 0;
    for (const job of data as Job[]) {
      await deletePhotos(job);
      deleted++;
    }
    const cutoff = new Date(Date.now() - 30 * 86_400_000).toISOString();
    const purge = await admin()
      .from("portrait_jobs")
      .delete()
      .eq("status", "expired")
      .lt("created_at", cutoff);
    if (purge.error) throw purge.error;
    let videosDeleted = 0;
    if (creditsEnabled()) {
      const videos = await admin()
        .from("video_jobs")
        .select("*")
        .lt("expires_at", new Date().toISOString())
        .eq("files_deleted", false)
        .order("expires_at")
        .limit(10);
      // The table may not exist during staged migration rollout; other cleanup must continue.
      if (videos.error && !["42P01", "PGRST205"].includes(videos.error.code))
        throw videos.error;
      for (const job of (videos.data || []) as VideoJob[]) {
        await deleteVideo(job);
        videosDeleted++;
      }
    }
    return Response.json({
      deleted,
      videosDeleted,
      morePossible: deleted === 100 || videosDeleted === 10,
    });
  } catch (error) {
    return errorResponse(error);
  }
}
