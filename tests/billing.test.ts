import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import Stripe from "stripe";
import { PLANS, planCredits, planAmount } from "@/lib/plans";
const mock = vi.hoisted(() => ({
  rpc: vi.fn(),
  single: vi.fn(),
  maybeSingle: vi.fn(),
  user: vi.fn(),
  ensure: vi.fn(),
  client: vi.fn(),
  prices: vi.fn(),
  listPrices: vi.fn(),
  product: vi.fn(),
  customers: vi.fn(),
  subscriptions: vi.fn(),
  listSubscriptions: vi.fn(),
  invoices: vi.fn(),
  lines: vi.fn(),
  checkout: vi.fn(),
  getCheckout: vi.fn(),
  portal: vi.fn(),
  charges: vi.fn(),
}));
vi.mock("@/lib/server/supabase", () => ({
  requireUser: mock.user,
  admin: () => {
    const q = {
      select: vi.fn(() => q),
      eq: vi.fn(() => q),
      is: vi.fn(() => q),
      update: vi.fn(() => q),
      single: mock.single,
      maybeSingle: mock.maybeSingle,
      then: (resolve: (value: { error: null }) => unknown) =>
        Promise.resolve({ error: null }).then(resolve),
    };
    return { from: () => q, rpc: mock.rpc };
  },
}));
vi.mock("@/lib/server/account", () => ({ ensureAccount: mock.ensure }));
vi.mock("@/lib/server/stripe", async (original) => ({
  ...(await original<typeof import("@/lib/server/stripe")>()),
  stripeClient: mock.client,
}));
import { checkout, processStripeEvent } from "@/lib/server/billing";
import { validatePrice, billingConfigured } from "@/lib/server/stripe";
import { POST as webhook } from "@/app/api/billing/webhook/route";
import { POST as checkoutRoute } from "@/app/api/billing/checkout/route";
const secret = "whsec_fixture_only_not_live";
const sdk = new Stripe("sk_test_fixture_only", {
  apiVersion: "2026-08-26.dahlia",
});
const end = Math.floor(Date.now() / 1000) + 86400 * 30;
const subscription = () => ({
  id: "sub_owned",
  customer: "cus_owned",
  metadata: { editingapp_user_id: "owner" },
  status: "active",
  cancel_at_period_end: false,
  items: {
    data: [
      {
        quantity: 1,
        price: { id: "price_starter_month" },
        current_period_end: end,
      },
    ],
  },
});
const invoice = () => ({
  id: "in_paid",
  customer: "cus_owned",
  currency: "usd",
  status: "paid",
  billing_reason: "subscription_cycle",
  amount_paid: 1900,
  parent: { subscription_details: { subscription: "sub_owned" } },
});
const line = () => ({
  quantity: 1,
  amount: 1900,
  pricing: { price_details: { price: "price_starter_month" } },
  parent: { subscription_item_details: { proration: false } },
  period: { start: end - 86400 * 30, end },
});
const price = () =>
  ({
    id: "price_starter_month",
    product: "editingapp_starter_v1",
    lookup_key: "editingapp_starter_v1_month",
    metadata: { plan_id: "starter", credits_version: "1" },
    active: true,
    currency: "usd",
    unit_amount: 1900,
    type: "recurring",
    recurring: { interval: "month", interval_count: 1, usage_type: "licensed" },
    billing_scheme: "per_unit",
    transform_quantity: null,
  }) as unknown as Stripe.Price;
const event = (type: string, id = "evt_fixture", object = { id: "in_paid" }) =>
  ({ id, type, created: 12345, data: { object } }) as unknown as Stripe.Event;
