import "server-only";
import { createServerClient } from "@supabase/ssr";
import { createClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";
import { requireConfig } from "./config";
import { AppError } from "@/lib/errors";
export function admin() {
  requireConfig();
  return createClient(
    process.env.SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } },
  );
}
export async function authClient() {
  requireConfig();
  const jar = await cookies();
  return createServerClient(
    process.env.SUPABASE_URL!,
    process.env.SUPABASE_ANON_KEY!,
    {
      cookieOptions: {
        httpOnly: true,
        sameSite: "lax",
        secure: process.env.NODE_ENV === "production",
        path: "/",
      },
      cookies: {
        getAll: () => jar.getAll(),
        setAll: (values) => {
          values.forEach(({ name, value, options }) =>
            jar.set(name, value, options),
          );
        },
      },
    },
  );
}
export async function requireUser() {
  const client = await authClient();
  const { data, error } = await client.auth.getUser();
  if (error || !data.user?.email_confirmed_at || data.user.is_anonymous)
    throw new AppError(
      "AUTH_REQUIRED",
      "Verify your email to use your daily portrait allowance.",
      401,
    );
  return data.user;
}
