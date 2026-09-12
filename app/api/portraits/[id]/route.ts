import { requireUser } from "@/lib/server/supabase";
import { getJob, publicJob, recoverJob, deletePhotos } from "@/lib/server/jobs";
import { sameOrigin } from "@/lib/server/config";
import { AppError, errorResponse } from "@/lib/errors";
type Context = { params: Promise<{ id: string }> };
export async function GET(_request: Request, context: Context) {
  try {
    const user = await requireUser();
    const { id } = await context.params;
    return Response.json(
      publicJob(await recoverJob(await getJob(id, user.id))),
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
    const job = await getJob(id, user.id);
    // Wait beyond the route's maximum lifetime to avoid deletion racing an in-flight upload.
    if (
      ["reserved", "processing", "uncertain"].includes(job.status) &&
      Date.now() - Date.parse(job.created_at) < 360_000
    )
      throw new AppError(
        "BUSY",
        "Please wait until processing finishes, or six minutes after the request started, before deleting.",
        409,
      );
    await deletePhotos(job);
    return Response.json({ ok: true });
  } catch (error) {
    return errorResponse(error);
  }
}
