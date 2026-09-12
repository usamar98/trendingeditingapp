import "server-only";
import { ProviderError } from "./errors";

const MAX_RESPONSE_BYTES = 32_000_000;

async function boundedJson(response: Response): Promise<unknown> {
  if (!response.body) throw new Error("Missing response");
  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  try {
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      size += value.length;
      if (size > MAX_RESPONSE_BYTES) throw new Error("Response too large");
      chunks.push(value);
    }
    return JSON.parse(Buffer.concat(chunks).toString("utf8"));
  } finally {
    await reader.cancel().catch(() => undefined);
    reader.releaseLock();
  }
}

/** Server-only shared transport. Call through the registry, never a client-supplied endpoint. */
export async function runFal(endpoint: string, input: Record<string, unknown>) {
  if (!process.env.FAL_KEY) throw new ProviderError(false, "NOT_CONFIGURED");
  if (!/^[a-z0-9-]+(?:\/[a-z0-9._-]+)+$/.test(endpoint))
    throw new ProviderError(false, "INVALID_FEATURE");

  let response: Response;
  try {
    // One direct POST. Native fetch avoids the fal SDK's automatic retries.
    // Both photo directions use data URIs; no public selfie URL or upload API.
    response = await fetch(`https://fal.run/${endpoint}`, {
      method: "POST",
      headers: {
        Authorization: `Key ${process.env.FAL_KEY}`,
        "Content-Type": "application/json",
        "X-Fal-No-Retry": "1",
        "X-Fal-Store-IO": "0",
        "X-Fal-Object-Lifecycle-Preference": JSON.stringify({
          expiration_duration_seconds: 3600,
          initial_acl: { default: "forbid" },
        }),
      },
      body: JSON.stringify(input),
      signal: AbortSignal.timeout(180_000),
      cache: "no-store",
      redirect: "error",
    });
  } catch {
    throw new ProviderError(true, "CONNECTION_UNCERTAIN");
  }
  if (!response.ok) {
    await response.body?.cancel().catch(() => undefined);
    throw new ProviderError(
      response.status >= 500 || response.status === 408,
      response.status === 429 ? "PROVIDER_BUSY" : "PROVIDER_REJECTED",
    );
  }
  try {
    return {
      data: await boundedJson(response),
      requestId:
        response.headers.get("x-fal-request-id") ??
        response.headers.get("x-request-id"),
    };
  } catch {
    throw new ProviderError(true, "INVALID_PROVIDER_RESPONSE");
  }
}
