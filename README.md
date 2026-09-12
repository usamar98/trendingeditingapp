# EditingApp — AI Retro Portrait Generator

Native **Next.js 16.3.5 + TypeScript**, Supabase Auth/Postgres/private Storage, and a real server-only **fal** image-edit integration using **GPT Image 2.5 Sunburst**. See [research and provider comparison](docs/RESEARCH.md) and [fal integration research](docs/FAL.md).

## What works

- Responsive, indexable landing page and three presets: 80s Studio, Retro Cinema, Vintage Family Album.
- Local selfie preview, JPG/PNG/WebP validation, server decoding, dimension/pixel/size limits and EXIF removal.
- Email OTP sign-in, three daily portrait allowances, a 50-attempt daily site cap, and bounded email-send attempts.
- Private originals/results, generation states, reload recovery, comparison slider and side-by-side views.
- Portrait download, browser-composed labeled before-and-after PNG, manual deletion and expiry cleanup.
- Sitemap, robots, canonical metadata, WebApplication JSON-LD, Open Graph image, privacy and terms pages.

**Live generation is not enabled in this checkout.** No fal/Supabase secrets were available. Demo images are labeled illustrations. Tests use fixtures and mocks explicitly; there is no production mock-mode switch.

## Local setup

Requires Node **22.14+** and npm. From the project directory:

```sh
npm ci --include=dev
cp .env.example .env.local
npm run dev
```

On PowerShell use `Copy-Item .env.example .env.local`. Set the values below in `.env.local` without committing it. The provided local preview uses port **3001**, so its local-only `.env.local` sets `APP_URL=http://localhost:3001`. To use that port explicitly: `npm run dev -- --port 3001`. The default example uses port 3000.

| Environment variable        | Purpose                                                                                                                     |
| --------------------------- | --------------------------------------------------------------------------------------------------------------------------- |
| `FAL_KEY`                   | Server fal key with credits and access to `openai/gpt-image-2.5/sunburst/edit`. A separate OpenAI key is not used.          |
| `SUPABASE_URL`              | Your Supabase project URL.                                                                                                  |
| `SUPABASE_ANON_KEY`         | Supabase publishable/anon key used on the server for Auth.                                                                  |
| `SUPABASE_SERVICE_ROLE_KEY` | Service role for protected database and storage operations. Never expose to the browser.                                    |
| `APP_URL`                   | Exact public origin, e.g. `https://your-domain.com`. Used for canonical metadata and same-origin checks. No trailing slash. |
| `CRON_SECRET`               | Random secret of at least 32 bytes for the cleanup endpoint.                                                                |

All variables are server-side. Nothing uses `NEXT_PUBLIC_*`. Generation deliberately fails closed if any required setting is absent.

## Supabase setup

1. Create a Supabase project in an appropriate region. Apply **both migrations in filename order** from `supabase/migrations/` using the SQL editor, or link the Supabase CLI project and run `supabase db push`. Existing installations need only `202609120002_fal_provider.sql`; it preserves the provider identity on legacy jobs and defaults new jobs to fal.
2. Enable email authentication and signup; disable anonymous sign-ins. Configure the Auth site URL to `APP_URL`.
3. Set **both the Confirm signup and Magic Link email templates** to display the OTP: `<p>Your EditingApp code is: <strong>{{ .Token }}</strong></p>`. The UI accepts 6–8 digits and verifies with type `email`. Configure OTP expiry and email-send limits in Supabase.
4. Configure production SMTP with a verified sender. Supabase's development email service is not appropriate for public arbitrary-recipient signup. Test both new and existing accounts.
5. Confirm the `portraits` bucket is **private**. The migration applies restrictive policies denying browser access even if other bucket policies exist. All photo requests pass through authenticated server routes. Job metadata RLS allows users to read only their own records; mutations and reservation RPCs are service-role only.
6. Schedule cleanup **hourly**. `GET /api/cron/cleanup` requires `Authorization: Bearer <CRON_SECRET>`. `vercel.json` contains the hourly schedule; use a plan that supports that frequency or an external scheduler. Access expires after 24 hours even if cleanup is delayed. Monitor non-200 responses. The endpoint deletes up to 100 jobs per invocation and reports `morePossible`.

