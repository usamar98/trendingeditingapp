import "server-only";
import { AppError } from "@/lib/errors";
import { siteOrigin } from "@/lib/site";
export function configured() {
  return Boolean(process.env.FAL_KEY && authConfigured());
}
export function authConfigured() {
  return Boolean(
    process.env.SUPABASE_URL &&
    process.env.SUPABASE_ANON_KEY &&
    process.env.SUPABASE_SERVICE_ROLE_KEY &&
    process.env.APP_URL,
  );
}
export function creditsEnabled() {
  return process.env.CREDITS_ENABLED === "true" && authConfigured();
}
export function requireAuthConfig() {
  if (!authConfigured())
    throw new AppError(
      "NOT_CONFIGURED",
      "Sign-in is not connected yet. Please try again later.",
      503,
    );
}
export function requireConfig() {
  if (!configured())
    throw new AppError(
      "NOT_CONFIGURED",
      "Portrait generation is not connected yet. You can explore styles and preview your selfie.",
      503,
    );
}
export function appUrl() {
  return siteOrigin();
}
export function sameOrigin(request: Request) {
  if (request.headers.get("origin") !== new URL(appUrl()).origin)
    throw new AppError(
      "ORIGIN",
      "Please submit this request from EditingApp.",
      403,
    );
}
