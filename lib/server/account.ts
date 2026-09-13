import "server-only";
import { admin } from "./supabase";
import { creditsEnabled } from "./config";
import { AppError } from "@/lib/errors";

export function requireCredits() {
  if (!creditsEnabled())
    throw new AppError(
      "CREDITS_SETUP",
      "Credit accounts and the new tools are not available yet. The retro studio is still available.",
      503,
    );
}
export async function ensureAccount(userId: string) {
  requireCredits();
  const { error } = await admin().rpc("ensure_account", { p_user_id: userId });
  if (error) throw error;
}
export async function accountSummary(userId: string) {
  await ensureAccount(userId);
  const client = admin();
  const results = await Promise.all([
    client
      .from("account_profiles")
      .select("display_name,bio,billing_hold,stripe_customer_id")
      .eq("user_id", userId)
      .single(),
    client
      .from("credit_grants")
      .select("remaining,expires_at,source")
      .eq("user_id", userId)
      .eq("revoked", false)
      .gt("expires_at", new Date().toISOString())
      .gt("remaining", 0)
      .order("expires_at"),
    client
      .from("billing_subscriptions")
      .select("plan_id,interval,status,period_end,cancel_at_period_end")
      .eq("user_id", userId)
      .order("period_end", { ascending: false })
      .limit(1),
  ]);
  for (const result of results) if (result.error) throw result.error;
  const [profile, grants, subscriptions] = results;
  return {
    profile: {
      displayName: profile.data!.display_name as string,
      bio: profile.data!.bio as string,
    },
    credits: (grants.data || []).reduce(
      (sum, grant) => sum + Number(grant.remaining),
      0,
    ),
    grants: grants.data || [],
    billingHold: Boolean(profile.data!.billing_hold),
    hasCustomer: Boolean(profile.data!.stripe_customer_id),
    subscription: subscriptions.data?.[0] || null,
  };
}
