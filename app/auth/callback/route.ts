import { appUrl } from "@/lib/server/config";
import { authClient } from "@/lib/server/supabase";

export const dynamic = "force-dynamic";

function finish(outcome: "success" | "expired" | "browser" | "unavailable") {
  // Never redirect to a caller-supplied host/path or forward credentials/errors.
  const target = new URL("/", appUrl());
  target.searchParams.set("auth", outcome);
  target.hash = "studio";
  return new Response(null, {
    status: 303,
    headers: {
      Location: target.href,
      "Cache-Control": "no-store, private",
      "Referrer-Policy": "no-referrer",
      "X-Robots-Tag": "noindex, nofollow",
    },
  });
}

const validCredential = (value: string | null): value is string =>
  Boolean(value && /^[a-zA-Z0-9_-]{1,2048}$/.test(value));

export async function GET(request: Request) {
  const params = new URL(request.url).searchParams;
  const code = params.get("code");
  const tokenHash = params.get("token_hash");
  if (
    params.has("error") ||
    params.has("error_code") ||
    params.getAll("code").length > 1 ||
    params.getAll("token_hash").length > 1 ||
    Boolean(code && tokenHash) ||
    (!validCredential(code) &&
      !(validCredential(tokenHash) && params.get("type") === "email"))
  )
    return finish("expired");

  try {
    const client = await authClient();
    // Default ConfirmationURL emails return a PKCE code. The supplied custom
    // template returns a token hash and also works when opened on another device.
    // Both methods save the session through the existing HttpOnly cookie adapter.
    const { data, error } = tokenHash
      ? await client.auth.verifyOtp({ token_hash: tokenHash, type: "email" })
      : await client.auth.exchangeCodeForSession(code!);
    if (error) {
      if (
        error.code === "flow_state_not_found" ||
        error.code === "bad_code_verifier" ||
        error.code === "pkce_code_verifier_not_found" ||
        error.code === "validation_failed"
      )
        return finish("browser");
      return finish(
        !error.status || error.status >= 500 ? "unavailable" : "expired",
      );
    }
    if (
      !data.session ||
      !data.user?.email_confirmed_at ||
      data.user.is_anonymous
    )
      return finish("expired");
    return finish("success");
  } catch {
    // No credentials, URLs, email addresses or raw Supabase errors in logs.
    return finish("unavailable");
  }
}
