import "server-only";
import { createHash } from "node:crypto";
import type Stripe from "stripe";
import {
  PLANS,
  findPlan,
  planAmount,
  type PlanId,
  type BillingInterval,
} from "@/lib/plans";
import { stripeId, validatePrice } from "./stripe";
import { AppError } from "@/lib/errors";

// Stable identifiers match objects created by the original setup script.
// Bump this version deliberately when changing the plan's billing contract.
const VERSION = "1";
const TAG = "credits-v1";
export const productId = (plan: PlanId) => `editingapp_${plan}_v${VERSION}`;
export const priceLookupKey = (plan: PlanId, interval: BillingInterval) =>
  `${productId(plan)}_${interval}`;
function setupError() {
  return new AppError(
    "BILLING_SETUP",
    "This plan is being configured. Please try again shortly. No charge has been made.",
    503,
  );
}
function missing(error: unknown) {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    error.code === "resource_missing"
  );
}
function checkProduct(
  product: Stripe.Product | Stripe.DeletedProduct,
  plan: PlanId,
) {
  if (
    product.deleted ||
    !product.active ||
    product.id !== productId(plan) ||
    product.metadata.editingapp !== TAG ||
    product.metadata.plan_id !== plan
  )
    throw setupError();
}
async function ensureProduct(stripe: Stripe, plan: PlanId) {
  let product: Stripe.Product | Stripe.DeletedProduct;
  try {
    product = await stripe.products.retrieve(productId(plan));
  } catch (error) {
    if (!missing(error)) throw error;
    try {
      product = await stripe.products.create(
        {
          id: productId(plan),
          name: `EditingApp ${findPlan(plan)!.name}`,
          description: findPlan(plan)!.description,
          metadata: { editingapp: TAG, plan_id: plan },
        },
        { idempotencyKey: `setup:${productId(plan)}` },
      );
    } catch (creationError) {
      // Another instance may have created it, or its response may have been lost.
      // Recover by reading the deterministic ID, never by creating a second product.
      try {
        product = await stripe.products.retrieve(productId(plan));
      } catch {
        throw creationError;
      }
    }
  }
  checkProduct(product, plan);
  return product.id;
}
function checkPrice(
  price: Stripe.Price,
  plan: PlanId,
  interval: BillingInterval,
  purchasing: boolean,
) {
  validatePrice(price, plan, interval, purchasing);
  const identified =
    price.lookup_key === priceLookupKey(plan, interval) ||
    (!purchasing &&
      price.metadata.plan_id === plan &&
      price.metadata.credits_version === VERSION);
  if (stripeId(price.product) !== productId(plan) || !identified)
    throw setupError();
}
async function lookupPrice(
  stripe: Stripe,
  plan: PlanId,
  interval: BillingInterval,
) {
  const options = { lookup_keys: [priceLookupKey(plan, interval)], limit: 2 };
  const active = await stripe.prices.list({ ...options, active: true });
  if (active.has_more || active.data.length > 1) throw setupError();
  if (active.data[0]) return active.data[0];
  // An archived configured price should stop new sales, not silently be replaced.
  const archived = await stripe.prices.list({ ...options, active: false });
  if (archived.has_more || archived.data.length) throw setupError();
  return null;
}

/** Lazy provisioning happens only during an authenticated checkout, never on page load. */
export async function resolvePlanPrice(
  stripe: Stripe,
  plan: PlanId,
  interval: BillingInterval,
) {
  const product = await ensureProduct(stripe, plan);
  let price = await lookupPrice(stripe, plan, interval);
  if (!price) {
    const lookup = priceLookupKey(plan, interval);
    try {
      price = await stripe.prices.create(
        {
          product,
          currency: "usd",
          unit_amount: planAmount(plan, interval),
          recurring: { interval },
          lookup_key: lookup,
          metadata: { plan_id: plan, credits_version: VERSION },
        },
        { idempotencyKey: `setup:${lookup}` },
      );
    } catch (creationError) {
      // Resolve a concurrent creation or lost response by its unique lookup key.
      // Keep the same idempotency key on subsequent requests; never mint a new one.
      try {
        price = await lookupPrice(stripe, plan, interval);
      } catch {
        throw creationError;
      }
      if (!price) throw creationError;
    }
  }
  checkPrice(price, plan, interval, true);
  return price.id;
}

/** Webhooks are read-only with respect to catalog objects and identify the canonical price. */
export async function identifyPrice(stripe: Stripe, id: string) {
  const price = await stripe.prices.retrieve(id);
  if (price.id !== id) throw setupError();
  for (const plan of PLANS) {
    if (stripeId(price.product) !== productId(plan.id)) continue;
    for (const interval of ["month", "year"] as const) {
      if (price.recurring?.interval !== interval) continue;
      checkPrice(price, plan.id, interval, false);
      return { plan: plan.id, interval };
    }
  }
  return null;
}

/** Portal IDs remain in Stripe; deployments need no configuration-ID environment variable. */
export async function resolvePortalConfiguration(
  stripe: Stripe,
  origin: string,
) {
  const options: Stripe.BillingPortal.ConfigurationCreateParams = {
    business_profile: {
      headline: "Manage your EditingApp subscription",
      privacy_policy_url: `${origin}/privacy`,
      terms_of_service_url: `${origin}/terms`,
    },
    default_return_url: `${origin}/account`,
    features: {
      customer_update: { enabled: false },
      invoice_history: { enabled: true },
      payment_method_update: { enabled: true },
      subscription_cancel: { enabled: true, mode: "at_period_end" },
      subscription_update: { enabled: false },
    },
    metadata: { editingapp: TAG },
  };
  const list = await stripe.billingPortal.configurations.list({ limit: 100 });
  if (list.has_more) throw setupError();
  const existing = list.data.find((item) => item.metadata?.editingapp === TAG);
  if (existing) {
    // Ensure older dashboard settings cannot enable unsupported prorated upgrades.
    const updated = await stripe.billingPortal.configurations.update(
      existing.id,
      { ...options, active: true },
    );
    return updated.id;
  }
  const config = await stripe.billingPortal.configurations.create(options, {
    idempotencyKey: `editingapp-portal-v1:${createHash("sha256").update(origin).digest("hex").slice(0, 24)}`,
  });
  return config.id;
}
