# Troubleshooting email verification

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

| API code           | Meaning                                                                     | Next step                                                                                                                                                                                                                               |
| ------------------ | --------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `AUTH_SETUP`       | Missing/inaccessible database objects or rejected server credentials.       | Check the diagnostic SQL, migrations and matching service credentials. `PGRST202` commonly indicates a missing function or stale schema cache; `42501` indicates insufficient privilege.                                                |
| `AUTH_UNAVAILABLE` | The reservation database request failed for another reason.                 | Check Supabase availability, project status and server connectivity. This is not reported as a confirmed quota error.                                                                                                                   |
| `AUTH_LIMIT`       | EditingApp's reservation function reported its actual quota exception.      | Wait for the rolling hour to free a slot. Limits are **3 attempts per email address per hour** and **30 attempts across the site per hour**. Failed delivery attempts also count; do not repeatedly resend while fixing delivery setup. |
| `AUTH_SEND_LIMIT`  | Supabase Auth reported a sending/request limit after reservation succeeded. | Check Authentication rate limits and email-provider settings. This is separate from EditingApp's database guard.                                                                                                                        |
| `AUTH_EMAIL_SETUP` | Email delivery or OTP configuration prevents the sign-in.                   | Inspect the safe provider code in server logs. For `email_address_not_authorized`, configure custom SMTP. Check that email/OTP sign-in and intended signups are enabled.                                                                |
| `AUTH_SEND`        | Other email-service failure.                                                | Inspect service health and provider delivery logs. The app does not automatically retry sending.                                                                                                                                        |

The diagnostic SQL also reports the site's aggregate attempts during the last hour; it exposes no addresses or hashes. Do not delete `auth_attempts` to work around the guard. An already-received valid code can still be verified without a new send/reservation.

## Email settings

For the current code-entry flow, both **Confirm signup** and **Magic Link** templates must display `{{ .Token }}`. Set Site URL to the deployed `APP_URL`; there is no `/auth/callback` route. Supabase's built-in mail service restricts recipients and has a small sending allowance, so configure custom SMTP for a public application. These Supabase delivery limits occur after the application's reservation check and are a different failure source.

Official references: [PostgREST errors](https://docs.postgrest.org/en/v14/references/errors.html), [Supabase Auth error codes](https://supabase.com/docs/guides/auth/debugging/error-codes), [email rate limits](https://supabase.com/docs/guides/auth/rate-limits), [custom SMTP](https://supabase.com/docs/guides/auth/auth-smtp).
