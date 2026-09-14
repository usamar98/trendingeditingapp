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

| Support code                                             | Check                                                                                                                                                |
| -------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------- |
| `VIDEO_SAVING`                                           | The queue finished processing; result retrieval/save is in progress.                                                                                 |
| `VIDEO_STATUS_UNAVAILABLE` / `VIDEO_RESULT_UNAVAILABLE`  | fal queue availability, key scope and existing request status.                                                                                       |
| `VIDEO_CDN_AUTH_UNAVAILABLE`                             | The server's FAL_KEY must belong to the output's owner and successfully exchange for a CDN token.                                                    |
| `VIDEO_OUTPUT_URL_UNSUPPORTED`                           | Inspect the result URL server-side. Only reviewed private fal CDN v3 URLs are accepted. Do not make files public or disable URL validation.          |
| `VIDEO_DOWNLOAD_UNAVAILABLE`                             | Private CDN access, expiration and HTTP status in logs.                                                                                              |
| `VIDEO_ACCESS_DENIED`                                    | fal refused the private output. Check that production FAL_KEY belongs to the fal account/team that generated it; see the 403 procedure below.        |
| `VIDEO_ASSET_AUTH_UNAVAILABLE`                           | Platform Storage signing rejected the API key. Check `assets:read` permission and that the key belongs to the account/team which generated the file. |
| `VIDEO_SIGNING_UNAVAILABLE` / `VIDEO_SIGNED_URL_INVALID` | The private download fallback could not obtain a valid, bounded signed URL for the exact same file.                                                  |
| `VIDEO_OUTPUT_MISSING` / `VIDEO_OUTPUT_INVALID`          | Inspect the existing fal result's schema/container and duration.                                                                                     |
| `VIDEO_STORAGE_UNAVAILABLE`                              | Private `videos` bucket, storage limits and Supabase service credential.                                                                             |
| `VIDEO_SAVE_UNAVAILABLE` / `VIDEO_RECOVERY_UNAVAILABLE`  | Database availability, video migration and worker lease.                                                                                             |
| `VIDEO_CHECK_UNAVAILABLE`                                | Database/auth lookup or lease operation could not complete; retry the same status check.                                                             |

After fixing the underlying configuration or provider issue, check the same job
again. An already saved MP4 is recovered without fetching or generating it again.
Webhooks return 503 while delivery is pending so fal can retry delivery.
Photo/video access lasts 24 hours; expired or deleted media may be unrecoverable.
Do not promise recovery or a refund until the live job has been checked.

No new environment variables or migrations are needed for this recovery update.

## Private video access and 403 recovery

The server signs private output using the current fal Platform Storage API:

```text
POST https://api.fal.ai/v1/storage/files/sign?url=<encoded validated output URL>
Authorization: Key <server FAL_KEY>
Content-Type: application/json

{"expiration_seconds":300}
```

This endpoint requires **`assets:read`** and returns JSON with a `signed_url`.
Its signature grants temporary read access regardless of the file ACL. The file
stays private; the app never changes its ACL. This replaces the CDN-token read
and CDN `/sign` flow that both failed with access denial in production.

The app accepts only the same file path on the reviewed `v3b.fal.media` or
`v3.fal.media` hosts, with one nonempty `identity` query parameter. The Platform
API documents the `v3` alias. Downloading sends no Authorization header, disallows
redirects and retains the 50 MB limit. URLs and credentials stay server-side and
are never included in application logs or public job details.

HTTP 401/403 from Platform signing becomes `VIDEO_ASSET_AUTH_UNAVAILABLE`;
HTTP 401/403 from the signed file download becomes `VIDEO_ACCESS_DENIED`. Both
retain the request and its credit reservation without resubmitting generation.
Missing, malformed or expired output is not assumed to be a generation failure.

If access remains denied:

1. Check the live job's `provider_request_id` with the read-only SQL above and find
   that existing request in the correct fal account/team.
2. Verify Vercel's production `FAL_KEY` was issued by that account/team and has
   `assets:read`. Redeploy after correcting the key or its permissions; do not
   generate a new video as a test.
3. Check the existing EditingApp request again. If the key has the required access
   but delivery remains denied, escalate the request ID and error stage to fal
   support without including credentials or publicizing the file.
4. Review the credit reservation separately if delivery is unrecoverable, using the
   atomic settlement flow. A 403 alone must not trigger a failure refund or cleanup.

The Platform signing and failure paths are covered by simulated provider tests. Recovery of
the reported production request requires a credentialed status check; local passing
tests do not establish that its video was delivered or its credits refunded.

## References and verification

Reviewed September 14, 2026:

- [fal queue lifecycle](https://fal.ai/docs/documentation/model-apis/inference/queue)
- [fal model errors](https://fal.ai/docs/documentation/model-apis/errors)
- [fal private file authentication](https://fal.ai/docs/documentation/model-apis/file-access-controls)
- [fal Platform Storage permissions](https://fal.ai/docs/api-reference/platform-apis/for-storage)
- [fal Platform Sign file URL schema](https://fal.ai/docs/platform-apis/v1/storage/files/sign)
- [Kling v3 image-to-video schema and public sample](https://fal.ai/models/fal-ai/kling-video/v3/standard/image-to-video/api)

The published fal sample MP4 passed the container validator (5.042 seconds,
1284 × 716). Regression tests use simulated provider/storage responses and synthetic
MP4s. Neither is proof that a particular user's credentialed request succeeded.
