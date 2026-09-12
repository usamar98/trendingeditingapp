# fal integration decision — 12 September 2026

The user requested fal as the shared provider for the existing portrait tool and future features. This supersedes the **direct transport** recommendation in `RESEARCH.md`; the chosen model family remains GPT Image 2.5 Sunburst.

## Verified availability and request contract

fal publishes `openai/gpt-image-2.5/sunburst/edit`. Its schema supports reference `image_urls`, prompt, explicit image dimensions, medium/high quality, PNG output and one generated image. `sync_mode: true` returns media as a data URI and excludes output data from request history. The application supplies a normalized JPEG reference and requests 1024×1536 PNG. This is the same model family, but fal's endpoint is an alias, not the dated OpenAI snapshot previously used; exact upstream version pinning is not claimed. [Official model schema](https://fal.ai/models/openai/gpt-image-2.5/sunburst/edit/api).

The client uses the documented direct `fal.run` HTTP path with a single native `fetch` POST. This keeps the existing bounded portrait lifecycle and avoids SDK retries. It is not queue-backed: losing the response before saving output can lose a paid image. A future long-running workflow should use a persisted queue job rather than extending this request indefinitely. No latency benchmark or live likeness evaluation was performed. [Synchronous inference](https://fal.ai/docs/documentation/model-apis/inference/synchronous).

## Cost and usage

On the research date, fal's published technical table listed **$0.01029 medium** and **$0.04116 high** for a 1024×1536 image including one input image. These are reference figures, not fixed quotes for this app's prompt: prompt length, complexity, account pricing and usage affect billing. The user-facing product still displays one portrait allowance per submission, with three daily allowances; the operator funds API costs. The model response schema does not provide OpenAI's usage object, so this adapter stores `usage: null` rather than invented token counts. Review actual charges in fal. [Model pricing](https://fal.ai/models/openai/gpt-image-2.5/sunburst/edit).

## Photo handling and terms

Requests disable fal JSON-payload storage using `X-Fal-Store-IO: 0`. They disable automatic retries with `X-Fal-No-Retry: 1`. Inline images avoid a public input upload; an additional lifecycle preference requests one-hour expiry and denied public access for incidental hosted outputs. These settings do not establish zero retention for every operational/upstream record. The application's private Supabase originals and results still expire after 24 hours and are removed by cleanup or manual deletion. [Platform headers](https://fal.ai/docs/documentation/model-apis/common-parameters), [retention](https://fal.ai/docs/documentation/model-apis/media-expiration), [file ACLs](https://fal.ai/docs/documentation/model-apis/file-access-controls).

The fal model page is marked for commercial use. fal's terms allow API integrations serving end users, subject to fees, documentation, rights and acceptable use; they do not guarantee unique or non-infringing output. Review applicable provider conditions before launch. The privacy notice now discloses fal and upstream OpenAI processing instead of describing a direct OpenAI relationship. [fal terms](https://fal.ai/legal/terms-of-service), [privacy policy](https://fal.ai/legal/privacy-policy).

## Extension architecture

The model-search command queries fal's documented platform catalog, can retrieve a candidate's OpenAPI schema, and fetches pricing for an exact endpoint. The typed feature registry is the reviewed runtime mapping. An arbitrary catalog result cannot automatically become a billable endpoint. This separates convenient discovery from product-specific input validation and usage controls. See [extension guide](ADDING_FAL_FEATURES.md).

## Remaining acceptance work

`FAL_KEY` and Supabase credentials are needed for a live run. `CRON_SECRET` and a deployed scheduler are optional and only needed for automatic cleanup; otherwise stored files require manual deletion. Mocked HTTP tests verify the integration contract; they do not prove endpoint access, paid generation quality, operational latency or actual retention. A funded, consented live run and hosted Supabase ownership/deletion checks remain necessary.
