import "server-only";
import { AppError } from "@/lib/errors";
export function configured() {
  return Boolean(
    process.env.FAL_KEY &&
    process.env.SUPABASE_URL &&
    process.env.SUPABASE_ANON_KEY &&
    process.env.SUPABASE_SERVICE_ROLE_KEY &&
    process.env.APP_URL,
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
  return process.env.APP_URL || "http://localhost:3000";
}
export function sameOrigin(request: Request) {
  if (request.headers.get("origin") !== new URL(appUrl()).origin)
    throw new AppError(
      "ORIGIN",
      "Please submit this request from EditingApp.",
      403,
    );
}
