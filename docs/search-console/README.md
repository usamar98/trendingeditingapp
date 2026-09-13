# Update EditingApp in your existing Google Search Console property

Prepared September 12, 2026 for the AI retro portrait release.

**Keep your existing property and verification.** The domain is still editingapp.live. New features and a new design do not require starting again. This deployment cannot itself change Google's indexed copy; Google needs to recrawl the updated pages.

## What you actually submit

Open [Google Search Console](https://search.google.com/search-console) and select your verified **editingapp.live** Domain property. If you use a URL-prefix property, select **https://www.editingapp.live/**. A property for only the non-www URL or the old vercel.app hostname does not cover the www URL; use a verified Domain property or add the correct prefix in that case.

1. Open **Sitemaps** under Indexing.
2. Submit **https://www.editingapp.live/sitemap.xml**. If the field already displays `https://www.editingapp.live/`, enter only `sitemap.xml`.
3. If that same sitemap is already submitted, Google can read its updated contents at the same URL. Open its report to check its fetch status; resubmit it if needed. It now lists ten current public pages, including the tool studios and pricing.
4. Open **URL Inspection** for **https://www.editingapp.live/**. Select **Test live URL**, inspect the current content, then **Request indexing** if available. Repeat for the two new guides in `urls-to-inspect.txt`. You do not need to request every legal page manually.
5. After Google recrawls, compare the Google-selected canonical with the declared www URL. The indexed report can show the old version until the next crawl.

You submit a **URL**, not a ZIP or a file upload. The sitemap and robots.txt are already served by the application. Their copies in this kit are for reference; do not add a second `public/sitemap.xml` or `public/robots.txt` to this Next.js project because the app already owns these routes. [Google's sitemap submission instructions](https://support.google.com/webmasters/answer/7451001) and [URL Inspection instructions](https://support.google.com/webmasters/answer/9012289).

## What to do with pages from the old app

Export old URLs from **Performance → Search results → Pages** and **Indexing → Pages**. Use `old-url-review.csv` as a worksheet; it is not a Google upload format.

- If a page still exists at the same URL, update the content and request recrawling. The homepage falls into this case.
- If an old feature has a genuinely equivalent new page, map the old path to that specific destination using a permanent redirect. Test it before deployment.
- If the old feature has no replacement, return a real 404 or 410. Unknown routes in this app already return 404. Do not redirect every retired feature to the homepage or restore unrelated pages solely to keep keywords.
- Remove obsolete sitemap submissions after confirming the new sitemap works. Removing a sitemap does not by itself remove those pages from Google's index.
- Do not use Change of Address when the domain has not changed. Avoid blanket Removals for the whole site just to update descriptions; that can hide current pages too.

No old URL inventory was supplied, so this release does not invent redirect mappings. Share the exported old URL list to implement accurate mappings. [Google's URL migration guidance](https://developers.google.com/search/docs/crawling-indexing/site-move-with-url-changes).

## Preserve verification

Do not delete an existing DNS verification record or Google HTML verification file. In **Settings → Ownership verification**, check the method if you are unsure. The live homepage inspected before this release did not contain a Google verification meta tag; your existing property may use DNS or another method.

This app supports `GOOGLE_SITE_VERIFICATION` if you use Google's HTML-tag method. Set it in Vercel to the **content value** Google gives you, then redeploy. Do not paste the entire meta tag. This is optional when your existing verification already works.

If Google requires an HTML file instead, use the exact filename and content Google provides, place that file under `public/`, deploy and verify its public URL. There is no generic verification file that works for every property. No new token or ownership file was invented for this kit. [Google's ownership verification methods](https://support.google.com/webmasters/answer/9008080).

## What to monitor after recrawling

Compare successive 28-day periods in Search results, filtering to the new homepage and guide URLs. Look at impressions, clicks, CTR and average position for relevant queries such as “80s AI photo”, “AI retro portrait generator” and “1980s AI photo prompts”. The older app's unrelated queries are a different baseline. Report actual observed queries rather than assuming the new app already ranks for those terms.

Check Page indexing for actionable errors and Core Web Vitals for real-user data when enough traffic exists. Keep metadata aligned with what the generator actually offers. Requesting indexing is not a ranking guarantee; no fixed recrawl or ranking deadline is promised.

## Kit contents

| File                   | Purpose                                                     |
| ---------------------- | ----------------------------------------------------------- |
| `README.md`            | These steps for the existing property                       |
| `sitemap.xml`          | Snapshot of the deployed sitemap; submit its website URL    |
| `robots.txt`           | Snapshot of crawl configuration, already hosted by Next.js  |
| `urls-to-inspect.txt`  | Current pages, ordered with the homepage and guides first   |
| `old-url-review.csv`   | Worksheet for old feature URLs and appropriate replacements |
| `STRUCTURE.md`         | Route map and maintenance instructions                      |
| `export-manifest.json` | Time and source of the public-file export                   |

Generate a fresh kit after deployment with `npm run seo:export`. It reads public URLs only and writes `deliverables/search-console/`. The ZIP is a convenient bundle for you; do not upload it to Search Console.
