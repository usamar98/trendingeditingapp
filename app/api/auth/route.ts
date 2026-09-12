import { appUrl, sameOrigin } from "@/lib/server/config";
import { authClient, admin } from "@/lib/server/supabase";
import { createHash } from "node:crypto";
import { readBody } from "@/lib/server/upload";
import { AppError, errorResponse } from "@/lib/errors";
import { reservationFailure, emailSendFailure } from "@/lib/server/auth-errors";
export async function POST(request: Request) {
  try {
    sameOrigin(request);
    let body;
    try {
      body = JSON.parse((await readBody(request, 4096)).toString());
    } catch {
      throw new AppError(
        "INVALID",
        "Enter a valid email and verification code.",
      );
    }
    const client = await authClient();
    if (body.action === "signout") {
      const { error } = await client.auth.signOut();
      if (error) throw error;
      return Response.json({ ok: true });
    }
    if (
      typeof body.email !== "string" ||
      body.email.length > 254 ||
      !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(body.email)
    )
      throw new AppError("EMAIL", "Enter a valid email address.");
    if (body.action === "send") {
      const emailHash = createHash("sha256")
        .update(body.email.trim().toLowerCase())
        .digest("hex");
      const reservation = await admin().rpc("reserve_auth_email", {
        p_email_hash: emailHash,
      });
      if (reservation.error)
        throw reservationFailure(reservation.error, reservation.status);
      const { error } = await client.auth.signInWithOtp({
        email: body.email,
        options: {
          shouldCreateUser: true,
          captchaToken: body.captchaToken,
          emailRedirectTo: new URL("/auth/callback", appUrl()).href,
        },
      });
      if (error) throw emailSendFailure(error);
    } else if (body.action === "verify") {
      if (typeof body.token !== "string" || !/^\d{6,8}$/.test(body.token))
        throw new AppError("TOKEN", "Enter the code from your email.");
      const { error } = await client.auth.verifyOtp({
        email: body.email,
        token: body.token,
        type: "email",
      });
      if (error)
        throw new AppError(
          "TOKEN",
          "That code is invalid or expired. Request a new code.",
        );
    } else throw new AppError("ACTION", "Unknown sign-in action.");
    return Response.json({ ok: true });
  } catch (error) {
    return errorResponse(error);
  }
}
