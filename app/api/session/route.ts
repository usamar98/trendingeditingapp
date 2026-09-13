import {
  configured,
  authConfigured,
  creditsEnabled,
} from "@/lib/server/config";
import { authClient } from "@/lib/server/supabase";
import { remaining } from "@/lib/server/jobs";
import { errorResponse } from "@/lib/errors";
import { accountSummary } from "@/lib/server/account";
import { WELCOME_CREDITS } from "@/lib/plans";
import { billingConfigured } from "@/lib/server/stripe";
export const dynamic = "force-dynamic";
export async function GET() {
  if (!authConfigured())
    return Response.json({
      configured: false,
      authConfigured: false,
      creditMode: "legacy",
      user: null,
      remaining: 0,
      credits: 0,
    });
  try {
    const { data } = await (await authClient()).auth.getUser();
    const user =
      data.user?.email_confirmed_at && !data.user.is_anonymous
        ? data.user
        : null;
    const creditMode = creditsEnabled();
    const account = user && creditMode ? await accountSummary(user.id) : null;
    return Response.json({
      configured: configured(),
      authConfigured: true,
      creditMode: creditMode ? "credits" : "legacy",
      credits: account?.credits ?? (user ? 0 : WELCOME_CREDITS),
      billingHold: account?.billingHold || false,
      billingReady: billingConfigured(),
      user:
        user?.email_confirmed_at && !user.is_anonymous
          ? {
              email: user.email,
              displayName: account?.profile.displayName || "",
            }
          : null,
      remaining: account
        ? Math.floor(account.credits / 3)
        : user
          ? await remaining(user.id)
          : 3,
    });
  } catch (error) {
    return errorResponse(error);
  }
}
