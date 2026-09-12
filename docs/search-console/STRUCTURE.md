# Public search structure

Canonical production origin: https://www.editingapp.live

| URL path                              | Purpose                                                   | Search intent                                       |
| ------------------------------------- | --------------------------------------------------------- | --------------------------------------------------- |
| `/`                                   | Working portrait studio and product explanation           | AI retro portrait generator; 80s AI photo generator |
| `/guides`                             | Guide navigation                                          | Retro portrait guidance                             |
| `/guides/1980s-ai-photo-prompts`      | Original prompts, three-style comparison and instructions | 1980s AI photo prompts; how to make 80s AI photos   |
| `/guides/better-ai-portrait-likeness` | Input preparation, comparison and troubleshooting         | Selfie tips; AI portrait does not look like me      |
| `/about`                              | Current product scope and example provenance              | EditingApp brand and product information            |
| `/privacy`                            | Photo processing, access and deletion                     | Photo privacy                                       |
| `/terms`                              | Permissions, allowances and responsible use               | Product terms                                       |

The homepage links to both guides. The header and footer link to the guide hub; guides link to one another and back to the studio. About, privacy and terms are reachable from the footer. The studio is on the homepage, not a separate thin landing page for each keyword.

`lib/site.ts` owns the list of public sitemap pages. Only add genuine, indexable pages that return 200 at their canonical URL. `lastModified` is a real content-edit date, never the current request time. When changing a guide, update its visible publication/update information, Article metadata and sitemap date consistently.

`app/sitemap.ts` and `app/robots.ts` generate the live XML and text endpoints. They normalize the configured origin so a trailing slash cannot produce `//privacy` or `//terms`. Set production `APP_URL=https://www.editingapp.live`; this same origin is used by auth and must match the public website.

API, authentication, private images, unknown routes and query-string variants are not listed in the sitemap. API/auth responses carry noindex headers, and photo access requires authentication. Robots rules do not provide privacy by themselves.

The home page describes Organization, WebSite and WebApplication entities. Guide pages use Article and visible BreadcrumbList data. No invented ratings, reviews or search metrics are included. The app is not eligible for Google's FAQ rich results as a general photo tool; visible FAQs still help users. Valid structured data does not guarantee a rich result.
