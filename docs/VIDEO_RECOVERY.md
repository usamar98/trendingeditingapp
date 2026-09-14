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

| Support code                                             | Check                                                                                                                                         |
| -------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------- |
| `VIDEO_SAVING`                                           | The queue finished processing; result retrieval/save is in progress.                                                                          |
| `VIDEO_STATUS_UNAVAILABLE` / `VIDEO_RESULT_UNAVAILABLE`  | fal queue availability, key scope and existing request status.                                                                                |
| `VIDEO_CDN_AUTH_UNAVAILABLE`                             | The server's FAL_KEY must belong to the output's owner and successfully exchange for a CDN token.                                             |
| `VIDEO_OUTPUT_URL_UNSUPPORTED`                           | Inspect the result URL server-side. Only reviewed private fal CDN v3 URLs are accepted. Do not make files public or disable URL validation.   |
| `VIDEO_DOWNLOAD_UNAVAILABLE`                             | Private CDN access, expiration and HTTP status in logs.                                                                                       |
| `VIDEO_ACCESS_DENIED`                                    | fal refused the private output. Check that production FAL_KEY belongs to the fal account/team that generated it; see the 403 procedure below. |
| `VIDEO_SIGNING_UNAVAILABLE` / `VIDEO_SIGNED_URL_INVALID` | The private download fallback could not obtain a valid, bounded signed URL for the exact same file.                                           |
| `VIDEO_OUTPUT_MISSING` / `VIDEO_OUTPUT_INVALID`          | Inspect the existing fal result's schema/container and duration.                                                                              |
| `VIDEO_STORAGE_UNAVAILABLE`                              | Private `videos` bucket, storage limits and Supabase service credential.                                                                      |
| `VIDEO_SAVE_UNAVAILABLE` / `VIDEO_RECOVERY_UNAVAILABLE`  | Database availability, video migration and worker lease.                                                                                      |
| `VIDEO_CHECK_UNAVAILABLE`                                | Database/auth lookup or lease operation could not complete; retry the same status check.                                                      |

After fixing the underlying configuration or provider issue, check the same job
again. An already saved MP4 is recovered without fetching or generating it again.
Webhooks return 503 while delivery is pending so fal can retry delivery.
Photo/video access lasts 24 hours; expired or deleted media may be unrecoverable.
Do not promise recovery or a refund until the live job has been checked.

No new environment variables or migrations are needed for this recovery update.

## Private CDN 403 recovery

The September 14 production report confirmed the queue status and result were
readable and the CDN token exchange succeeded, but downloading the output returned
HTTP 403. That establishes denied file access, not a generation failure or timeout.

On a direct download's 403, the server now tries fal's documented `/sign` endpoint
once with the CDN bearer token, `duration: 300` and `scope: ["read"]`. It validates
the returned text URL against the exact original HTTPS host and file path, permits
only one nonempty `identity` query parameter, and downloads without an Authorization
header. The signed credential stays on the server. Redirects, arbitrary hosts,
ACL changes and inference replays are prohibited; the 50 MB download bound remains.

A denied signing request or denied signed download becomes `VIDEO_ACCESS_DENIED`.
This fallback is an alternative authentication transport, not a way to grant a key
access to another account's files. It cannot repair a wrong-account key or guarantee
recovery of an expired output.

If access remains denied:

1. Check the live job's `provider_request_id` with the read-only SQL above and find
   that existing request in the correct fal account/team.
2. Verify Vercel's production `FAL_KEY` was issued by that account/team. Redeploy
   after correcting a mismatched key; do not generate a new video as a test.
3. Check the existing EditingApp request again. If the key is correct and both
   private read methods fail, escalate the request ID and access denial to fal
   support without including credentials or publicizing the file.
4. Review the credit reservation separately if delivery is unrecoverable, using the
   atomic settlement flow. A 403 alone must not trigger a failure refund or cleanup.

The fallback and failure paths are covered by simulated provider tests. Recovery of
the reported production request requires a credentialed status check; local passing
tests do not establish that its video was delivered or its credits refunded.

## References and verification

Reviewed September 13, 2026:

- [fal queue lifecycle](https://fal.ai/docs/documentation/model-apis/inference/queue)
- [fal model errors](https://fal.ai/docs/documentation/model-apis/errors)
- [fal private file authentication](https://fal.ai/docs/documentation/model-apis/file-access-controls)
- [Kling v3 image-to-video schema and public sample](https://fal.ai/models/fal-ai/kling-video/v3/standard/image-to-video/api)

The published fal sample MP4 passed the container validator (5.042 seconds,
1284 × 716). Regression tests use simulated provider/storage responses and synthetic
MP4s. Neither is proof that a particular user's credentialed request succeeded.
