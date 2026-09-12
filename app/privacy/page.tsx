import type { Metadata } from "next";
import { Header, Footer } from "@/components/chrome";
export const metadata: Metadata = {
  title: "Photo privacy",
  description:
    "How EditingApp processes and deletes your selfie and AI retro portraits.",
  alternates: { canonical: "/privacy" },
};
export default function Privacy() {
  return (
    <>
      <Header />
      <main id="main" className="legal">
        <p className="eyebrow">LAST UPDATED SEPTEMBER 12, 2026</p>
        <h1>Your photos stay personal.</h1>
        <p>
          EditingApp uses your photo to create the portrait you request. It does
          not run a public gallery or train its own models on your photos.
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
          photos does not restore spent allowance. Your authentication email
          remains in Supabase until the operator deletes your account. The
          operator must delete private storage objects before deleting an
          authentication user.
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
        <h2>Session cookies and your choices</h2>
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
