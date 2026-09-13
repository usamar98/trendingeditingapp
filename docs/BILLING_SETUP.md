# Enable figurines, accounts and Stripe

The code includes real fal and Stripe server integrations. Local verification uses simulated provider/Stripe responses; this workspace has no fal, Supabase or Stripe credentials. No live payment or new figurine inference was performed.

## 1. Apply the Supabase migration

For the existing EditingApp project, open **Supabase → SQL Editor → New query**, paste the complete contents of `supabase/migrations/202609130001_credits_billing_figures.sql`, and run it once. The previous two migrations must already be installed. For a fresh project, apply all three migration files in filename order, or use the Supabase CLI's migration workflow. Do not re-run an already applied migration.

The new migration adds private profiles, expiring credit grants, a credit ledger, payment-event records, subscriptions, checkout reservations, and figurine presets. It keeps the existing private `portraits` bucket and the old reservation function. Every balance mutation uses server-only SQL functions. Authenticated clients cannot change balances, billing holds, customer IDs or grants. No new public storage bucket is needed.

Until setup is complete, keep **`CREDITS_ENABLED=false` or unset**. The existing retro generator continues with its earlier daily allowance. Figurine generation and paid plans show as coming soon. After migration, `CREDITS_ENABLED=true` enables accounts, 9 one-time welcome credits and figurines; Stripe additionally needs the settings below. The switch is read on the server. Redeploy after environment changes.

## 2. Add only two Stripe secrets

Keep existing `FAL_KEY`, `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, and the exact `APP_URL`. Stripe now needs only:

```env
STRIPE_SECRET_KEY=sk_live_...
STRIPE_WEBHOOK_SECRET=whsec_...
```

Use your actual live key and the matching live webhook signing secret for production; use test-mode keys and webhook secrets during testing. After the existing Supabase credit migration is installed, set `CREDITS_ENABLED=true` and redeploy. No new migration is needed for this simplification.

**Price IDs and the portal configuration ID no longer need environment variables.** Remove the old seven ID variables if you previously added them. The server creates or reuses each approved product and recurring price when a signed-in user starts that plan's checkout. It creates or reuses a billing portal configuration when a customer opens Manage subscription. This uses Stripe's documented lookup keys and idempotency keys, including across separate server instances. Page views and webhook processing do not create catalog objects.

Existing objects made by the previous setup script are reused. The server checks the product identity, price amount, currency, interval and quantity rules before checkout. It stops sales for archived or mismatched configured prices instead of silently changing them. Unrelated manually created prices are not automatically adopted. Historical tagged prices can still fulfill legitimate paid renewals after being archived. Keep the managed product IDs, lookup keys and metadata intact in Stripe.

The secret key must have access to products, prices, customers, subscriptions, invoices, checkout and billing portal configuration. A normal Stripe secret key supports these operations. A restricted key needs the corresponding read/write permissions; the app reports configuration failures without charging a customer.

The portal enables invoices, payment-method updates and cancellation at period end. Unsupported prorated plan changes are disabled. The backend accepts one complete recurring plan line per invoice; promotions, trials, coupons, metered prices, custom quantities and extra invoice items are not supported in this release.

## 3. Webhook

Production endpoint: **`https://www.editingapp.live/api/billing/webhook`**. Use Stripe API version **`2026-08-26.dahlia`** with these events:

- `invoice.paid`
- `invoice.payment_failed`
- `customer.subscription.created`
- `customer.subscription.updated`
- `customer.subscription.deleted`
- `charge.refunded`
- `charge.dispute.created`

In Stripe, create a webhook event destination for **your account**, using that exact HTTPS endpoint (not the homepage or checkout route). Select the seven events above and copy its signing secret into `STRIPE_WEBHOOK_SECRET` in Vercel. Keep `APP_URL=https://www.editingapp.live` in production. Stripe sends POST requests; opening the endpoint in a browser is not a valid test.

Optional CLI alternative: set `STRIPE_SECRET_KEY` and `APP_URL` in the ignored `.env.local`, then run `npm run billing:setup`. This script now sets up only the webhook, and writes the secret to the ignored `.env.stripe.generated`; it does not emit price or portal ID variables. An existing webhook's signing secret cannot be read back by API—copy it from Stripe's endpoint details. For localhost, use Stripe CLI forwarding to `/api/billing/webhook` with its displayed signing secret. Never mix test and live mode.

The raw body and Stripe signature are verified before processing. Invoice/customer/subscription data is retrieved server-side. Only complete paid plan invoices issue credits; duplicate event IDs and duplicate invoice IDs cannot issue them twice. Returning from checkout never grants credits. An error applying a payment returns HTTP 500 so Stripe retries safely. Review failed deliveries in Stripe; do not manually create a replacement subscription just because a webhook is delayed.

Checkout reserves an attempt in Supabase and uses the same Stripe idempotency key on retry. An unfinished checkout stays reserved for up to one hour. Another plan cannot be opened during that reservation. Existing active/incomplete subscriptions must be managed in the portal. Cancel at period end, then choose another plan after the subscription ends.

