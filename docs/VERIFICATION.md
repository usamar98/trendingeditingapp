# Verification record

Completed locally on 12 September 2026 using Node 22.14.0 and Next.js 16.3.5.

| Check | Result |
| --- | --- |
| Production `next build` | Passed; landing, legal pages, metadata routes and OG card prerendered; authenticated APIs remain dynamic. |
| ESLint | Passed. |
| TypeScript `tsc --noEmit` | Passed. |
| Vitest | **34 tests passed** across six suites, including fal transport, catalog discovery and optional cleanup configuration. |
| Chrome desktop/mobile | **8 tests passed** across desktop 1440px and emulated iPhone 13 viewports. |
| Automated accessibility | No axe WCAG A/AA violations in tested landing/upload/error and generated-result states on both viewports. This is not a complete manual accessibility certification. |
| Image assets | Three local WebP demonstrations, approximately 57 KB, 70 KB and 74 KB, with dimensions reserved. |
| Dependency install audit | Reported zero known vulnerabilities at installation time. |

## What was exercised

- Actual application: server-rendered HTML, canonical and structured data presence, sitemap, robots, OG response, unavailable-provider state, invalid upload rejection, successful local preview, no horizontal overflow and protected cron authentication.
- Real upload-decoder logic: valid image normalization, metadata removal, spoofed MIME, corrupt content, SVG, oversized body without Content-Length, and undersized image rejection.
- Both exact SQL migrations in PGlite PostgreSQL: duplicate/concurrent reservations, conflict detection, active-job protection, daily allowances, failure-credit release, preservation of allowance state after deletion, client mutation/RPC privilege restrictions, private bucket configuration, legacy OpenAI provenance and fal defaults for new jobs.
- Server routes with injected dependency fakes: origin and authentication checks, validation before reservation, dispatch only on a fresh reservation, owner-scoped download lookup, no-store downloads, expired and incomplete image rejection.
- Optional cleanup configuration: generation is configured without `CRON_SECRET`; missing and incorrect cleanup credentials still return 401. The default Vercel configuration schedules no cron jobs.
- Generation lifecycle with fake provider/storage: original/result persistence, output validation, success/deletion, confirmed failure vs uncertain timeout, pre-dispatch storage failure and saved-result recovery without another provider call.
- fal adapter with mocked HTTP: exact Sunburst endpoint and JSON fields, inline reference/output, server authentication, privacy/retry headers, bounded streaming responses, missing credentials, rejected remote/malformed outputs, unknown feature rejection and HTTP 408/422/429/503 classification. No automatic retries or provider fallback.
- Read-only fal catalog with mocked HTTP: official query parameters, pagination, exact-endpoint OpenAPI expansion, account pricing lookup, unavailable pricing and sanitized errors. The real CLI help and missing-key failure were also executed; authenticated catalog discovery was not possible without FAL_KEY.
- Browser routes deliberately intercepted for test fixtures: email-code flow, portrait generation, failure, interrupted connection, original/result views, keyboard-operable slider, both downloads and manual photo deletion. The mock API is only in the test runner, never in production code.

Full-page screenshots and actual downloaded comparison PNGs are written to `test-results/` by Playwright. The displayed people are generated fictional demonstrations, not user photos or proof of live API quality. Screenshots were visually inspected during development; low-contrast text and over-broad focus styling found during checks were corrected.

## Remaining live acceptance work

No fal key or Supabase project credentials were available. The Docker executable was present but its Linux daemon was not running, so a full local Supabase stack was not started. No paid generation request, SMTP delivery, hosted Supabase Auth/Storage call, deployed cron or public deployment was completed.

After configuring credentials, apply the migration and run the live acceptance steps in the README. Specifically assess likeness on consented, varied selfies; verify output quality for all three presets; record p50/p95 latency and actual usage costs; test with two real accounts; confirm photo removal in storage; and verify scheduled cleanup. Production signup requires SMTP and an operator privacy contact. Field Core Web Vitals, Search Console visibility and organic conversions require a deployed site and real traffic.

Known limitations: no automated face-count or identity-similarity scoring; uncertain requests are never automatically regenerated; a server failure before saving output may lose a paid result; email-based allowances are not one-human-one-account verification; no payment system; mobile Chrome emulation is not real Safari device testing. Provider moderation and retention remain subject to fal and upstream-provider policies. The fal endpoint is an alias, not an independently pinned upstream model snapshot; no live equivalence or likeness benchmark is claimed.
