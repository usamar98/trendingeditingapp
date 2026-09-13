import "server-only";
import {
  createHash,
  createHmac,
  createPublicKey,
  timingSafeEqual,
  verify,
} from "node:crypto";
import { providerJson } from "./fal-queue";
import { appUrl } from "../config";

export function webhookToken(jobId: string) {
  if (!process.env.FAL_KEY) throw new Error("Missing fal key");
  return createHmac("sha256", process.env.FAL_KEY)
    .update(`editingapp-video-v1:${jobId}`)
    .digest("hex");
}
export function videoWebhookUrl(jobId: string) {
  const url = new URL("/api/videos/webhook", appUrl());
  url.searchParams.set("job", jobId);
  url.searchParams.set("token", webhookToken(jobId));
  return url.href;
}
export function validWebhookToken(jobId: string, token: string) {
  if (!/^[a-f0-9]{64}$/.test(token)) return false;
  return timingSafeEqual(
    Buffer.from(token, "hex"),
    Buffer.from(webhookToken(jobId), "hex"),
  );
}
let cached: { until: number; keys: { x: string }[] } | null = null;
export async function verifyFalWebhook(headers: Headers, body: Buffer) {
  const id = headers.get("x-fal-webhook-request-id"),
    user = headers.get("x-fal-webhook-user-id"),
    time = headers.get("x-fal-webhook-timestamp"),
    signature = headers.get("x-fal-webhook-signature");
  if (
    !id ||
    !user ||
    !time ||
    !signature ||
    !/^\d{10,12}$/.test(time) ||
    Math.abs(Date.now() / 1000 - Number(time)) > 300 ||
    !/^[a-fA-F0-9]{128}$/.test(signature)
  )
    return false;
  if (!cached || cached.until < Date.now()) {
    const response = await fetch("https://rest.fal.ai/.well-known/jwks.json", {
      signal: AbortSignal.timeout(10_000),
      redirect: "error",
      cache: "no-store",
    });
    if (!response.ok) throw new Error("Webhook keys unavailable");
    const data = await providerJson(response);
    if (!Array.isArray(data.keys) || !data.keys.length || data.keys.length > 20)
      throw new Error("Invalid webhook keys");
    cached = { until: Date.now() + 3_600_000, keys: data.keys };
  }
  const message = Buffer.from(
    [id, user, time, createHash("sha256").update(body).digest("hex")].join(
      "\n",
    ),
  );
  return cached.keys.some((key) => {
    try {
      return verify(
        null,
        message,
        createPublicKey({
          key: { kty: "OKP", crv: "Ed25519", x: key.x },
          format: "jwk",
        }),
        Buffer.from(signature, "hex"),
      );
    } catch {
      return false;
    }
  });
}
