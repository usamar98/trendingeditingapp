import "server-only";
import { AppError } from "@/lib/errors";

type AuthFailure = { code?: string; message?: string; status?: number };
const DATABASE_SETUP_CODES = new Set([
  "PGRST202",
  "PGRST205",
  "42883",
  "42P01",
  "42703",
]);
const DATABASE_ACCESS_CODES = new Set([
  "PGRST301",
  "PGRST302",
  "42501",
  "28000",
  "28P01",
]);
const EMAIL_SETUP_CODES = new Set([
  "email_address_not_authorized",
  "email_provider_disabled",
  "provider_disabled",
  "otp_disabled",
  "signup_disabled",
  "captcha_failed",
]);
const EMAIL_LIMIT_CODES = new Set([
  "over_email_send_rate_limit",
  "over_request_rate_limit",
]);

function report(
  stage: "email_reservation" | "email_send",
  category: string,
  code?: string,
) {
  const known =
    code &&
    (DATABASE_SETUP_CODES.has(code) ||
      DATABASE_ACCESS_CODES.has(code) ||
      EMAIL_SETUP_CODES.has(code) ||
      EMAIL_LIMIT_CODES.has(code));
  // Log only known codes/categories. Never include email, hash, key, URL or raw error body.
  console.error("EditingApp authentication unavailable", {
    stage,
    category,
    code: known ? code : "UNKNOWN",
  });
}

export function reservationFailure(
  error: AuthFailure,
  status?: number,
): AppError {
  // The shipped SQL function raises exactly this exception when its quota is full.
  if (error.code === "P0001" && error.message?.trim() === "LIMIT")
    return new AppError(
      "AUTH_LIMIT",
      "Too many verification requests. Please wait up to an hour before requesting another code.",
      429,
    );

  if (DATABASE_SETUP_CODES.has(error.code || "")) {
    report("email_reservation", "database_setup", error.code);
    return new AppError(
      "AUTH_SETUP",
      "Email verification is not configured yet. Please contact the site owner.",
      503,
    );
  }
  if (
    DATABASE_ACCESS_CODES.has(error.code || "") ||
    status === 401 ||
    status === 403
  ) {
    report("email_reservation", "database_access", error.code);
    return new AppError(
      "AUTH_SETUP",
      "Email verification is not configured yet. Please contact the site owner.",
      503,
    );
  }
  report("email_reservation", "database_unavailable", error.code);
  return new AppError(
    "AUTH_UNAVAILABLE",
    "Email verification is temporarily unavailable. Please try again later.",
    503,
  );
}

export function emailSendFailure(error: AuthFailure): AppError {
  if (error.code === "over_email_send_rate_limit") {
    report("email_send", "email_send_limit", error.code);
    return new AppError(
      "AUTH_SEND_LIMIT",
      "Email sending is temporarily limited. Use an unused link or code you already received, or try later. If this continues, contact the site owner.",
      429,
    );
  }
  if (error.code === "over_request_rate_limit" || error.status === 429) {
    report("email_send", "auth_request_limit", error.code);
    return new AppError(
      "AUTH_REQUEST_LIMIT",
      "Too many sign-in requests. Pause before trying again. You can still try an unused link or code from your inbox.",
      429,
    );
  }
  if (EMAIL_SETUP_CODES.has(error.code || "")) {
    report("email_send", "email_setup", error.code);
    return new AppError(
      "AUTH_EMAIL_SETUP",
      "Email delivery is not configured for this sign-in. Please contact the site owner.",
      503,
    );
  }
  if (error.code === "email_address_invalid")
    return new AppError(
      "EMAIL",
      "Enter a valid email address that can receive verification codes.",
      400,
    );
  report("email_send", "email_unavailable", error.code);
  return new AppError(
    "AUTH_SEND",
    "The email service is temporarily unavailable. Please try again later.",
    503,
  );
}
