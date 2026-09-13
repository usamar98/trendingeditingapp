import { sameOrigin } from "@/lib/server/config";
import { requireUser } from "@/lib/server/supabase";
import { billingPortal } from "@/lib/server/billing";
import { errorResponse } from "@/lib/errors";
export async function POST(request: Request) {
  try {
    sameOrigin(request);
    const user = await requireUser();
    return Response.json(await billingPortal(user.id));
  } catch (error) {
    return errorResponse(error);
  }
}
