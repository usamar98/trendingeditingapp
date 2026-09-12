# Troubleshooting email verification

## The email service has reached its sending limit

Follow [production SMTP setup](SMTP_SETUP.md). Check whether Custom SMTP is enabled in Supabase. Its built-in sender currently allows only two messages/hour across the project and is intended for development. Custom SMTP is needed for public signup; it still has configurable Supabase limits and provider account limits. The app does not know the provider's exact reset time.

`AUTH_SEND_LIMIT` now identifies Supabase's explicit `over_email_send_rate_limit`. `AUTH_REQUEST_LIMIT` identifies request throttling or a 429 without that specific email code. Safe server logs retain these known codes for diagnosis. The UI pauses email attempts for 60 seconds and prevents overlapping submissions, while keeping existing-code verification available. It does not automatically send another email when the countdown ends. This change does not raise the external quota.

## Email contains a link, but Generate asks for email again

Supabase sends a magic link by default, even when the API method is named `signInWithOtp`. The earlier app implemented code entry only and did not exchange a returned auth code for a session. A successful redirect alone did not sign the user into EditingApp.

The updated app has `/auth/callback`. It exchanges a PKCE code (default template) or verifies a token hash (provided template), writes HttpOnly session cookies and returns to the studio without credentials in the URL. The original upload tab refreshes on a login notification or focus; Generate also checks the server session before displaying the email form. Email links that fall back to the homepage are forwarded to the callback. No portrait is generated just by signing in.

Deploy the latest `main`, then configure these settings in the same Supabase project used by the deployed application:

1. **Authentication → URL Configuration → Site URL:** your production origin, identical to `APP_URL`, e.g. `https://your-domain.com`.
2. **Redirect URLs:** add `https://your-domain.com/auth/callback`. For local development add `http://localhost:3001/auth/callback` (or port 3000 when used). Use exact URLs for production; avoid broad wildcard redirects. Open the app on that same hostname; apex, `www`, localhost and preview deployments have separate cookies.
3. **Authentication → Email Templates:** copy `supabase/templates/sign-in-email.html` into **both Confirm signup and Magic Link**. Set the subject to **Your EditingApp sign-in link and code**. Paste HTML in the template editor, not the SQL editor. The app passes an allowlisted callback as `.RedirectTo`; the link verifies `.TokenHash`, and the email also displays `.Token` as a numeric code. No SQL changes are needed for this fix.
4. Request one fresh email after deployment. A used or expired link/code cannot be reused. Default PKCE links must open in the same browser/device that requested them. The custom template's token-hash link signs in whichever browser opens it; for a different original device, enter the code there instead. Signing into a phone cannot update a laptop's cookies.

The code field remains available for OTP-only templates. **Enter an existing code** avoids sending another email, and **I opened the email link** checks the saved session without resending. If the original photo was selected in another tab, return to that tab; it keeps its local preview. Photos are not transferred between browser tabs/devices just by signing in.

If the app still reports no session after opening a fresh link, check the callback response for a `Set-Cookie` header and the next `/api/session` response for `user`. Allow first-party cookies and verify the origin matches `APP_URL`. Inspect status codes without sharing tokens, callback URLs containing codes, cookie values or raw network captures. Auth callbacks are private/non-cacheable and must not be cached by a reverse proxy. Supabase's Auth logs can help distinguish expired links from an invalid verifier. Disable email-provider link tracking; scanners can consume one-time links. The code alternative can help when a link was not consumed. Unsupported old implicit-flow links are cleared and require a new sign-in; this server-only app uses PKCE or token-hash verification.

