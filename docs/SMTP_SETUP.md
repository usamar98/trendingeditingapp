# Enable production sign-in email

The application's `AUTH_SEND_LIMIT` means Supabase returned `over_email_send_rate_limit` after EditingApp's database reservation succeeded. A redirect/template change or SQL migration cannot raise that provider limit. `AUTH_REQUEST_LIMIT` identifies a general Auth request limit, including an unclassified HTTP 429; it does not prove the email quota is exhausted.

## Check which mail service the project uses

Open your Supabase project → **Authentication → Email** (under Notifications) → **SMTP Settings**. Check whether Custom SMTP is enabled. The app cannot inspect this setting through its publishable key or ordinary sign-in API.

- **Built-in mail:** Supabase currently documents **2 emails per project per hour**, restricted to the project's organization team addresses. This is a development service. Configure Custom SMTP for public signup.
- **Custom SMTP already enabled:** check **Authentication → Rate Limits → emails sent**, the email provider's account quota/delivery logs, and Supabase Auth logs. Custom SMTP still has limits; Supabase documents an initial 30 emails/hour setting. Choose a limit appropriate to your provider and expected traffic.

Source, checked 12 September 2026: [Supabase custom SMTP](https://supabase.com/docs/guides/auth/auth-smtp).

## Example: connect Resend SMTP

1. In Resend, add and verify a sending domain you control, such as `editingapp.live`. Add the DNS records Resend supplies at your DNS provider and wait for domain verification. Do not invent DNS values.
2. Create a Resend API key with sending access for that domain.
3. Enable Custom SMTP in Supabase and enter:

| Setting      | Value                                                                                                |
| ------------ | ---------------------------------------------------------------------------------------------------- |
| Sender name  | `EditingApp`                                                                                         |
| Sender email | `noreply@editingapp.live` **only after that domain is verified**; otherwise use your verified domain |
| Host         | `smtp.resend.com`                                                                                    |
| Port         | `465`                                                                                                |
| Username     | `resend`                                                                                             |
| Password     | Your Resend API key                                                                                  |

4. Save. Check Supabase's email rate-limit setting and your Resend account allowance. These SMTP credentials belong in **Supabase**, not in browser code, Git or chat. No additional Next.js environment variable or SQL migration is needed for SMTP.
5. Keep the combined email template in both **Confirm signup** and **Magic Link**. Keep Site URL `https://www.editingapp.live` and allow `https://www.editingapp.live/auth/callback` for this production site. Use your actual origin if the domain changes.
6. After the active rate window permits another send, request one email from the app. Verify either its link or its code, then generate normally. Do not repeatedly request fresh emails to test delivery.

Official instructions: [Resend with Supabase SMTP](https://resend.com/docs/send-with-supabase-smtp).

## While sending is limited

Use an **unused, unexpired** email link/code already received. In the email dialog, enter the matching address and choose **Enter an existing code**; this does not request a new email. Used or expired credentials cannot be reused.

The UI prevents overlapping form submissions and pauses email attempts for 60 seconds, while still allowing code verification. This is a browser convenience, not a provider reset estimate or a security boundary; closing/reloading the page does not reset server limits. Supabase defaults to a 60-second interval per recipient, but project-wide and request limits can last longer. EditingApp also separately enforces three attempts/address/hour and thirty/site/hour. Existing verification does not reserve another email attempt.

Supabase limits remain enforced. No automatic resend, quota bypass, auto-confirm or deletion of quota records is part of this fix. The safe server log includes a known provider error code so the operator can distinguish mail quota from a general Auth request limit without logging email addresses or credentials.

Source: [Supabase rate limits](https://supabase.com/docs/guides/auth/rate-limits). Configuring delivery requires access to the operator's Supabase, email-provider and DNS accounts; those settings have not been changed by the repository update.
