// Optional webhook setup. Products, prices and portal configuration are automatic.
// No customers, subscriptions or charges are created. Secrets never print to stdout.
import Stripe from "stripe";
import { writeFile } from "node:fs/promises";

const key = process.env.STRIPE_SECRET_KEY;
if (!key)
  throw new Error(
    "Set STRIPE_SECRET_KEY in .env.local first. Use a test key for verification.",
  );
const origin = new URL(process.env.APP_URL || "http://localhost:3001");
if (
  origin.username ||
  origin.password ||
  origin.pathname !== "/" ||
  origin.search ||
  origin.hash ||
  !["https:", "http:"].includes(origin.protocol)
)
  throw new Error("APP_URL must be an HTTP(S) origin.");
const stripe = new Stripe(key, {
  apiVersion: "2026-08-26.dahlia",
  maxNetworkRetries: 2,
  timeout: 30000,
});
const events = [
  "invoice.paid",
  "invoice.payment_failed",
  "customer.subscription.created",
  "customer.subscription.updated",
  "customer.subscription.deleted",
  "charge.refunded",
  "charge.dispute.created",
];
let secret = process.env.STRIPE_WEBHOOK_SECRET;
if (origin.protocol === "https:") {
  const url = `${origin.origin}/api/billing/webhook`;
  const endpoints = await stripe.webhookEndpoints.list({ limit: 100 });
  if (endpoints.has_more)
    throw new Error(
      "More than 100 webhook endpoints; configure the endpoint manually.",
    );
  const existing = endpoints.data.find((item) => item.url === url);
  if (existing) {
    if (
      existing.api_version !== "2026-08-26.dahlia" ||
      existing.status !== "enabled" ||
      events.some(
        (event) =>
          !existing.enabled_events.includes(event) &&
          !existing.enabled_events.includes("*"),
      )
    )
      throw new Error(
        "Existing webhook settings differ. Set the documented API version and events in Stripe.",
      );
  } else {
    const endpoint = await stripe.webhookEndpoints.create(
      {
        url,
        enabled_events: events,
        api_version: "2026-08-26.dahlia",
        description: "EditingApp credits and subscriptions",
      },
      { idempotencyKey: `setup:editingapp-webhook-v1:${origin.origin}` },
    );
    secret = endpoint.secret;
  }
}
await writeFile(
  ".env.stripe.generated",
  secret
    ? `# Server-only webhook signing secret. Keep out of Git.\nSTRIPE_WEBHOOK_SECRET=${secret}\n`
    : "# Copy the endpoint signing secret from Stripe or the local Stripe CLI.\n# STRIPE_WEBHOOK_SECRET=\n",
  { mode: 0o600 },
);
console.log(
  "Webhook settings saved to .env.stripe.generated (Git-ignored). Products, prices and the portal configure automatically when needed; no extra ID variables are required. No customer was charged.",
);
if (!secret)
  console.log(
    "Copy the signing secret from the existing Stripe endpoint or local Stripe CLI. Existing endpoint secrets cannot be retrieved by API.",
  );
