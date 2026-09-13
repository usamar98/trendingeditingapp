import {
  accountSummary,
  requireCredits,
  ensureAccount,
} from "@/lib/server/account";
import { requireUser, admin } from "@/lib/server/supabase";
import { sameOrigin } from "@/lib/server/config";
import { readBody } from "@/lib/server/upload";
import { AppError, errorResponse } from "@/lib/errors";
export const dynamic = "force-dynamic";
export async function GET() {
  try {
    const user = await requireUser();
    const account = await accountSummary(user.id);
    const ledger = await admin()
      .from("credit_ledger")
      .select("delta,kind,created_at")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(30);
    if (ledger.error) throw ledger.error;
    return Response.json({
      ...account,
      email: user.email,
      activity: ledger.data,
    });
  } catch (error) {
    return errorResponse(error);
  }
}
export async function PATCH(request: Request) {
  try {
    sameOrigin(request);
    requireCredits();
    const user = await requireUser();
    let body;
    try {
      body = JSON.parse((await readBody(request, 2048)).toString());
    } catch {
      throw new AppError("PROFILE", "Enter a name and a short bio.");
    }
    if (
      !body ||
      typeof body.displayName !== "string" ||
      body.displayName.length > 80 ||
      typeof body.bio !== "string" ||
      body.bio.length > 240
    )
      throw new AppError(
        "PROFILE",
        "Use up to 80 characters for your name and 240 for your bio.",
      );
    // Explicit allowlist: account balance, customer ID and hold status can never come from this body.
    await ensureAccount(user.id);
    const saved = await admin()
      .from("account_profiles")
      .update({
        display_name: body.displayName.trim(),
        bio: body.bio.trim(),
        updated_at: new Date().toISOString(),
      })
      .eq("user_id", user.id);
    if (saved.error) throw saved.error;
    return Response.json({ ok: true });
  } catch (error) {
    return errorResponse(error);
  }
}
