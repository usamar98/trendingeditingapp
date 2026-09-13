import { requireUser } from "@/lib/server/supabase";
import { sameOrigin } from "@/lib/server/config";
import {
  getVideoJob,
  reconcileVideo,
  publicVideo,
  deleteVideo,
} from "@/lib/server/video-jobs";
import { errorResponse } from "@/lib/errors";
export const maxDuration = 180;
type Context = { params: Promise<{ id: string }> };
export async function GET(_request: Request, context: Context) {
  try {
    const user = await requireUser();
    const { id } = await context.params;
    return Response.json(
      publicVideo(await reconcileVideo(await getVideoJob(id, user.id))),
    );
  } catch (error) {
    return errorResponse(error);
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
