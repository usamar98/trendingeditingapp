# EditingApp SEO implementation — September 12, 2026

## Findings and intent

The current product is an AI retro portrait generator, not the site's previous collection of features. The homepage should answer the transactional intent; useful guides support prompt and troubleshooting searches. The initial production sitemap had double slashes in `/privacy` and `/terms` URLs because the configured origin ended in `/`. It contained only the homepage and legal pages.

| Evidence checked                                                                                                                                                                         | What it supports                                                                                  | Limit                                                                                                                        |
| ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------- |
| [The Indian Express, September 10, 2026](https://indianexpress.com/article/trending/trending-in-india/chatgpt-80s-photo-trend-prompt-10870120/)                                          | Recent interest in 1980s AI photo transformations and prompt instructions                         | Social reporting, not a measured search-volume series                                                                        |
| [The Star, September 11, 2026](https://www.the-star.co.ke/news/2026-09-11-ai-trend-brings-1980s-style-back-on-social-media)                                                              | Instagram and TikTok participation, including Kenya                                               | No independently audited reach or hashtag counts                                                                             |
| [Financial Express, September 11, 2026](https://www.financialexpress.com/life/technology-google-trends-chatgpt-download-surges-across-india-as-1980s-ai-photo-trend-goes-viral-4336971/) | Reports +700% growth for “1980s AI photo prompt ChatGPT” in an India-focused Google Trends report | Secondary reporting of measured growth; no reproducible raw export/baseline supplied. Not global volume or EditingApp demand |
| Search results sampled September 12 for 80s AI photo prompts and retro portrait generators                                                                                               | Both generator pages and explanatory prompt guides appear for related intent                      | No keyword-volume, difficulty, Google ranking or traffic estimate established                                                |

The public copy avoids quantified popularity claims. The prompts and practical guidance are original, describe supported one-person portrait features and distinguish illustrative examples from tested API outputs. Research and implementation do not prove ranking performance.

## Changes

- Kept the native Next.js 16.3.5 application; the [official metadata documentation](https://nextjs.org/docs/app/api-reference/functions/generate-metadata) also listed 16.3.5 during this check.
- Centralized origin normalization and per-page canonical/social metadata. Incorrect path/query-bearing APP_URL values fail explicitly; authentication continues to compare the request's exact origin.
- Clarified the homepage heading and description. Added server-rendered guides, a guide hub and an About page, with descriptive internal links to the real workflow.
- Added WebSite and Organization identity and accurate WebApplication offer information, plus Article and visible breadcrumb markup on guides. No fabricated reviews, ratings or author credentials.
- Expanded the sitemap to seven canonical public pages with honest content dates. Removed changefreq and priority, which Google ignores. Kept private/auth routes out of the sitemap and protected by existing controls. [Google's sitemap guidance](https://developers.google.com/search/docs/crawling-indexing/sitemaps/build-sitemap).
- Reused optimized local WebP demonstrations through Next Image, with descriptive alt text, bounded dimensions and explicit fictional-example captions. No new third-party scripts, font requests or client-side content dependency.
- Added optional Google HTML-tag verification configuration without replacing an existing DNS/file method. Prepared a public-file export kit and instructions specifically for an existing property after a feature change.

## Editorial and measurement decisions

Guide authorship is attributed to EditingApp as an organization. Published dates reflect this release. The comparison table is a description of preset directions, not a benchmark. Face preservation is an instruction and review goal, not a guaranteed capability. Keep these distinctions when adding real examples later.

Use Google Search Console to measure actual impressions, clicks, CTR, indexing and canonical selection after recrawling. This session has no authenticated Search Console metrics or inventory of old indexed feature URLs. Do not manufacture keyword statistics or guess redirect targets. Supply the old URL export for a precise migration map.

Prioritize relevant examples and answers over adding near-identical pages for every keyword. Google's [helpful-content guidance](https://developers.google.com/search/docs/fundamentals/creating-helpful-content) supports useful original material. The setup guide includes how to assess the new app separately from older queries.

## Verification and operating instructions

Local verification completed September 12, 2026: production build, lint and TypeScript passed; all 84 unit/integration tests and all 22 desktop/mobile browser tests passed. The new guide and About pages had no violations in the tested axe WCAG A/AA rules and no viewport overflow. Screenshots were visually reviewed. This is a lab check, not a measurement of live Core Web Vitals or Google's indexing.

Run `npm run build`, `npm run check` and `npm run test:e2e`. SEO tests cover origin normalization, sitemap exclusions, distinct server-rendered metadata, schema serialization, working internal links, true 404s, mobile overflow and accessibility. Existing generation tests exercise the workflow with clearly identified fixtures; no real portrait is generated by this SEO change.

Deploy main through the existing Vercel integration. Keep `APP_URL=https://www.editingapp.live` and preserve existing Supabase/fal credentials. `GOOGLE_SITE_VERIFICATION` is optional and only needed if using Google's HTML-tag method. No database migration or additional API key is needed for these SEO changes.

After the new deployment is live, run `npm run seo:export` to fetch the deployed sitemap, verify every listed page returns 200, and create the Search Console kit. Follow [the existing-property instructions](search-console/README.md). A successful local build or HTTP audit does not demonstrate that Google has indexed the update.
