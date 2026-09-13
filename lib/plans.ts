export const WELCOME_CREDITS = 9;
export const IMAGE_CREDITS = { medium: 3, high: 8 } as const;
export type BillingInterval = "month" | "year";
export const PLANS = [
  {
    id: "starter",
    name: "Starter",
    monthlyCents: 1900,
    yearlyCents: 19000,
    monthlyCredits: 600,
    description: "Room for your next creative idea.",
  },
  {
    id: "creator",
    name: "Creator",
    monthlyCents: 3900,
    yearlyCents: 39000,
    monthlyCredits: 1400,
    description: "More experiments. More keepers.",
  },
  {
    id: "studio",
    name: "Studio",
    monthlyCents: 10000,
    yearlyCents: 100000,
    monthlyCredits: 4000,
    description: "A larger canvas for frequent creators.",
  },
] as const;
export type PlanId = (typeof PLANS)[number]["id"];
export function findPlan(id: string) {
  return PLANS.find((plan) => plan.id === id);
}
export function planCredits(id: PlanId, interval: BillingInterval) {
  return findPlan(id)!.monthlyCredits * (interval === "year" ? 12 : 1);
}
export function planAmount(id: PlanId, interval: BillingInterval) {
  const plan = findPlan(id)!;
  return interval === "year" ? plan.yearlyCents : plan.monthlyCents;
}
export function dollars(cents: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: cents % 100 ? 2 : 0,
  }).format(cents / 100);
}