## 4. Pricing and credits

| Plan    | Monthly charge | Monthly credits | Annual charge | Annual credits, upfront |
| ------- | -------------: | --------------: | ------------: | ----------------------: |
| Starter |            $19 |             600 |          $190 |                   7,200 |
| Creator |            $39 |           1,400 |          $390 |                  16,800 |
| Studio  |           $100 |           4,000 |        $1,000 |                  48,000 |

The user approved two free months annually. Annual billing charges ten monthly payments and issues twelve months of credits immediately. Credits expire at the end of that paid period. Monthly credits do not roll over. Welcome credits: 9 once per verified account, valid for 30 days. A standard image costs 3 credits; high detail costs 8. These costs apply to both photo tools. Earliest-expiring grants are consumed first.

Confirmed failed generations restore the original credits with their original expiry. Uncertain requests keep credits reserved and never automatically replay inference. Completed images consume credits even if a user dislikes or deletes them. Credit activity persists separately from photo cleanup.

The pricing budget assumes **up to $0.03 per standard / $0.08 per high-detail image** for planning. These are conservative internal estimates, not a provider spending guarantee. fal's verified 1024×1536 published values were $0.01029 medium / $0.04116 high, but actual input/output usage can vary. The previous screenshot of $0.05 for three images averages about $0.0167 per image only if those were the entire billed requests. Monitor real invoices and fal account spend. At the largest annual discount, one credit sells for about $0.0208 against a $0.01 internal cost budget, leaving about 52% before payment fees, taxes, storage and support **if the budget holds**.

`generation_limits` defaults: 100 attempts/account/day, 500/site/day, $25/day estimated provider budget. Reservations enforce this atomically even for simultaneous users. Failed and uncertain jobs still count toward the daily circuit breaker to deter repeated expensive attempts. Configure an actual spending alert/limit with fal too; local estimates cannot cap an unknown provider charge. Update `lib/plans.ts`, `generation_prices` through a migration, pricing copy, tests and Stripe prices together when changing economics. Do not edit prices for already paid grants retroactively.

## 5. Verify then activate production

1. Apply the migration to a test Supabase project. Set test credentials and `CREDITS_ENABLED=true` locally.
2. Confirm signup/return-link session, profile save, and the one-time welcome credit grant.
3. Complete a Stripe test checkout. Confirm the matching `invoice.paid` delivery returns 200, the correct credit grant appears once, and replaying it does not change the balance. Test a failed renewal and period-end cancellation too.
4. With a consented photo and funded fal key, test both figurine styles and both detail levels. Inspect likeness, real latency, actual cost, downloads and deletion. This is still required; browser fixtures are simulated.
5. Put the live `STRIPE_SECRET_KEY` and matching `STRIPE_WEBHOOK_SECRET` in Vercel Production environment variables. Preserve existing Supabase/fal keys. Apply the production credit migration if still pending, set `CREDITS_ENABLED=true`, and redeploy. Products, prices and portal settings are created automatically when first needed.
6. Verify a legitimate payment from the Stripe Dashboard against the credit ledger. Never use a fake success URL as payment verification. Monitor webhook failures and the fal cost budget.

The cron secret remains optional. Generation, subscriptions, profile editing, manual deletion and credit expiry do not need a cron key. Existing scheduled photo cleanup needs `CRON_SECRET` only if the operator enables that route; subscription credits are driven by Stripe webhooks, not a cron job.

## Refund/dispute review and account deletion

A verified refund or dispute event places the customer's account on a billing hold, blocking generation and new checkout. It does not silently delete history or automatically assume that spent credits can be recovered. The operator must inspect the invoice, its grant and allocations, decide the adjustment required, record it in the ledger, and clear `billing_hold` only after reconciliation. Do not clear a hold without reviewing both paid and spent credits. Immediate prorated upgrades and automatic dispute reconciliation are remaining limitations.

Credit/billing rows intentionally restrict account deletion to prevent orphaned financial records. For a deletion request, cancel/reconcile the Stripe subscription, delete private photos, follow applicable billing-record retention requirements, and perform the scoped account-data deletion or anonymization before deleting `auth.users`. Never run a blanket deletion over billing tables.

Official references: [Checkout subscriptions](https://docs.stripe.com/api/checkout/sessions/create), [webhook signatures and delivery](https://docs.stripe.com/webhooks), [invoice object](https://docs.stripe.com/api/invoices/object), [invoice lines](https://docs.stripe.com/api/invoice-line-item/object), [customer portal](https://docs.stripe.com/api/billing_portal/sessions/create), [fal model API](https://fal.ai/models/openai/gpt-image-2.5/sunburst/edit/api).

Automatic configuration references, checked September 13: [price lookup keys](https://docs.stripe.com/api/prices/list), [price creation](https://docs.stripe.com/api/prices/create), [Stripe idempotent requests](https://docs.stripe.com/api/idempotent_requests). Portal configuration payloads are validated against the installed official Stripe SDK types.
