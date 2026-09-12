// Public UI messages only; auth credentials are exchanged by the server route.
export const AUTH_MESSAGES: Record<string, string> = {
  expired:
    "This sign-in link is invalid or expired. Use the newest email, or request a new one. Each link or code can be used once.",
  browser:
    "Open this link in the same browser where you requested it, or enter the code from your email there.",
  unavailable:
    "We could not finish signing you in. Please try again shortly. If this continues, contact the site owner.",
};

export function readAuthReturn(href: string) {
  const url = new URL(href);
  const fragment = new URLSearchParams(url.hash.slice(1));
  const hasFailure =
    url.searchParams.has("error") ||
    url.searchParams.has("error_code") ||
    fragment.has("error") ||
    fragment.has("error_code");
  const hasLegacyTokens =
    fragment.has("access_token") || fragment.has("refresh_token");
  let callback: string | null = null;
  // Older emails (or an unlisted redirect URL) can land at Site URL /?code=… .
  // Forward only supported auth parameters, never arbitrary redirects or tokens.
  if (
    !hasFailure &&
    (url.searchParams.has("code") || url.searchParams.has("token_hash"))
  ) {
    const params = new URLSearchParams();
    for (const name of ["code", "token_hash", "type"])
      for (const value of url.searchParams.getAll(name))
        params.append(name, value);
    callback = `/auth/callback?${params}`;
  }
  const outcome = hasFailure
    ? "expired"
    : hasLegacyTokens
      ? "browser"
      : url.searchParams.get("auth");
  const handled = Boolean(callback || hasFailure || hasLegacyTokens || outcome);
  // Clean authentication details out of browser history, including stale fragments.
  for (const name of [
    "code",
    "token_hash",
    "type",
    "auth",
    "error",
    "error_code",
    "error_description",
    "sb_flow_id",
  ])
    url.searchParams.delete(name);
  if (hasFailure || hasLegacyTokens) url.hash = "studio";
  return {
    callback,
    outcome,
    handled,
    cleanUrl: `${url.pathname}${url.search}${url.hash}`,
  };
}
