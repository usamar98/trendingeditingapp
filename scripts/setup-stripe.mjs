// Creates billing configuration, never customers, subscriptions or charges.
// All secrets are written to an ignored local file, never printed.
import Stripe from "stripe";
import { writeFile } from "node:fs/promises";
import { PLANS } from "../lib/plans.ts";

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
const config = {};
for (const plan of PLANS) {
  const productId = `editingapp_${plan.id}_v1`;
  let product;
  try {
    product = await stripe.products.retrieve(productId);
  } catch (error) {
    if (error.code !== "resource_missing") throw error;
  }
  if (!product)
    product = await stripe.products.create(
      {
        id: productId,
        name: `EditingApp ${plan.name}`,
        description: plan.description,
        metadata: { editingapp: "credits-v1", plan_id: plan.id },
      },
      { idempotencyKey: `setup:${productId}` },
    );
  if (!product.active || product.deleted)
    throw new Error(
      `Product ${productId} is inactive. Review it in Stripe before continuing.`,
    );
  for (const interval of ["month", "year"]) {
    const lookup = `${productId}_${interval}`;
    const amount = interval === "year" ? plan.yearlyCents : plan.monthlyCents;
    const existing = await stripe.prices.list({
      lookup_keys: [lookup],
      limit: 2,
    });
    let price = existing.data[0];
    if (!price)
      price = await stripe.prices.create(
        {
          product: product.id,
          currency: "usd",
          unit_amount: amount,
          recurring: { interval },
          lookup_key: lookup,
          metadata: { plan_id: plan.id, credits_version: "1" },
        },
        { idempotencyKey: `setup:${lookup}` },
      );
    if (
      existing.data.length > 1 ||
      !price.active ||
      price.product !== product.id ||
      price.currency !== "usd" ||
      price.unit_amount !== amount ||
      price.recurring?.interval !== interval ||
      price.recurring?.interval_count !== 1 ||
      price.recurring?.usage_type !== "licensed" ||
      price.billing_scheme !== "per_unit" ||
      price.transform_quantity
    )
      throw new Error(
        `Price ${lookup} differs from the application. Review it manually; it was not changed.`,
      );
    config[`STRIPE_PRICE_${plan.id.toUpperCase()}_${interval.toUpperCase()}`] =
      price.id;
  }
}
const portals = await stripe.billingPortal.configurations.list({ limit: 100 });
if (portals.has_more)
  throw new Error(
    "More than 100 portal configurations; select a configuration manually.",
  );
const existingPortal = portals.data.find(
  (item) => item.metadata?.editingapp === "credits-v1",
);
const portalOptions = {
  business_profile: {
    headline: "Manage your EditingApp subscription",
    privacy_policy_url: `${origin.origin}/privacy`,
    terms_of_service_url: `${origin.origin}/terms`,
  },
  default_return_url: `${origin.origin}/account`,
  features: {
    customer_update: { enabled: false },
    invoice_history: { enabled: true },
    payment_method_update: { enabled: true },
    subscription_cancel: { enabled: true, mode: "at_period_end" },
    subscription_update: { enabled: false },
  },
  metadata: { editingapp: "credits-v1" },
};
const portal = existingPortal
  ? await stripe.billingPortal.configurations.update(
      existingPortal.id,
      portalOptions,
    )
  : await stripe.billingPortal.configurations.create(portalOptions, {
      idempotencyKey: "setup:editingapp-portal-v1",
    });
config.STRIPE_PORTAL_CONFIGURATION_ID = portal.id;
const events = [
  "invoice.paid",
  "invoice.payment_failed",
  "customer.subscription.created",
  "customer.subscription.updated",
  "customer.subscription.deleted",
  "charge.refunded",
  "charge.dispute.created",
];
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
    if (process.env.STRIPE_WEBHOOK_SECRET)
      config.STRIPE_WEBHOOK_SECRET = process.env.STRIPE_WEBHOOK_SECRET;
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
    if (endpoint.secret) config.STRIPE_WEBHOOK_SECRET = endpoint.secret;
  }
}
const lines = [
  "# Server-only generated Stripe IDs. Add STRIPE_SECRET_KEY separately.",
  ...Object.entries(config).map(([name, value]) => `${name}=${value}`),
];
if (!config.STRIPE_WEBHOOK_SECRET)
  lines.push(
    "# Copy the endpoint signing secret from Stripe or the local Stripe CLI.",
    "# STRIPE_WEBHOOK_SECRET=",
  );
await writeFile(".env.stripe.generated", lines.join("\n") + "\n", {
  mode: 0o600,
});
console.log(
  "Created or verified 3 products, 6 prices and the billing portal. Configuration saved in .env.stripe.generated (Git-ignored). No customer was charged.",
);
if (!config.STRIPE_WEBHOOK_SECRET)
  console.log(
    "The webhook signing secret is still needed. Copy it from Stripe into server environment variables; it cannot be retrieved from an existing endpoint by API.",
  );