Migration limits: three non-failed allowances/user/UTC day, ten total attempts/user/day, fifty total attempts/site/day, one active job/user, and three OTP send attempts/address/hour plus thirty site-wide/hour. User and site quotas are atomically reserved in PostgreSQL, not memory. Editing photo deletion never refunds a spent allowance. Confirmed pre-provider/provider failures release it; unknown outcomes retain it.

Auth-email hashes persist up to one day and are pruned on subsequent email attempts. Job metadata is purged after 30 days by cleanup. To delete an account: remove its photo objects through the Storage API, remove its job rows, then delete the Auth user. A foreign-key restriction prevents accidental Auth deletion from silently orphaning photos.

## Deployment

Use a Node-compatible Next.js host (for example Vercel) with image-processing support and a **300-second function timeout**. This implementation is not a static export and is not compatible with the Vinext Sites starter without a separate port.

1. Import this directory/repository. Set the environment variables for production and any preview environment; each needs its own exact `APP_URL`.
2. Install with `npm ci --include=dev`; build with `npm run build`; start with `npm run start` for a long-running Node host. Keep the process alive through request completion. Do not use a host that terminates image requests after a short timeout.
3. Run the Supabase migrations, set SMTP/templates, and enable the hourly cleanup schedule. Configure fal credits, account spending controls and alerts.
4. Configure the canonical domain **before building**, then rebuild after changing it. Add the operator’s privacy-contact details to the privacy page before public launch.
5. With credentials enabled, run a consented selfie through every preset, confirm likeness/quality and actual billed cost in fal, download both formats, reload during processing, and test private access from a second account. Trigger a controlled provider rejection and verify allowance handling. This live acceptance pass remains outstanding.

There is no checkout, subscription, payment collection, public gallery or automatic social posting in this focused release. Operator-funded free allowance is a product choice, not a statement that API calls are free.

## Retry and failure behavior

The browser persists a UUID before submission. A database RPC atomically grants the first caller permission to dispatch. Repeated IDs return the existing job; conflicting payloads are rejected. Active identical payloads with different IDs also reuse the existing job. Native `fetch` performs exactly one direct fal POST with automatic retries disabled. On timeout or ambiguous provider failure the job is `uncertain`; status checks never call the provider. A result written to storage before a database failure can be recovered. Crashes before output storage can lose a paid result; the app keeps the allowance reserved rather than risking duplicate charges. Provider/model metadata and the returned request ID, when available, help reconcile fal billing. Request-payload history is disabled, so it cannot be used to recover lost images.

## fal integration and future features

`lib/server/ai/fal.ts` owns authentication, bounded responses, timeouts, privacy headers and sanitized errors. `lib/server/ai/registry.ts` maps each feature to an explicit fal endpoint, typed input builder and output decoder. `runFeature()` resolves that mapping; the browser never supplies model URLs or API keys. The portrait adapter uses inline JPEG input and PNG output with `sync_mode: true`, avoiding public photo URLs. It sends `X-Fal-Store-IO: 0`, `X-Fal-No-Retry: 1` and a private, one-hour lifecycle preference for incidental hosted output. Provider policies remain separate from local deletion.

Discover models from fal's official catalog, including full schemas and account pricing:

```sh
npm run fal:discover -- --query "background removal"
npm run fal:discover -- --endpoint openai/gpt-image-2.5/sunburst/edit
```

These commands are read-only and use `FAL_KEY` from `.env.local`. They return candidates and documentation links; they do not generate images or activate arbitrary models. Follow [Adding fal features](docs/ADDING_FAL_FEATURES.md) to register a future tool with its own schema and usage rules. Long-running video features need a durable queue worker before activation. There is no automatic provider fallback.

## Verification

```sh
npm run lint
npm run typecheck
npm run test
npm run build
npm run test:e2e
```

Browser tests use installed Chrome and port 3001, with desktop/mobile viewports. They exercise local validation and unavailable configuration against the actual app, then deliberately intercept Auth/generation responses to test success, failure, connection loss, comparison and both downloads. Vitest validates the provider wire contract, server-side upload decoding, generation lifecycle, and the exact SQL migration using PGlite PostgreSQL. This does not replace a hosted Supabase/storage/auth integration test.

See [verification record](docs/VERIFICATION.md) for executed results and remaining limits.
