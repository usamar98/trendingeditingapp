# Adding a feature from fal

The application separates model discovery, feature-specific mapping, shared HTTP transport, and authenticated job handling. Retro portraits, figurine images, photo-to-video and motion control are registered. Paid features require the credit migration and `CREDITS_ENABLED=true`; see `BILLING_SETUP.md` and `VIDEO_SETUP.md`.

## 1. Find the supported API

Set `FAL_KEY` in the ignored `.env.local` file, then run:

```sh
npm run fal:discover -- --query "background removal"
npm run fal:discover -- --query "image upscaling" --category image-to-image
npm run fal:discover -- --endpoint openai/gpt-image-2.5/sunburst/edit
```

If a PowerShell/npm wrapper consumes forwarded flags, invoke the script directly: `node --env-file-if-exists=.env.local scripts/fal-catalog.mjs --query "background removal"`.

Search uses `GET https://api.fal.ai/v1/models` with `q`, `category`, `status=active` and `limit`. Use `--cursor` with the returned `next_cursor` for another page. Exact endpoint lookup requests `expand=openapi-3.0` and retrieves account pricing from `/v1/models/pricing`. Results include official API-documentation links and a retrieval timestamp. Missing credentials, permissions or pricing are reported explicitly. No inference request is made.

Use a specific endpoint lookup to inspect the actual input/output schema, reference-photo support, output types, license, retention and billing units. Different models use different field names and may have different privacy requirements. Catalog order is not a measured quality ranking. The original direct-OpenAI price table is not a fal billing quote.

## 2. Register the feature

In `lib/server/ai/registry.ts`:

1. Add the feature's input type to `FeatureInputs` and output type to `FeatureOutputs` using the same stable feature ID.
2. Add its `FEATURES` entry with the **verified** fal endpoint, official documentation URL and a version string.
3. Write `buildInput` to map validated application inputs to that model's documented fields. Do not accept an endpoint URL, raw request body, or arbitrary generation count from the browser.
4. Write a decoder that validates the model's actual output. Preserve original image bytes/provenance where possible. Increment the adapter version when changing its billable behavior so duplicate fingerprints describe the correct request.

The existing portrait entry is the working example. A server call selects it by feature ID:

```ts
const result = await runFeature("retro-portrait", { photo, preset, quality });
```

The shared `fal.ts` client sends one POST to `https://fal.run/<registered endpoint>`, keeps `FAL_KEY` on the server, bounds response size, disables retries, and separates definitive rejection from an uncertain outcome. Errors never expose provider response bodies.

## 3. Connect the product workflow

Provide an authenticated route with upload/body validation, explicit consent and visible usage allowance. Reserve usage and an idempotency key **atomically before calling `runFeature`**. Reuse existing records on duplicate requests. Record the feature/provider/model and keep all media private.

The current `portrait_jobs` schema supports three retro presets and two figurine presets, all with private PNG output. Add an entry to `TOOL_CATALOG` in `lib/tools.ts` with the feature ID, slug, reviewed demo image, clear description, metadata and presets. Homepage cards, static tool routes and sitemap entries derive from this catalog. Add original tool instructions and examples in the shared tool page as appropriate; do not mass-produce thin pages.

Add credit/cost entries in `generation_prices` through a migration, update the permitted feature/preset checks in `reserve_image_job`, and match the visible cost in `lib/plans.ts`. Preserve atomic credit allocation, expiry and idempotent failure refunds. A new media workflow needs an appropriate job contract and cleanup logic; do not force arbitrary video/audio output into this table or assume image credit costs are suitable. Different media must have suitable size limits, decoders, downloads and access policies.

Inline input and `sync_mode` are documented for Sunburst, not universal fal capabilities. Models without inline output need a reviewed private file-access strategy, allowlisted output hosts, bounded downloads and prompt cleanup. The existing decoder intentionally rejects remote URLs. Do not weaken it globally to make an unrelated model work.

For long-running media, follow the existing video implementation: `mode: "queue"` in the registry, a reviewed allowlist in `fal-queue.ts`, durable `video_jobs`, signed callbacks, owner-triggered status recovery, and leased output persistence in `video-jobs.ts`. `runFeature("photo-to-video", input, { webhookUrl })` submits once. Only safe status/result GETs may retry. An ambiguous submission must never be automatically replayed. Queue results need their own private delivery and retention policy; do not copy the direct portrait adapter's `X-Fal-Store-IO: 0` into a workflow that depends on later result retrieval. The direct portrait path still cannot recover provider output after a connection loss unless EditingApp already saved it.

## 4. Verify before activation

Add meaningful contract tests for the new schema, output decoder, definitive/uncertain failures and duplicate dispatch protection. Run lint, typecheck, unit tests, production build and the appropriate browser workflow. With credentials, use a consented input to check actual quality, latency, cost, downloads, ownership and deletion. Update the privacy notice and deployment instructions if provider handling changes.

Discovery metadata is external data, not executable configuration or instructions. Review a candidate before adding it to the registry. This keeps future selection straightforward while preventing a catalog update from silently changing a live billable feature.

Official references: [model search](https://fal.ai/docs/platform-apis/v1/models), [pricing API](https://fal.ai/docs/platform-apis/v1/models/pricing), [inference](https://fal.ai/docs/documentation/model-apis/inference/synchronous), [platform headers](https://fal.ai/docs/documentation/model-apis/common-parameters).