Official references: [Supabase passwordless email](https://supabase.com/docs/guides/auth/auth-email-passwordless), [PKCE session exchange](https://supabase.com/docs/guides/auth/sessions/pkce-flow), [email templates and prefetching](https://supabase.com/docs/guides/auth/auth-email-templates), [redirect URL configuration](https://supabase.com/docs/guides/auth/redirect-urls).

## Database setup reported as an email limit

The original message “Email verification is temporarily limited. Please try again later.” did **not** prove an email limit had been reached. The original handler converted every error from the `reserve_auth_email` database function into that message. Missing migrations, wrong credentials and database outages could all produce it **before Supabase attempted to send an email**.

The updated handler returns 429 only for the database function's exact quota exception (`P0001` / `LIMIT`). Setup and availability failures now return 503 with distinct codes and safe server diagnostics. Raw provider errors, email addresses, hashes and credentials are never logged or returned to the browser.

## Check the project setup

Run `supabase/diagnostics/email-auth.sql` in **Supabase → SQL Editor** for the project referenced by the deployed app's `SUPABASE_URL`. This is read-only and sends no email. The first result should return `true` for all three checks:

- The `public.auth_attempts` table exists.
- The `public.reserve_auth_email(text)` function exists.
- `service_role` can execute the function.

If checks fail, verify that both migration files from `supabase/migrations/` were applied successfully to this same project. The email guard is defined at the end of `202609120001_portraits.sql`; it must not be skipped. For an empty project, apply migrations in filename order. If the schema was partially applied, inspect the existing objects before applying missing definitions; do not drop tables or rerun the entire initial migration blindly.

If the function exists but the deployed server reports `PGRST202`, refresh the PostgREST schema cache in the SQL editor:

```sql
NOTIFY pgrst, 'reload schema';
```

Check that `SUPABASE_SERVICE_ROLE_KEY` is the server service-role/secret key for that same project. Do not put a publishable/anon key into this variable. Keep credentials in the deployment environment; never post them in chat or commit them. Restart/redeploy after changing deployment variables.

## Interpret the updated response and server logs

The API's `code` is visible in the browser network response. The deployment logs include a safe `stage`, `category`, and known provider `code` under “EditingApp authentication unavailable”.

| API code             | Meaning                                                                | Next step                                                                                                                                                                                                                               |
| -------------------- | ---------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `AUTH_SETUP`         | Missing/inaccessible database objects or rejected server credentials.  | Check the diagnostic SQL, migrations and matching service credentials. `PGRST202` commonly indicates a missing function or stale schema cache; `42501` indicates insufficient privilege.                                                |
| `AUTH_UNAVAILABLE`   | The reservation database request failed for another reason.            | Check Supabase availability, project status and server connectivity. This is not reported as a confirmed quota error.                                                                                                                   |
| `AUTH_LIMIT`         | EditingApp's reservation function reported its actual quota exception. | Wait for the rolling hour to free a slot. Limits are **3 attempts per email address per hour** and **30 attempts across the site per hour**. Failed delivery attempts also count; do not repeatedly resend while fixing delivery setup. |
| `AUTH_SEND_LIMIT`    | Supabase Auth explicitly reported its email-send rate limit.           | Check Custom SMTP, Authentication rate limits and provider quota using [SMTP setup](SMTP_SETUP.md). This is separate from EditingApp's database guard.                                                                                  |
| `AUTH_REQUEST_LIMIT` | Supabase Auth reported request throttling or an unclassified HTTP 429. | Pause before another attempt; check Auth request-rate settings and logs. This does not by itself prove the email budget is exhausted.                                                                                                   |
| `AUTH_EMAIL_SETUP`   | Email delivery or OTP configuration prevents the sign-in.              | Inspect the safe provider code in server logs. For `email_address_not_authorized`, configure custom SMTP. Check that email/OTP sign-in and intended signups are enabled.                                                                |
| `AUTH_SEND`          | Other email-service failure.                                           | Inspect service health and provider delivery logs. The app does not automatically retry sending.                                                                                                                                        |

The diagnostic SQL also reports the site's aggregate attempts during the last hour; it exposes no addresses or hashes. Do not delete `auth_attempts` to work around the guard. An already-received valid code can still be verified without a new send/reservation.

## Email settings

Use the combined link/code template and callback settings above. Supabase's built-in mail service restricts recipients and has a small sending allowance, so configure custom SMTP for a public application. These Supabase delivery limits occur after the application's reservation check and are a different failure source.

Official references: [PostgREST errors](https://docs.postgrest.org/en/v14/references/errors.html), [Supabase Auth error codes](https://supabase.com/docs/guides/auth/debugging/error-codes), [email rate limits](https://supabase.com/docs/guides/auth/rate-limits), [custom SMTP](https://supabase.com/docs/guides/auth/auth-smtp).
