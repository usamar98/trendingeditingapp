import { pageMetadata } from "@/lib/seo";
import { Header, Footer } from "@/components/chrome";
export const metadata = pageMetadata(
  "Photo Privacy & Deletion",
  "Understand how EditingApp handles selfies and AI portraits, private photo access, provider processing, retention and your photo deletion controls.",
  "/privacy",
);
export default function Privacy() {
  return (
    <>
      <Header />
      <main id="main" className="legal">
        <p className="eyebrow">LAST UPDATED SEPTEMBER 13, 2026</p>
        <h1>Your photos stay personal.</h1>
        <p>
          EditingApp uses your photo to create the video, portrait or figurine
          image you request. It does not run a public gallery or train its own
          models on your photos.
        </p>
        <h2>Before you generate</h2>
        <p>
          Your selected photo is previewed locally in your browser. It is not
          uploaded until you submit a generation. Browser storage remembers only
          the last request ID so you can reconnect; it does not store image
          bytes.
        </p>
        <h2>When you generate</h2>
        <p>
          Your photo is checked and re-encoded to remove embedded metadata such
          as GPS location. A normalized copy is stored privately in Supabase and
          sent through fal to an OpenAI image-editing model. The generated
          portrait is also stored privately. EditingApp does not compute or
          store face-recognition embeddings.
        </p>
        <h2>Access and deletion</h2>
        <p>
          You must verify your email to generate or retrieve your photos.
          Downloads go through the server and require the same account. Photo
          access expires 24 hours after submission. When hourly cleanup is
          enabled, it removes expired files, normally within the following hour.
          Without scheduled cleanup, expired files remain privately stored until
          you or the operator delete them. If cleanup fails, access remains
          blocked and deletion resumes when it recovers. You can use “Delete
          photos now” after processing; an uncertain request may require a
          six-minute wait to avoid racing an active upload.
        </p>
        <p>
          Minimal request metadata supports duplicate-request protection and
          usage control. Cleanup removes expired records older than 30 days;
          without cleanup, they remain until the operator removes them. Deleting
          photos does not restore spent credits or allowance. Your
          authentication email remains in Supabase until the operator deletes
          your account. The operator must delete private storage objects before
          deleting an authentication user.
        </p>
        <h2>Provider processing and retention</h2>
        <p>
          EditingApp requests inline image output from fal and disables fal’s
          request-payload storage. Your selfie is sent as inline data rather
          than uploaded to a public file URL. As an additional safeguard,
          requests set a one-hour expiration and private access for any
          fal-hosted output files. These controls do not promise removal of all
          operational or upstream provider records. EditingApp’s delete control
          removes its own stored files; it cannot erase provider logs. See{" "}
          <a href="https://fal.ai/docs/documentation/model-apis/media-expiration">
            fal’s retention controls
          </a>
          ,{" "}
          <a href="https://fal.ai/legal/privacy-policy">fal’s privacy policy</a>{" "}
          and{" "}
          <a href="https://developers.openai.com/api/docs/guides/your-data">
            OpenAI’s data controls
          </a>
          .
        </p>
        <h2>Photo-to-video processing</h2>
        <p>
          Video generation sends a short-lived signed link to your privately
          stored photo through fal to Kling. Copy a Motion also sends a signed
          link to your reference MP4. Reference clips are not re-encoded: they
          may contain sound or embedded metadata, so export a clip without
          sensitive metadata before uploading. We request silent output. The
          photo itself is re-encoded to remove metadata.
        </p>
        <p>
          Video jobs use fal’s persistent queue so you can recover a result
          after closing the browser. Unlike inline image generation, queue
          input/output JSON is retained for recovery. After saving the MP4
          privately, EditingApp requests deletion of fal’s request payload and
          output file. This deletion API requires an admin-scoped fal key. If
          deletion is unavailable, fal’s default JSON retention is 30 days; the
          signed input links expire after one hour. We request private access
          and a 24-hour lifetime for fal CDN output files. These controls do not
          erase upstream processing records or override the provider’s policies.
        </p>
        <p>
          Your video downloads require the owning account and redirect to a
          private-storage link valid for at most 60 seconds. Anyone you share
          that temporary link with can use it until it expires. Access ends 24
          hours after submission. Delete files removes EditingApp’s copies; an
          in-flight or uncertain video can require up to a one-hour wait.
          Scheduled cleanup removes expired files, supplemented by cleanup when
          you revisit expired requests. Without either, inaccessible files
          remain privately stored until an operator deletes them. Video job and
          credit records remain for duplicate-charge protection and billing
          reconciliation.
        </p>
        <h2>Session cookies and your choices</h2>
        <p>
          Your verified email, optional display name and bio are stored in
          Supabase. Profiles are private to your account. Credit grants, expiry,
          deductions and refunds are recorded separately from photos so deleting
          a photo cannot reset usage.
        </p>
        <h2>Payments and account records</h2>
        <p>
          Stripe hosts checkout and the billing portal. It receives your billing
          email and payment details; EditingApp stores Stripe customer,
          subscription and invoice identifiers, plan status, payment event
          identifiers and credit activity. Card details are entered on Stripe
          and are not stored by EditingApp. Your selfies are not sent to Stripe.
          See <a href="https://stripe.com/privacy">Stripe’s privacy policy</a>{" "}
          for its processing practices.
        </p>
        <p>
          Billing and credit records do not follow the 24-hour photo expiry or
          30-day request cleanup. They are retained for account service, payment
          reconciliation and applicable recordkeeping obligations. Account
          deletion requires the operator to reconcile subscriptions and retained
          billing records before removing the authentication account.
        </p>
        <p>
          Essential, HTTP-only cookies keep you signed in. EditingApp includes
          no advertising trackers. Signing out removes your session; removing a
          selected selfie clears its preview. Only upload photos you have
          permission to process. Avoid including sensitive documents or other
          people in the background.
        </p>
        <p>
          Deployment operators are responsible for providing an accessible
          privacy contact, honoring account-deletion requests, choosing
          appropriate storage regions and maintaining the cleanup schedule.
        </p>
      </main>
      <Footer />
    </>
  );
}
