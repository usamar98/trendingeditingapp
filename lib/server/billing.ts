import "server-only";
import type Stripe from "stripe";
import { admin } from "./supabase";
import { ensureAccount } from "./account";
import { appUrl } from "./config";
import {
  stripeClient,
  stripePriceId,
  requireBilling,
  validatePrice,
  stripeId,
  identifyPrice,
} from "./stripe";
import {
  planCredits,
  planAmount,
  type PlanId,
  type BillingInterval,
} from "@/lib/plans";
import { AppError } from "@/lib/errors";

const returnUrl = (query = "") => new URL(`/account${query}`, appUrl()).href;
export async function checkout(
  user: { id: string; email?: string },
  plan: PlanId,
  interval: BillingInterval,
) {
  requireBilling();
  await ensureAccount(user.id);
  const stripe = stripeClient();
  const db = admin();
  const priceId = stripePriceId(plan, interval)!;
  validatePrice(await stripe.prices.retrieve(priceId), plan, interval);
  const profile = await db
    .from("account_profiles")
    .select("stripe_customer_id")
    .eq("user_id", user.id)
    .single();
  if (profile.error) throw profile.error;
  let customerId = profile.data.stripe_customer_id as string | null;
  if (!customerId) {
    const customer = await stripe.customers.create(
      { email: user.email, metadata: { editingapp_user_id: user.id } },
      { idempotencyKey: `editingapp-customer-v1:${user.id}` },
    );
    const saved = await db
      .from("account_profiles")
      .update({ stripe_customer_id: customer.id })
      .eq("user_id", user.id)
      .is("stripe_customer_id", null);
    if (saved.error) throw saved.error;
    const current = await db
      .from("account_profiles")
      .select("stripe_customer_id")
      .eq("user_id", user.id)
      .single();
    if (current.error || !current.data.stripe_customer_id)
      throw new Error("Customer mapping unavailable");
    customerId = current.data.stripe_customer_id;
  }
  // Check Stripe too: invoice/subscription webhooks can arrive after the checkout return.
  const subscriptions = await stripe.subscriptions.list({
    customer: customerId!,
    status: "all",
    limit: 100,
  });
  if (
    subscriptions.has_more ||
    subscriptions.data.some(
      (subscription) =>
        !["canceled", "incomplete_expired"].includes(subscription.status),
    )
  )
    throw new AppError(
      "SUBSCRIBED",
      "You already have a subscription. Manage it from your account.",
      409,
    );
  const reserved = await db.rpc("reserve_billing_checkout", {
    p_user: user.id,
    p_plan: plan,
    p_interval: interval,
  });
  if (reserved.error) {
    if (reserved.error.message.includes("CHECKOUT_PENDING"))
      throw new AppError(
        "CHECKOUT_PENDING",
        "Another plan checkout is still open. Finish it or wait for it to expire before choosing a different plan.",
        409,
      );
    if (reserved.error.message.includes("SUBSCRIBED"))
      throw new AppError(
        "SUBSCRIBED",
        "Manage your existing subscription from your account.",
        409,
      );
    if (reserved.error.message.includes("BILLING_HOLD"))
      throw new AppError(
        "BILLING_HOLD",
        "Your billing account needs review.",
        403,
      );
    throw reserved.error;
  }
  const attempt = reserved.data as {
    attempt_id: string;
    expires_at: string;
    session_id: string | null;
    url: string | null;
  };
  if (attempt.session_id) {
    const existing = await stripe.checkout.sessions.retrieve(
      attempt.session_id,
    );
    if (existing.status === "complete")
      throw new AppError(
        "PAYMENT_PENDING",
        "Your checkout is complete. Open your account while payment confirmation arrives.",
        409,
      );
    if (existing.status === "open" && existing.url)
      return { url: existing.url };
    throw new AppError(
      "CHECKOUT_EXPIRED",
      "That checkout has expired. Please try again after its reservation expires.",
      409,
    );
  }
  const session = await stripe.checkout.sessions.create(
    {
      mode: "subscription",
      customer: customerId!,
      client_reference_id: user.id,
      line_items: [{ price: priceId, quantity: 1 }],
      subscription_data: {
        metadata: {
          editingapp_user_id: user.id,
          plan_id: plan,
          interval,
          credits_version: "1",
        },
      },
      metadata: { editingapp_user_id: user.id, plan_id: plan, interval },
      success_url: returnUrl("?checkout=complete"),
      cancel_url: new URL("/pricing?checkout=canceled", appUrl()).href,
      expires_at: Math.floor(new Date(attempt.expires_at).getTime() / 1000),
      allow_promotion_codes: false,
      payment_method_types: ["card"],
      custom_text: {
        submit: {
          message: `${planCredits(plan, interval).toLocaleString("en-US")} credits issued after payment for this ${interval === "year" ? "annual" : "monthly"} period. Unused credits expire at the period end. Subscription renews until canceled.`,
        },
      },
    },
    { idempotencyKey: `editingapp-checkout-v1:${attempt.attempt_id}` },
  );
  if (!session.url || new URL(session.url).hostname !== "checkout.stripe.com")
    throw new Error("Checkout URL unavailable");
  const saved = await db
    .from("billing_checkouts")
    .update({ session_id: session.id, url: session.url })
    .eq("user_id", user.id)
    .eq("attempt_id", attempt.attempt_id);
  if (saved.error) throw saved.error;
  return { url: session.url };
}

