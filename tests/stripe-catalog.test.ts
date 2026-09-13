import { describe, it, expect, vi } from "vitest";
import type Stripe from "stripe";
import {
  PLANS,
  planAmount,
  type PlanId,
  type BillingInterval,
} from "@/lib/plans";
import {
  resolvePlanPrice,
  identifyPrice,
  resolvePortalConfiguration,
  productId,
  priceLookupKey,
} from "@/lib/server/stripe-catalog";
const price = (plan: PlanId = "starter", interval: BillingInterval = "month") =>
  ({
    id: `price_${plan}_${interval}`,
    active: true,
    type: "recurring",
    currency: "usd",
    unit_amount: planAmount(plan, interval),
    billing_scheme: "per_unit",
    transform_quantity: null,
    product: productId(plan),
    lookup_key: priceLookupKey(plan, interval),
    metadata: { plan_id: plan, credits_version: "1" },
    recurring: { interval, interval_count: 1, usage_type: "licensed" },
  }) as unknown as Stripe.Price;
const product = (plan: PlanId = "starter") => ({
  id: productId(plan),
  active: true,
  metadata: { editingapp: "credits-v1", plan_id: plan },
});
function fixture() {
  const products = {
    retrieve: vi.fn().mockResolvedValue(product()),
    create: vi.fn().mockResolvedValue(product()),
  };
  const prices = {
    list: vi.fn().mockResolvedValue({ data: [], has_more: false }),
    create: vi.fn().mockResolvedValue(price()),
    retrieve: vi.fn().mockResolvedValue(price()),
  };
  const configurations = {
    list: vi.fn().mockResolvedValue({ data: [], has_more: false }),
    create: vi.fn().mockResolvedValue({ id: "bpc_generated" }),
    update: vi.fn().mockResolvedValue({ id: "bpc_existing" }),
  };
  return {
    products,
    prices,
    configurations,
    stripe: {
      products,
      prices,
      billingPortal: { configurations },
    } as unknown as Stripe,
  };
}
describe("automatic Stripe catalog with simulated API responses", () => {
  it.each(
    PLANS.flatMap((p) =>
      (["month", "year"] as const).map((interval) => [p.id, interval] as const),
    ),
  )(
    "creates the reviewed %s/%s price without environment IDs",
    async (plan, interval) => {
      const f = fixture();
      f.products.retrieve.mockRejectedValueOnce({ code: "resource_missing" });
      f.products.create.mockResolvedValue(product(plan));
      f.prices.create.mockResolvedValue(price(plan, interval));
      expect(await resolvePlanPrice(f.stripe, plan, interval)).toBe(
        price(plan, interval).id,
      );
      expect(f.products.create).toHaveBeenCalledWith(
        expect.objectContaining({ id: productId(plan) }),
        { idempotencyKey: `setup:${productId(plan)}` },
      );
      expect(f.prices.create).toHaveBeenCalledWith(
        expect.objectContaining({
          product: productId(plan),
          currency: "usd",
          unit_amount: planAmount(plan, interval),
          recurring: { interval },
          lookup_key: priceLookupKey(plan, interval),
        }),
        { idempotencyKey: `setup:${priceLookupKey(plan, interval)}` },
      );
    },
  );
  it("reuses existing setup-script prices on independent requests and cold starts", async () => {
    for (let i = 0; i < 2; i++) {
      const f = fixture();
      f.prices.list.mockResolvedValue({ data: [price()], has_more: false });
      expect(await resolvePlanPrice(f.stripe, "starter", "month")).toBe(
        "price_starter_month",
      );
      expect(f.products.create).not.toHaveBeenCalled();
      expect(f.prices.create).not.toHaveBeenCalled();
    }
  });
  it("recovers lost product and price creation responses using reads, not a new POST", async () => {
    const f = fixture();
    f.products.retrieve
      .mockRejectedValueOnce({ code: "resource_missing" })
      .mockResolvedValue(product());
    f.products.create.mockRejectedValue(new Error("response lost"));
    f.prices.list
      .mockResolvedValueOnce({ data: [], has_more: false })
      .mockResolvedValueOnce({ data: [], has_more: false })
      .mockResolvedValue({ data: [price()], has_more: false });
    f.prices.create.mockRejectedValue(new Error("response lost"));
    expect(await resolvePlanPrice(f.stripe, "starter", "month")).toBe(
      "price_starter_month",
    );
    expect(f.products.create).toHaveBeenCalledTimes(1);
    expect(f.prices.create).toHaveBeenCalledTimes(1);
  });
  it("concurrent creations use identical keys and payloads", async () => {
    const f = fixture();
    await Promise.all([
      resolvePlanPrice(f.stripe, "starter", "month"),
      resolvePlanPrice(f.stripe, "starter", "month"),
    ]);
    expect(f.prices.create.mock.calls).toHaveLength(2);
    expect(f.prices.create.mock.calls[0]).toEqual(
      f.prices.create.mock.calls[1],
    );
  });
  it("rejects wrong amounts, unrelated products and archived prices instead of replacing them", async () => {
    for (const invalid of [
      { ...price(), unit_amount: 1 },
      { ...price(), product: "prod_unrelated" },
      { ...price(), lookup_key: "unreviewed" },
    ]) {
      const f = fixture();
      f.prices.list.mockResolvedValue({ data: [invalid], has_more: false });
      await expect(
        resolvePlanPrice(f.stripe, "starter", "month"),
      ).rejects.toThrow();
      expect(f.prices.create).not.toHaveBeenCalled();
    }
    const f = fixture();
    f.prices.list
      .mockResolvedValueOnce({ data: [], has_more: false })
      .mockResolvedValueOnce({
        data: [{ ...price(), active: false }],
        has_more: false,
      });
    await expect(
      resolvePlanPrice(f.stripe, "starter", "month"),
    ).rejects.toThrow();
    expect(f.prices.create).not.toHaveBeenCalled();
  });
  it("does not create catalog objects during webhook identification and recognizes archived renewals", async () => {
    const f = fixture();
    f.prices.retrieve.mockResolvedValue({
      ...price(),
      active: false,
      lookup_key: null,
    });
    expect(await identifyPrice(f.stripe, "price_starter_month")).toEqual({
      plan: "starter",
      interval: "month",
    });
    expect(f.products.create).not.toHaveBeenCalled();
    expect(f.prices.create).not.toHaveBeenCalled();
    f.prices.retrieve.mockResolvedValue({
      ...price(),
      product: "prod_foreign",
    });
    expect(await identifyPrice(f.stripe, "price_starter_month")).toBeNull();
    f.prices.retrieve.mockResolvedValue({ ...price(), unit_amount: 5 });
    await expect(
      identifyPrice(f.stripe, "price_starter_month"),
    ).rejects.toThrow();
  });
  it("creates a portal with period-end cancellation and no unsupported plan updates", async () => {
    const f = fixture();
    expect(
      await resolvePortalConfiguration(f.stripe, "https://www.editingapp.live"),
    ).toBe("bpc_generated");
    expect(f.configurations.create).toHaveBeenCalledWith(
      expect.objectContaining({
        default_return_url: "https://www.editingapp.live/account",
        features: expect.objectContaining({
          subscription_cancel: { enabled: true, mode: "at_period_end" },
          subscription_update: { enabled: false },
        }),
      }),
      { idempotencyKey: expect.stringMatching(/^editingapp-portal-v1:/) },
    );
  });
  it("reuses an existing portal and restores safe cancellation settings", async () => {
    const f = fixture();
    f.configurations.list.mockResolvedValue({
      data: [{ id: "bpc_existing", metadata: { editingapp: "credits-v1" } }],
      has_more: false,
    });
    expect(
      await resolvePortalConfiguration(f.stripe, "https://www.editingapp.live"),
    ).toBe("bpc_existing");
    expect(f.configurations.create).not.toHaveBeenCalled();
    expect(f.configurations.update).toHaveBeenCalledWith(
      "bpc_existing",
      expect.objectContaining({
        active: true,
        features: expect.objectContaining({
          subscription_update: { enabled: false },
        }),
      }),
    );
  });
});
