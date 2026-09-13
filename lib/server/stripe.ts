import "server-only";
import Stripe from "stripe";
import { creditsEnabled } from "./config";
import { AppError } from "@/lib/errors";
import { type BillingInterval, type PlanId, planAmount } from "@/lib/plans";

export function billingConfigured() {
  return Boolean(
    creditsEnabled() &&
    process.env.STRIPE_SECRET_KEY &&
    process.env.STRIPE_WEBHOOK_SECRET,
  );
}
export function stripeClient() {
  if (!process.env.STRIPE_SECRET_KEY)
    throw new AppError(
      "BILLING_SETUP",
      "Payments are not available yet. Please try again later.",
      503,
    );
  return new Stripe(process.env.STRIPE_SECRET_KEY, {
    apiVersion: "2026-08-26.dahlia",
    maxNetworkRetries: 1,
    timeout: 20000,
  });
}
export function requireBilling() {
  if (!billingConfigured())
    throw new AppError(
      "BILLING_SETUP",
      "Payments are not available yet. No charge has been made.",
      503,
    );
}
export function validatePrice(
  price: Stripe.Price,
  plan: PlanId,
  interval: BillingInterval,
  purchasing = true,
) {
  if (
    (purchasing && !price.active) ||
    price.currency !== "usd" ||
    price.unit_amount !== planAmount(plan, interval) ||
    price.type !== "recurring" ||
    price.recurring?.interval !== interval ||
    price.recurring?.interval_count !== 1 ||
    price.recurring?.usage_type !== "licensed" ||
    price.billing_scheme !== "per_unit" ||
    price.transform_quantity
  ) {
    throw new AppError(
      "BILLING_SETUP",
      "This plan is being updated. Please try again later. No charge has been made.",
      503,
    );
  }
}
export const stripeId = (value: string | { id: string } | null | undefined) =>
  typeof value === "string" ? value : value?.id;
