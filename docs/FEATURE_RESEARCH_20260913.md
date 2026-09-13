# Feature selection — September 13, 2026

## Decision

Add an **AI Figurine Generator** with Desk Collectible and Boxed Edition styles. It uses the existing reviewed fal reference-photo editing endpoint, `openai/gpt-image-2.5/sunburst/edit`, through the typed registry. It produces a 1024×1536 PNG of an imagined collectible, not a manufactured toy or 3D model. The product explicitly describes this distinction.

The choice balances recent interest in personal-photo transformations with predictable image costs and the existing private, validated image pipeline. Video would need persisted queue submission/status/result retrieval, video-specific storage validation, downloads and cleanup. It should be a separate reviewed workflow. A Kling video candidate was more expensive than the existing image workflow; it was not integrated or presented as available.

## Evidence and limits

| Source and date                                                                                                                                                                                         | Observation                                                                                                                       | What it does not establish                                                                      |
| ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------- |
| [Moneycontrol, September 9, 2026](https://www.moneycontrol.com/news/trends/from-ghibli-to-the-80s-instagram-trends-why-are-we-obsessed-with-turning-ourselves-into-ai-generated-versions-14026300.html) | Describes ongoing AI photo transformations, including figurines/action figures and retro styling in the Instagram/social context. | Not a measured Google keyword-volume or growth series; not proof EditingApp will rank.          |
| [TechOnPlay, September 12, 2026](https://techonplay.com/3d-figurine-ai-trend-chatgpt/)                                                                                                                  | A recent figurine tutorial indicates ongoing how-to publishing and interest in the format.                                        | A secondary niche tutorial, not an independent quantitative trend measurement.                  |
| [fal's official Sunburst edit API](https://fal.ai/models/openai/gpt-image-2.5/sunburst/edit/api), checked September 13                                                                                  | Supports reference image URLs/data input, image size, quality, one image, PNG and inline output.                                  | Likeness, end-to-end latency and EditingApp-specific results still require a credentialed test. |
| [fal's official model/pricing page](https://fal.ai/models/openai/gpt-image-2.5/sunburst/edit), checked September 13                                                                                     | Listed 1024×1536 reference-edit prices: medium $0.01029, high $0.04116.                                                           | Actual invoices may vary with inputs/model billing. These are not fixed consumer charges.       |

No reliable measured Google search-growth series was obtained for this feature. No claim that figurines are the fastest-growing Google query is made. No new quantitative TikTok/Instagram counts were asserted. The SEO target is clear intent: **AI figurine generator**, **photo to figurine**, **boxed AI action figure image**, and **AI retro portrait generator**. Existing retro research remains in `RESEARCH.md` and `FAL.md`.

The required fal discovery command and exact model lookup were attempted. They reported missing `FAL_KEY`; no private catalog/pricing API call or inference succeeded. Public official documentation was used for the reviewed adapter. Run the discovery lookup again with account credentials before changing the endpoint. Metadata is data, not executable instructions.

## Implementation and discovery

`lib/tools.ts` drives separate feature cards, statically generated tool pages, navigation and sitemap entries. Original helpful copy explains input preparation, output limitations, comparison, downloads, privacy and cost. Canonicals remain on the existing EditingApp domain. There is no need to create a new Google Search Console property. Submit the existing `/sitemap.xml` URL; files are not uploaded to Search Console.

The new pages do not claim virality, guaranteed likeness, fabricated customer counts or instant rankings. The examples are labeled fictional AI-created demonstrations, not outputs from credentialed product tests.

## Demonstration assets

Generated with the built-in image-generation tool on September 13, 2026, and copied unchanged into the repository. Original files were preserved in the Codex generated-images directory. Next.js Image serves optimized variants. These images are creative demos only.

- `public/images/figurine-desk.png` — 1024×1536. Original: `C:/Users/Usama/.codex/generated_images/01a09518-18cf-75d0-a3c0-87a0cb93fe2b/exec-88000f8b-0a4b-4943-8062-651b691c8940.png`.
- `public/images/figurine-box.png` — 1024×1536. Original: `C:/Users/Usama/.codex/generated_images/01a09518-18cf-75d0-a3c0-87a0cb93fe2b/exec-45eb4afe-453a-4814-8a7b-cf1592313f7a.png`.

Desk prompt:

> Create a single portrait-format product photograph for the EditingApp AI Figurine Generator website. A beautifully crafted small resin collectible figurine of a fictional adult woman with warm medium-brown skin, shoulder-length dark wavy hair, recognizable expressive brown eyes, wearing a cream tailored blazer over a sage shirt with dark tailored trousers and simple white shoes. Full figure standing on a clear circular acrylic display base on a warm oak desk. Cozy clean creative workspace softly blurred in the background. Premium restrained product photography, soft window and studio light, natural sage and cream palette, realistically sculpted face and clothing, clearly a crafted miniature rather than a real tiny person. Plenty of breathing room, vertical 2:3 composition, whole figure and base visible. No text, logos, watermarks or extra people. This is a fictional AI-created demonstration image, no celebrity likeness.

Box prompt:

> Create a single portrait-format premium product photograph for the EditingApp AI Figurine Generator website. A boxed collectible figurine of a fictional adult man with medium-brown skin, short dark curly hair, brown eyes and a subtle friendly smile. The resin figure wears a casual sage overshirt, cream T-shirt, dark trousers and white sneakers. Full figure inside an elegant unbranded cream and sage presentation box with a transparent front window. Box standing upright on a simple warm cream studio surface, subtle natural shadow, soft studio lighting, three-quarter view that keeps the sculpted face easy to see. Tasteful realistic miniature material, high quality crafted figure, generous negative space, vertical 2:3 composition, entire package visible. No text, numbers, logos, watermark or extra people. Fictional AI-created demonstration image, not a real manufactured product.