beforeEach(() => {
  Object.values(mock).forEach((fn) => fn.mockReset());
  vi.stubEnv("APP_URL", "http://localhost:3001");
  vi.stubEnv("CREDITS_ENABLED", "true");
  vi.stubEnv("SUPABASE_URL", "https://fixture.supabase.co");
  vi.stubEnv("SUPABASE_ANON_KEY", "fixture");
  vi.stubEnv("SUPABASE_SERVICE_ROLE_KEY", "fixture");
  vi.stubEnv("STRIPE_SECRET_KEY", "sk_test_fixture_only");
  vi.stubEnv("STRIPE_WEBHOOK_SECRET", secret);
  mock.user.mockResolvedValue({ id: "owner", email: "owner@example.test" });
  mock.ensure.mockResolvedValue(undefined);
  mock.single.mockResolvedValue({
    data: { stripe_customer_id: "cus_owned" },
    error: null,
  });
  mock.maybeSingle.mockResolvedValue({
    data: { user_id: "owner" },
    error: null,
  });
  mock.rpc.mockResolvedValue({ data: true, error: null });
  mock.prices.mockResolvedValue(price());
  mock.listPrices.mockResolvedValue({ data: [price()], has_more: false });
  mock.product.mockResolvedValue({
    id: "editingapp_starter_v1",
    active: true,
    metadata: { editingapp: "credits-v1", plan_id: "starter" },
  });
  mock.listSubscriptions.mockResolvedValue({ data: [], has_more: false });
  mock.subscriptions.mockResolvedValue(subscription());
  mock.invoices.mockResolvedValue(invoice());
  mock.lines.mockResolvedValue({ data: [line()], has_more: false });
  mock.checkout.mockResolvedValue({
    id: "cs_fixture",
    url: "https://checkout.stripe.com/c/pay/cs_fixture",
  });
  mock.getCheckout.mockResolvedValue({
    status: "open",
    url: "https://checkout.stripe.com/c/pay/cs_existing",
  });
  mock.client.mockReturnValue({
    webhooks: sdk.webhooks,
    prices: { retrieve: mock.prices, list: mock.listPrices },
    products: { retrieve: mock.product },
    customers: { create: mock.customers },
    subscriptions: {
      retrieve: mock.subscriptions,
      list: mock.listSubscriptions,
    },
    invoices: { retrieve: mock.invoices, listLineItems: mock.lines },
    checkout: {
      sessions: { create: mock.checkout, retrieve: mock.getCheckout },
    },
    billingPortal: { sessions: { create: mock.portal } },
    charges: { retrieve: mock.charges },
  });
});
afterEach(() => {
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});
describe("Stripe billing boundaries with simulated network", () => {
  it("enables billing with only secret and webhook keys after the credit migration flag", () => {
    expect(billingConfigured()).toBe(true);
    vi.stubEnv("STRIPE_WEBHOOK_SECRET", "");
    expect(billingConfigured()).toBe(false);
  });
  it("uses two free months annually and twelve months of credits", () => {
    expect(
      PLANS.map((p) => [
        planAmount(p.id, "month"),
        planAmount(p.id, "year"),
        planCredits(p.id, "year"),
      ]),
    ).toEqual([
      [1900, 19000, 7200],
      [3900, 39000, 16800],
      [10000, 100000, 48000],
    ]);
  });
  it("rejects wrong Stripe price currency, amount, recurrence or quantity transform", () => {
    expect(() => validatePrice(price(), "starter", "month")).not.toThrow();
    for (const change of [
      { currency: "eur" },
      { unit_amount: 1 },
      { active: false },
      { recurring: { interval: "year" } },
      { transform_quantity: { divide_by: 10, round: "up" } },
    ])
      expect(() =>
        validatePrice(
          { ...price(), ...change } as Stripe.Price,
          "starter",
          "month",
        ),
      ).toThrow();
  });
  it("grants only a canonical complete paid plan invoice owned by the account", async () => {
    await processStripeEvent(event("invoice.paid"));
    expect(mock.invoices).toHaveBeenCalledWith("in_paid");
    expect(mock.rpc).toHaveBeenCalledWith(
      "apply_paid_invoice",
      expect.objectContaining({
        p_invoice: "in_paid",
        p_user: "owner",
        p_customer: "cus_owned",
        p_credits: 600,
        p_plan: "starter",
        p_interval: "month",
        p_end: new Date(end * 1000).toISOString(),
      }),
    );
  });
  it("never grants credits for checkout completion, unpaid invoices or failed renewals", async () => {
    await processStripeEvent(event("checkout.session.completed"));
    mock.invoices.mockResolvedValue({
      ...invoice(),
      status: "open",
      amount_paid: 0,
    });
    await processStripeEvent(event("invoice.paid"));
    await processStripeEvent(event("invoice.payment_failed"));
    expect(
      mock.rpc.mock.calls.some((call) => call[0] === "apply_paid_invoice"),
    ).toBe(false);
  });
  it("rejects manipulated, prorated, incomplete and extra invoice lines", async () => {
    for (const bad of [
      { ...line(), amount: 1 },
      { ...line(), quantity: 2 },
      { ...line(), pricing: { price_details: { price: "price_unknown" } } },
      { ...line(), parent: { subscription_item_details: { proration: true } } },
    ]) {
      mock.lines.mockResolvedValue({ data: [bad], has_more: false });
      await expect(processStripeEvent(event("invoice.paid"))).rejects.toThrow();
    }
    mock.lines.mockResolvedValue({ data: [line(), line()], has_more: false });
    await expect(processStripeEvent(event("invoice.paid"))).rejects.toThrow();
    mock.lines.mockResolvedValue({ data: [line()], has_more: false });
    mock.invoices.mockResolvedValue({ ...invoice(), amount_paid: 1 });
    await expect(processStripeEvent(event("invoice.paid"))).rejects.toThrow();
    expect(mock.rpc).not.toHaveBeenCalled();
  });
  it("rejects another subscription owner's invoice", async () => {
    mock.subscriptions.mockResolvedValue({
      ...subscription(),
      metadata: { editingapp_user_id: "another-user" },
    });
    await expect(processStripeEvent(event("invoice.paid"))).rejects.toThrow(
      "ownership",
    );
    expect(mock.rpc).not.toHaveBeenCalled();
  });
  it("holds billing after a refunded charge for a mapped customer", async () => {
    mock.charges.mockResolvedValue({ customer: "cus_owned" });
    await processStripeEvent(
      event("charge.refunded", "evt_refund", { id: "ch_fixture" }),
    );
    expect(mock.rpc).toHaveBeenCalledWith("hold_billing_account", {
      p_event: "evt_refund",
      p_customer: "cus_owned",
      p_type: "charge.refunded",
    });
  });
  it("verifies actual Stripe HMAC signatures, rejects tampering and retries DB failures", async () => {
    const body = JSON.stringify(event("invoice.paid"));
    const header = sdk.webhooks.generateTestHeaderString({
      payload: body,
      secret,
    });
    const req = (payload = body, signature = header) =>
      new Request("http://localhost:3001/api/billing/webhook", {
        method: "POST",
        body: payload,
        headers: { "stripe-signature": signature },
      });
    expect((await webhook(req(body + " "))).status).toBe(400);
    expect((await webhook(req(body, ""))).status).toBe(400);
    expect(
      (
        await webhook(
          req(
            body,
            sdk.webhooks.generateTestHeaderString({
              payload: body,
              secret,
              timestamp: 1,
            }),
          ),
        )
      ).status,
    ).toBe(400);
    expect(mock.rpc).not.toHaveBeenCalled();
    expect((await webhook(req())).status).toBe(200);
    mock.rpc.mockResolvedValue({ error: new Error("DB unavailable") });
    vi.spyOn(console, "error").mockImplementation(() => {});
    expect((await webhook(req())).status).toBe(500);
  });
  it("ignores client-supplied price, customer, amount and credit values", async () => {
    mock.rpc.mockResolvedValue({
      data: {
        attempt_id: "attempt-one",
        expires_at: new Date(Date.now() + 3600000).toISOString(),
        session_id: null,
      },
      error: null,
    });
    const response = await checkoutRoute(
      new Request("http://localhost:3001/api/billing/checkout", {
        method: "POST",
        headers: {
          origin: "http://localhost:3001",
          "content-type": "application/json",
        },
        body: JSON.stringify({
          plan: "starter",
          interval: "month",
          price: "price_one_cent",
          customer: "cus_attacker",
          amount: 1,
          credits: 999999,
        }),
      }),
    );
    expect(response.status).toBe(200);
    expect(mock.checkout).toHaveBeenCalledWith(
      expect.objectContaining({
        customer: "cus_owned",
        line_items: [{ price: "price_starter_month", quantity: 1 }],
        mode: "subscription",
      }),
      { idempotencyKey: "editingapp-checkout-v1:attempt-one" },
    );
    expect(
      mock.rpc.mock.calls.some((call) => call[0] === "apply_paid_invoice"),
    ).toBe(false);
  });
  it("reuses the same checkout key and payload after a lost response", async () => {
    mock.rpc.mockResolvedValue({
      data: {
        attempt_id: "stable-attempt",
        expires_at: new Date(Date.now() + 3600000).toISOString(),
        session_id: null,
      },
      error: null,
    });
    mock.checkout.mockRejectedValueOnce(new Error("response lost"));
    await expect(checkout({ id: "owner" }, "starter", "month")).rejects.toThrow(
      "response lost",
    );
    await checkout({ id: "owner" }, "starter", "month");
    expect(mock.checkout.mock.calls[0]).toEqual(mock.checkout.mock.calls[1]);
  });
  it("reuses open checkout sessions and blocks duplicate active subscriptions", async () => {
    mock.rpc.mockResolvedValue({
      data: { session_id: "cs_existing" },
      error: null,
    });
    expect(await checkout({ id: "owner" }, "starter", "month")).toEqual({
      url: "https://checkout.stripe.com/c/pay/cs_existing",
    });
    expect(mock.checkout).not.toHaveBeenCalled();
    mock.listSubscriptions.mockResolvedValue({
      data: [{ status: "active" }],
      has_more: false,
    });
    await expect(checkout({ id: "owner" }, "starter", "month")).rejects.toThrow(
      "already have",
    );
    expect(mock.checkout).not.toHaveBeenCalled();
  });
  it("rejects cross-origin checkout and unavailable billing before calling Stripe", async () => {
    const req = (origin: string) =>
      new Request("http://localhost:3001/api/billing/checkout", {
        method: "POST",
        headers: { origin, "content-type": "application/json" },
        body: JSON.stringify({ plan: "starter", interval: "month" }),
      });
    expect((await checkoutRoute(req("https://untrusted.example"))).status).toBe(
      403,
    );
    vi.stubEnv("STRIPE_SECRET_KEY", "");
    expect((await checkoutRoute(req("http://localhost:3001"))).status).toBe(
      503,
    );
    expect(mock.checkout).not.toHaveBeenCalled();
  });
});
