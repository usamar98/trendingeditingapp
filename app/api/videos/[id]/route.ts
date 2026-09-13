import { requireUser } from "@/lib/server/supabase";
import { sameOrigin } from "@/lib/server/config";
import {
  getVideoJob,
  reconcileVideo,
  publicVideo,
  deleteVideo,
} from "@/lib/server/video-jobs";
import { AppError, errorResponse } from "@/lib/errors";
export const maxDuration = 180;
type Context = { params: Promise<{ id: string }> };
export async function GET(_request: Request, context: Context) {
  let jobId: string | undefined;
  try {
    const user = await requireUser();
    const { id } = await context.params;
    if (/^[0-9a-f-]{36}$/i.test(id)) jobId = id;
    return Response.json(
      publicVideo(await reconcileVideo(await getVideoJob(id, user.id))),
    );
  } catch (error) {
    if (!(error instanceof AppError)) {
      const code =
        error && typeof error === "object" && "code" in error
          ? error.code
          : undefined;
      console.error("Video status check unavailable", {
        jobId,
        code:
          typeof code === "string" && /^[A-Z0-9_]{1,40}$/.test(code)
            ? code
            : "VIDEO_CHECK_UNAVAILABLE",
      });
    }
    return errorResponse(
      error instanceof AppError
        ? error
        : new AppError(
            "VIDEO_CHECK_UNAVAILABLE",
            "We couldn’t check your video right now. Use Check video status on this same request; checking will not charge you again.",
            503,
          ),
    );
  }
}
export async function DELETE(request: Request, context: Context) {
  try {
    sameOrigin(request);
    const user = await requireUser();
    const { id } = await context.params;
    await deleteVideo(await getVideoJob(id, user.id));
    return Response.json({ ok: true });
  } catch (error) {
    return errorResponse(error);
  }
}
