import { configured } from "@/lib/server/config";
import { authClient } from "@/lib/server/supabase";
import { remaining } from "@/lib/server/jobs";
import { errorResponse } from "@/lib/errors";
export const dynamic = "force-dynamic";
export async function GET() {
  if (!configured())
    return Response.json({ configured: false, user: null, remaining: 0 });
  try {
    const { data } = await (await authClient()).auth.getUser();
    const user = data.user;
    return Response.json({
      configured: true,
      user:
        user?.email_confirmed_at && !user.is_anonymous
          ? { email: user.email }
          : null,
      remaining: user ? await remaining(user.id) : 3,
    });
  } catch (error) {
    return errorResponse(error);
  }
}
