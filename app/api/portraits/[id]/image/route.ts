import { requireUser, admin } from "@/lib/server/supabase";
import { BUCKET, getJob, pathFor } from "@/lib/server/jobs";
import { AppError, errorResponse } from "@/lib/errors";
export async function GET(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const user = await requireUser();
    const { id } = await context.params;
    const job = await getJob(id, user.id);
    if (job.status === "expired" || Date.parse(job.expires_at) <= Date.now())
      throw new AppError("EXPIRED", "These photos have expired.", 410);
    const url = new URL(request.url);
    const kind =
      url.searchParams.get("kind") === "original" ? "original" : "portrait";
    if (kind === "portrait" && job.status !== "succeeded")
      throw new AppError("NOT_READY", "Your portrait is not ready yet.", 409);
    const { data, error } = await admin()
      .storage.from(BUCKET)
      .download(pathFor(job, kind));
    if (error || !data)
      throw new AppError(
        "IMAGE_MISSING",
        "The photo could not be loaded. Please check its status again.",
        404,
      );
    return new Response(data, {
      headers: {
        "Content-Type": kind === "original" ? "image/jpeg" : "image/png",
        "Cache-Control": "no-store, private",
        "Content-Disposition": `${url.searchParams.get("download") === "1" ? "attachment" : "inline"}; filename="editingapp-${kind}.${kind === "original" ? "jpg" : "png"}"`,
      },
    });
  } catch (error) {
    return errorResponse(error);
  }
}
