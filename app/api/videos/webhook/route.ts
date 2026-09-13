import { readBody } from "@/lib/server/upload";
import { AppError, errorResponse } from "@/lib/errors";
import {
  validWebhookToken,
  verifyFalWebhook,
} from "@/lib/server/ai/fal-webhook";
import { getVideoJob, reconcileVideo } from "@/lib/server/video-jobs";
export const runtime = "nodejs";
export const maxDuration = 180;
export async function POST(request: Request) {
  try {
    const url = new URL(request.url),
      id = url.searchParams.get("job") || "",
      token = url.searchParams.get("token") || "";
    if (!/^[0-9a-f-]{36}$/i.test(id) || !validWebhookToken(id, token))
      throw new AppError("WEBHOOK", "Invalid callback.", 403);
    const body = await readBody(request, 512_000);
    if (!(await verifyFalWebhook(request.headers, body)))
      throw new AppError("WEBHOOK", "Invalid callback signature.", 403);
    let data;
    try {
      data = JSON.parse(body.toString("utf8"));
    } catch {
      throw new AppError("WEBHOOK", "Invalid callback body.");
    }
    const requestId = data.request_id;
    if (
      typeof requestId !== "string" ||
      !/^[a-zA-Z0-9_-]{8,128}$/.test(requestId) ||
      request.headers.get("x-fal-webhook-request-id") !== requestId
    )
      throw new AppError("WEBHOOK", "Invalid callback request.", 403);
    // Signed payload media URLs and status are still not trusted as billing authority: fetch the saved queue request.
    const job = await reconcileVideo(await getVideoJob(id), requestId);
    if (!["succeeded", "failed", "expired"].includes(job.status))
      return Response.json({ pending: true }, { status: 503 });
    return Response.json({ ok: true });
  } catch (error) {
    return errorResponse(error);
  }
}
