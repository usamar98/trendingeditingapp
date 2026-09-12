import { pageMetadata } from "@/lib/seo";
import { Header, Footer } from "@/components/chrome";
export const metadata = pageMetadata(
  "Terms of Use & Portrait Allowances",
  "Read EditingApp’s terms for AI retro portraits: photo permissions, daily usage allowances, downloads, responsible sharing and generation limitations.",
  "/terms",
);
export default function Terms() {
  return (
    <>
      <Header />
      <main id="main" className="legal">
        <p className="eyebrow">LAST UPDATED SEPTEMBER 12, 2026</p>
        <h1>A few studio ground rules.</h1>
        <h2>Use photos you have permission to edit</h2>
        <p>
          By submitting a photo, you confirm you are authorized to upload and
          edit it. Don’t use EditingApp for impersonation, harassment,
          deception, or content that violates someone’s rights. Label AI-created
          images honestly when sharing them.
        </p>
        <h2>Review your portrait</h2>
        <p>
          AI may change facial details or produce artifacts. Results are
          creative interpretations and are not identity documents, historical
          evidence, or guarantees of an exact likeness. Review the original and
          result before downloading.
        </p>
        <h2>Allowances and availability</h2>
        <p>
          The initial release provides three generations per verified email per
          UTC day, subject to a shared service limit. It collects no payment.
          Each generation uses one allowance. Confirmed failures release that
          allowance, while uncertain requests retain it to prevent repeated
          billable work. Service availability depends on the image provider and
          deployment configuration.
        </p>
        <h2>Your content</h2>
        <p>
          You keep your rights in your input. EditingApp grants you any rights
          it holds in your generated portrait, to the extent permitted by law.
          Outputs may not be unique or copyrightable, and third-party rights
          still apply. Commercial use requires that you have the relevant rights
          to the input and depicted people. See the{" "}
          <a href="https://fal.ai/legal/terms-of-service">
            fal Terms of Service
          </a>
          .
        </p>
        <h2>Photo handling</h2>
        <p>
          Read the <a href="/privacy">photo privacy notice</a> before
          submitting. Download your results before the 24-hour access window
          ends. EditingApp does not publish or post to social accounts for you.
        </p>
      </main>
      <Footer />
    </>
  );
}
