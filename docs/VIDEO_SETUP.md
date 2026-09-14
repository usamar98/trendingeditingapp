# Activate AI Photo to Video

Route: `https://www.editingapp.live/tools/ai-photo-to-video`.

## The one new Supabase file

For an installation that already has the credits/billing migration, open **Supabase → SQL Editor → New query**, paste and run the complete contents of:

[`supabase/migrations/202609130002_photo_video.sql`](../supabase/migrations/202609130002_photo_video.sql)

It adds private video jobs, per-preset prices, credit allocations, a private `videos` bucket, server-only access policies, atomic reservations/refunds, worker leases and the shared photo/video spend cap. It does not modify SMTP, existing photo objects or Stripe subscriptions. Run it once. If using the Supabase CLI, link the correct project and apply pending migrations with `supabase db push`; do not paste Markdown documentation into SQL Editor.

Fresh installations apply all four numbered migrations in filename order. Existing installations should apply only missing migrations. `202609130001_credits_billing_figures.sql` is required before the video file. Do not rerun the older migrations blindly.

## Vercel environment

**No new environment-variable names are required.** Reuse these existing server-only values:

- `FAL_KEY`: needs credits and access to `fal-ai/kling-video/v3/standard/image-to-video` and `fal-ai/kling-video/v3/standard/motion-control`, plus **`assets:read` permission** for the [Platform Storage signing API](https://fal.ai/docs/platform-apis/v1/storage/files/sign). Generating a video and reading its private output are separate capabilities. The same key needs **admin scope** for the payload-deletion API. With an inference-only key, private delivery or immediate provider cleanup can be denied. Do not put a key in chat or `NEXT_PUBLIC_*`.
- `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`: the same project used by existing accounts.
- `CREDITS_ENABLED=true`: set after the credits migration. Videos do not use the old daily free-image allowance.
- `APP_URL=https://www.editingapp.live`: the exact canonical public origin. Rebuild after a change. A publicly reachable origin is needed for callback recovery when the browser closes.

Existing Stripe keys continue to serve the same three plans. There are no new Stripe price IDs, webhook secrets, video endpoint variables or compulsory cron key. Nine welcome credits cover images but do not cover a 60-credit video.

fal receives the signed callback URL automatically on each submission. You do **not** register another webhook manually in fal or Stripe. The video callback path is `/api/videos/webhook`; its per-job token is derived on the server, and fal's Ed25519 signature is also verified. Existing Stripe endpoint remains `/api/billing/webhook`.

## Verify the rollout

1. Apply the SQL and check the `videos` bucket is private. In `video_prices`, verify cinematic/memory/breeze = 60 credits and motion = 90, with all four enabled. Mismatched prices disable submission rather than charging a stale display price.
2. Deploy the `main` commit in Vercel. Open `/api/videos`; `available: true` confirms the app's configuration and price-table checks, not provider credit/model access. Missing setup displays an honest unavailable state and does not run inference.
3. Use a test account with sufficient real credits and a photo/reference clip you have permission to send to fal. Test one five-second animation and one 3–5-second motion clip. Review the likeness, MP4 playback/download, actual charges ($0.42 / up to approximately $0.63 at the checked public rates) and observed latency. Do not use synthetic browser fixtures as proof of this live step.
4. Close the page while a job runs, return to recent videos, then test access from another signed-in account. A second account must receive 404 for the first account's job/media. Repeated status checks must not add fal inference requests or deduct credits.
5. Delete a completed result and verify private storage removal. Verify `provider_cleaned=true` for confirmed fal deletion. Test invalid uploads and a controlled provider rejection: only confirmed failures refund; network uncertainty keeps the original request and credits reserved.

Local production tests: `npm run check`, `npm run build`, `npm run test:e2e`. The browser tests require Chrome. The dev-only `ffmpeg-static` package creates a clearly synthetic moving test pattern; ffmpeg is not used by production requests. Production accepts bounded H.264 MP4 containers and validates their declared sample timing without executing a user-uploaded codec.

## Costs, limits and cleanup

Animation is five silent seconds for 60 credits. Copy a Motion accepts a 3–5-second H.264 MP4 under 3 MB for 90 credits. The photo and reference together must fit under 4 MB; photos must be at least 300 pixels per side. Generated downloads are bounded to 50 MB and delivered through short-lived owner-authorized storage links to avoid Vercel's response-body limit. Use **Reload preview** if a signed playback link expires.

Credits are atomically reserved before dispatch. Database leases serialize callbacks, status recovery and deletion. Confirmed failures refund each original grant once, preserving its expiry. A connection failure after submission cannot prove that fal did not accept the job: there is no automatic second POST. A signed callback can recover the ID if the submission response was lost. If no result/ID is recoverable, an operator must reconcile fal logs and use the reviewed billing process; do not blindly resubmit or refund uncertain jobs.

Photo/video access ends 24 hours after submission. Files can be manually deleted; interrupted jobs can be deleted after one hour to avoid racing active processing. Visiting recent history opportunistically cleans up a few expired files. This is **not** guaranteed physical deletion at 24 hours for inactive accounts. The existing optional `/api/cron/cleanup` deletes up to ten expired videos per invocation alongside photo cleanup, and requires the existing optional `CRON_SECRET`. Without a scheduler, operators must periodically remove expired private storage through the Storage API. Video job/credit metadata stays for billing reconciliation. Do not delete billing rows merely to reclaim storage.

Before model/pricing changes, use `fal:discover`, review its schema and account price, version the adapter, update `video_prices` and `lib/video.ts` together, and run regression tests. Emergency pause: set `video_prices.enabled=false` through the service/operator SQL interface; status checks and existing downloads still work. Do not drop the tables to pause generation.
