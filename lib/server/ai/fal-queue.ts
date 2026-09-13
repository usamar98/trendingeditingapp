import "server-only";
import { ProviderError } from "./errors";

export const QUEUE_ROOT = "https://queue.fal.run/fal-ai/kling-video";
export async function boundedBytes(response: Response, limit: number) {
  if (
    !response.body ||
    Number(response.headers.get("content-length")) > limit
  ) {
    await response.body?.cancel();
    throw new Error("Invalid response size");
  }
  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.length;
      if (size > limit) throw new Error("Response too large");
      chunks.push(value);
    }
    return Buffer.concat(chunks);
  } finally {
    await reader.cancel().catch(() => {});
    reader.releaseLock();
  }
}
export const providerJson = async (response: Response) =>
  JSON.parse((await boundedBytes(response, 512_000)).toString("utf8"));
function authHeaders() {
  if (!process.env.FAL_KEY) throw new ProviderError(false, "NOT_CONFIGURED");
  return {
    Authorization: `Key ${process.env.FAL_KEY}`,
    "Content-Type": "application/json",
  };
}
export async function submitFal(
  endpoint: string,
  input: Record<string, unknown>,
  webhookUrl: string,
) {
  const headers = authHeaders();
  if (
    !/^fal-ai\/kling-video\/v3\/standard\/(image-to-video|motion-control)$/.test(
      endpoint,
    )
  )
    throw new ProviderError(false, "INVALID_FEATURE");
  let response: Response;
  try {
    // A single billable submission. Even a lost response must never trigger another POST.
    response = await fetch(
      `https://queue.fal.run/${endpoint}?fal_webhook=${encodeURIComponent(webhookUrl)}`,
      {
        method: "POST",
        headers: {
          ...headers,
          "X-Fal-No-Retry": "1",
          "X-Fal-Request-Timeout": "1800",
          // Retain the queue result for recovery, then explicitly delete the payload after saving.
          "X-Fal-Object-Lifecycle-Preference": JSON.stringify({
            expiration_duration_seconds: 86400,
            initial_acl: { default: "forbid" },
          }),
        },
        body: JSON.stringify(input),
        cache: "no-store",
        redirect: "error",
        signal: AbortSignal.timeout(25_000),
      },
    );
  } catch {
    throw new ProviderError(true, "CONNECTION_UNCERTAIN");
  }
  if (!response.ok) {
    await response.body?.cancel();
    throw new ProviderError(
      response.status >= 500 || response.status === 408,
      response.status === 429 ? "PROVIDER_BUSY" : "PROVIDER_REJECTED",
    );
  }
  try {
    const data = await providerJson(response);
    return { data, requestId: null };
  } catch {
    throw new ProviderError(true, "INVALID_PROVIDER_RESPONSE");
  }
}
export function queueUrl(requestId: string, kind: "status" | "result") {
  if (!/^[a-zA-Z0-9_-]{8,128}$/.test(requestId))
    throw new Error("Invalid request ID");
  // Queue GETs use the base model ID, excluding the inference subpath.
  return `${QUEUE_ROOT}/requests/${requestId}${kind === "status" ? "/status" : ""}`;
}
export async function readQueue(requestId: string, kind: "status" | "result") {
  const response = await fetch(queueUrl(requestId, kind), {
    headers: authHeaders(),
    cache: "no-store",
    redirect: "error",
    signal: AbortSignal.timeout(20_000),
  });
  if (!response.ok) {
    await response.body?.cancel();
    throw new Error("Queue temporarily unavailable");
  }
  return providerJson(response);
}
export function videoOutputUrl(data: unknown): string {
  const value = (data as { video?: { url?: unknown } })?.video?.url;
  if (typeof value !== "string") throw new Error("Missing video");
  const url = new URL(value);
  // No arbitrary host, redirects or credentials; never send a CDN token to a third party.
  if (
    url.protocol !== "https:" ||
    url.hostname !== "v3b.fal.media" ||
    url.port ||
    url.username ||
    url.password ||
    url.search ||
    url.hash ||
    !/^\/files\/b\/[a-zA-Z0-9_-]+\/[a-zA-Z0-9_.-]+$/.test(url.pathname)
  )
    throw new Error("Unreviewed video URL");
  return url.href;
}
export async function downloadFalVideo(data: unknown) {
  const url = videoOutputUrl(data);
  const response = await fetch(
    "https://rest.fal.ai/storage/auth/token?storage_type=fal-cdn-v3",
    {
      method: "POST",
      headers: authHeaders(),
      body: JSON.stringify({ expiration_seconds: 300 }),
      cache: "no-store",
      redirect: "error",
      signal: AbortSignal.timeout(10_000),
    },
  );
  if (!response.ok) {
    await response.body?.cancel();
    throw new Error("CDN authentication unavailable");
  }
  const { token } = await providerJson(response);
  if (typeof token !== "string" || token.length > 16000 || /[\r\n]/.test(token))
    throw new Error("Invalid CDN token");
  const file = await fetch(url, {
    headers: { Authorization: `Bearer ${token}` },
    cache: "no-store",
    redirect: "error",
    signal: AbortSignal.timeout(45_000),
  });
  if (!file.ok) {
    await file.body?.cancel();
    throw new Error("Video unavailable");
  }
  return boundedBytes(file, 50_000_000);
}

export async function deleteFalPayload(requestId: string) {
  queueUrl(requestId, "result");
  const response = await fetch(
    `https://api.fal.ai/v1/models/requests/${requestId}/payloads`,
    {
      method: "DELETE",
      headers: {
        ...authHeaders(),
        "Idempotency-Key": `editingapp-cleanup-${requestId}`,
      },
      redirect: "error",
      cache: "no-store",
      signal: AbortSignal.timeout(10_000),
    },
  );
  if (!response.ok) {
    await response.body?.cancel();
    return false;
  }
  const data = await providerJson(response);
  return (
    Array.isArray(data.cdn_delete_results) &&
    data.cdn_delete_results.every(
      (r: { exception?: unknown }) => r.exception === null,
    )
  );
}
