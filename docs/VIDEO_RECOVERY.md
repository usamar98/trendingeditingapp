# Recovering a video request

Users should reopen **AI Photo to Video**, select their existing request in
**Your recent videos**, and choose **Check video status**. This only checks and
retrieves the existing fal request; it never submits another generation.
**Request details** shows the full EditingApp ID, movement, status and support code.

Photo and movement selection remain available as a local draft while a request is
pending. Selecting a draft does not change the existing request, upload files or
charge credits. Generating stays blocked until the selected request is resolved.
Persistent recovery errors pause automatic checks and show their support code
above the check button. A status check stops waiting after 45 seconds; the server
can still finish saving that same video. Switching requests cancels the old tab
check and prevents its delayed response from replacing the newly selected job.

Credits are reserved before submission. A confirmed failure uses
`settle_video_failure` to restore the original allocation once. An unknown outcome
or failed download keeps that reservation while the existing video is recovered.
Do not start another inference or manually change a balance to resolve an unknown
outcome. Restored grants keep their original expiry.

## Diagnose in Vercel and Supabase

Search Vercel logs for `Video recovery paused` and the EditingApp request ID.
Entries contain only job ID, recovery stage, fixed support code and optional HTTP
status. No provider response bodies, private file URLs or credentials are logged.

Run this read-only query in Supabase SQL Editor, replacing the UUID with the full
ID from Request details:

```sql
select id, preset, status, credits_charged, provider_request_id,
       error_code, created_at, expires_at, provider_cleaned, files_deleted
from public.video_jobs
where id = '00000000-0000-0000-0000-000000000000'::uuid;
```

Find that `provider_request_id` in fal Requests. Check the existing queue status
and result; do not use the Playground to run it again. The status endpoint can
say `COMPLETED` even when the result endpoint returns a model failure (HTTP 422).
EditingApp handles both the status error fields and structured/legacy 422 result
errors. Authentication errors, missing results, gateway errors and network timeouts
are not proof of failed generation and do not trigger a refund.

| Support code                                            | Check                                                                                                                                       |
| ------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------- |
| `VIDEO_SAVING`                                          | The queue finished processing; result retrieval/save is in progress.                                                                        |
| `VIDEO_STATUS_UNAVAILABLE` / `VIDEO_RESULT_UNAVAILABLE` | fal queue availability, key scope and existing request status.                                                                              |
| `VIDEO_CDN_AUTH_UNAVAILABLE`                            | The server's FAL_KEY must belong to the output's owner and successfully exchange for a CDN token.                                           |
| `VIDEO_OUTPUT_URL_UNSUPPORTED`                          | Inspect the result URL server-side. Only reviewed private fal CDN v3 URLs are accepted. Do not make files public or disable URL validation. |
| `VIDEO_DOWNLOAD_UNAVAILABLE`                            | Private CDN access, expiration and HTTP status in logs.                                                                                     |
| `VIDEO_OUTPUT_MISSING` / `VIDEO_OUTPUT_INVALID`         | Inspect the existing fal result's schema/container and duration.                                                                            |
| `VIDEO_STORAGE_UNAVAILABLE`                             | Private `videos` bucket, storage limits and Supabase service credential.                                                                    |
| `VIDEO_SAVE_UNAVAILABLE` / `VIDEO_RECOVERY_UNAVAILABLE` | Database availability, video migration and worker lease.                                                                                    |
| `VIDEO_CHECK_UNAVAILABLE`                               | Database/auth lookup or lease operation could not complete; retry the same status check.                                                    |

After fixing the underlying configuration or provider issue, check the same job
again. An already saved MP4 is recovered without fetching or generating it again.
Webhooks return 503 while delivery is pending so fal can retry delivery.
Photo/video access lasts 24 hours; expired or deleted media may be unrecoverable.
Do not promise recovery or a refund until the live job has been checked.

No new environment variables or migrations are needed for this recovery update.

## References and verification

Reviewed September 13, 2026:

- [fal queue lifecycle](https://fal.ai/docs/documentation/model-apis/inference/queue)
- [fal model errors](https://fal.ai/docs/documentation/model-apis/errors)
- [fal private file authentication](https://fal.ai/docs/documentation/model-apis/file-access-controls)
- [Kling v3 image-to-video schema and public sample](https://fal.ai/models/fal-ai/kling-video/v3/standard/image-to-video/api)

The published fal sample MP4 passed the container validator (5.042 seconds,
1284 × 716). Regression tests use simulated provider/storage responses and synthetic
MP4s. Neither is proof that a particular user's credentialed request succeeded.
