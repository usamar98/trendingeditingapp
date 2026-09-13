import { pageMetadata } from "@/lib/seo";
import { Header, Footer } from "@/components/chrome";
export const metadata = pageMetadata(
  "Terms of Use, Credits & Subscriptions",
  "Read EditingApp’s terms for AI photo tools, subscription renewals, credit expiry, failed generations, photo permissions and responsible sharing.",
  "/terms",
);
export default function Terms() {
  return (
    <>
      <Header />
      <main id="main" className="legal">
        <p className="eyebrow">LAST UPDATED SEPTEMBER 13, 2026</p>
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
        <h2>Credits and availability</h2>
        <p>
          A standard image uses 3 credits and a high-detail image uses 8.
          Confirmed failures restore credits with their original expiry date;
          uncertain requests keep them reserved until resolved. Completed images
          use credits even if you decide not to keep them. Accounts on the
          earlier daily allowance system see that allowance in the studio.
          Shared service limits apply to all accounts; plans do not promise
          unlimited generation or a particular processing time.
        </p>
        <h2>Subscriptions and renewal</h2>
        <p>
          Starter is $19 monthly for 600 credits, Creator is $39 for 1,400, and
          Studio is $100 for 4,000. Yearly plans are $190 for 7,200 credits,
          $390 for 16,800, or $1,000 for 48,000. Prices are in USD. Yearly
          credits are issued in full after the annual payment. Monthly credits
          are issued after each paid renewal. Credits expire at the end of the
          paid period and do not roll over. Welcome credits are issued once per
          verified account and expire after 30 days.
        </p>
        <p>
          Subscriptions renew automatically until canceled. Use Profile &amp;
          credits → Manage subscription to cancel before the next renewal.
          Cancellation preserves access to remaining credits until their
          existing expiry. This release does not offer immediate prorated plan
          changes; choose another plan after your existing subscription ends.
          Credits are personal usage units, not cash or a transferable balance.
        </p>
        <h2>Refunds and payment issues</h2>
        <p>
          A failed generation credit refund is separate from a subscription
          payment refund. Payment refunds and disputes require review against
          paid invoices and used credits. A refund or dispute may pause
          generation while the account is reconciled. Cancellation by itself
          does not issue a payment refund. These terms do not limit refund or
          cancellation rights that apply under local law.
        </p>
        <h2>Image tools and examples</h2>
        <p>
          Figurines are flat PNG images of imagined collectibles. They are not
          physical products, STL files or rotatable 3D models. Examples feature
          fictional AI-created people and do not guarantee the quality or
          likeness of your result.
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