export async function billingPortal(userId: string) {
  requireBilling();
  const profile = await admin()
    .from("account_profiles")
    .select("stripe_customer_id")
    .eq("user_id", userId)
    .single();
  if (profile.error) throw profile.error;
  if (!profile.data.stripe_customer_id)
    throw new AppError(
      "NO_SUBSCRIPTION",
      "Choose a plan before opening billing management.",
      400,
    );
  const portal = await stripeClient().billingPortal.sessions.create({
    customer: profile.data.stripe_customer_id,
    configuration: process.env.STRIPE_PORTAL_CONFIGURATION_ID!,
    return_url: returnUrl(),
  });
  return { url: portal.url };
}

async function customerOwner(customer: string) {
  const result = await admin()
    .from("account_profiles")
    .select("user_id")
    .eq("stripe_customer_id", customer)
    .maybeSingle();
  if (result.error) throw result.error;
  return result.data?.user_id as string | undefined;
}

export async function syncSubscription(id: string, created: number) {
  const subscription = await stripeClient().subscriptions.retrieve(id);
  const customer = stripeId(subscription.customer);
  const user = customer && (await customerOwner(customer));
  if (!user || subscription.metadata.editingapp_user_id !== user) return;
  const item = subscription.items.data[0];
  const plan = item && identifyPrice(item.price.id);
  if (!plan || subscription.items.data.length !== 1 || item.quantity !== 1)
    throw new Error("Unsupported subscription plan");
  const { error } = await admin().rpc("sync_billing_subscription", {
    p_id: id,
    p_user: user,
    p_plan: plan.plan,
    p_interval: plan.interval,
    p_status: subscription.status,
    p_end: new Date(item.current_period_end * 1000).toISOString(),
    p_cancel: subscription.cancel_at_period_end,
    p_event_created: created,
  });
  if (error) throw error;
}

export async function processStripeEvent(event: Stripe.Event) {
  const stripe = stripeClient();
  if (event.type === "invoice.paid") {
    // Read the canonical object and all invoice lines. Do not trust browser redirects or invoice metadata alone.
    const invoice = await stripe.invoices.retrieve(event.data.object.id);
    const customer = stripeId(invoice.customer);
    const user = customer && (await customerOwner(customer));
    if (!user) return;
    const subscriptionId = stripeId(
      invoice.parent?.subscription_details?.subscription,
    );
    if (
      !subscriptionId ||
      invoice.status !== "paid" ||
      invoice.currency !== "usd" ||
      !["subscription_create", "subscription_cycle"].includes(
        invoice.billing_reason || "",
      )
    )
      return;
    const subscription = await stripe.subscriptions.retrieve(subscriptionId);
    if (
      subscription.metadata.editingapp_user_id !== user ||
      stripeId(subscription.customer) !== customer
    )
      throw new Error("Invoice ownership mismatch");
    const lines = await stripe.invoices.listLineItems(invoice.id!, {
      limit: 100,
    });
    if (lines.has_more || lines.data.length !== 1)
      throw new Error("Unsupported invoice lines");
    const line = lines.data[0];
    const price = stripeId(line.pricing?.price_details?.price);
    const plan = price && identifyPrice(price);
    if (
      !plan ||
      line.quantity !== 1 ||
      line.parent?.subscription_item_details?.proration ||
      line.amount !== planAmount(plan.plan, plan.interval) ||
      invoice.amount_paid < planAmount(plan.plan, plan.interval) ||
      line.period.end <= line.period.start
    )
      throw new Error("Invoice does not match a complete paid plan period");
    const applied = await admin().rpc("apply_paid_invoice", {
      p_event: event.id,
      p_invoice: invoice.id,
      p_user: user,
      p_customer: customer,
      p_subscription: subscriptionId,
      p_plan: plan.plan,
      p_interval: plan.interval,
      p_credits: planCredits(plan.plan, plan.interval),
      p_start: new Date(line.period.start * 1000).toISOString(),
      p_end: new Date(line.period.end * 1000).toISOString(),
    });
    if (applied.error) throw applied.error;
    await syncSubscription(subscriptionId, event.created);
  } else if (
    event.type === "customer.subscription.created" ||
    event.type === "customer.subscription.updated" ||
    event.type === "customer.subscription.deleted"
  ) {
    await syncSubscription(event.data.object.id, event.created);
  } else if (event.type === "invoice.payment_failed") {
    const invoice = await stripe.invoices.retrieve(event.data.object.id);
    const subscription = stripeId(
      invoice.parent?.subscription_details?.subscription,
    );
    if (subscription) await syncSubscription(subscription, event.created);
  } else if (
    event.type === "charge.refunded" ||
    event.type === "charge.dispute.created"
  ) {
    const id =
      event.type === "charge.refunded"
        ? event.data.object.id
        : stripeId(event.data.object.charge);
    if (!id) return;
    const charge = await stripe.charges.retrieve(id);
    const customer = stripeId(charge.customer);
    if (!customer || !(await customerOwner(customer))) return;
    // Hold generation until the operator reconciles refunded/disputed credits, including already-spent credits.
    const result = await admin().rpc("hold_billing_account", {
      p_event: event.id,
      p_customer: customer,
      p_type: event.type,
    });
    if (result.error) throw result.error;
  }
}
