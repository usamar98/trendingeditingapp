import { sameOrigin } from "@/lib/server/config";
import { requireUser } from "@/lib/server/supabase";
import { readBody } from "@/lib/server/upload";
import { checkout } from "@/lib/server/billing";
import { findPlan } from "@/lib/plans";
import { AppError, errorResponse } from "@/lib/errors";
export async function POST(request: Request) {
  try {
    sameOrigin(request);
    const user = await requireUser();
    let body;
    try {
      body = JSON.parse((await readBody(request, 2048)).toString());
    } catch {
      throw new AppError("PLAN", "Choose a billing plan.");
    }
    const plan = typeof body?.plan === "string" && findPlan(body.plan);
    if (!plan || !["month", "year"].includes(body.interval))
      throw new AppError("PLAN", "Choose a monthly or yearly plan.");
    return Response.json(await checkout(user, plan.id, body.interval));
  } catch (error) {
    return errorResponse(error);
  }
}
