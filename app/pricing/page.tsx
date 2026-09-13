import Link from "next/link";
import { Header, Footer } from "@/components/chrome";
import { PricingCards } from "@/components/pricing-cards";
import { billingConfigured } from "@/lib/server/stripe";
import { pageMetadata, breadcrumbs, jsonLd } from "@/lib/seo";
export const metadata = pageMetadata(
  "Plans & Credits for AI Photo Tools",
  "Choose EditingApp Starter, Creator or Studio plans from $19 monthly. Compare monthly and yearly credits for AI retro portraits and collectible figurine images.",
  "/pricing",
);
export default function PricingPage() {
  return (
    <>
      <Header />
      <main id="main" className="pricing-page">
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: jsonLd(
              breadcrumbs([
                { name: "Home", path: "/" },
                { name: "Pricing", path: "/pricing" },
              ]),
            ),
          }}
        />
        <nav className="breadcrumbs" aria-label="Breadcrumb">
          <Link href="/">Home</Link>
          <span>/</span>
          <span aria-current="page">Pricing</span>
        </nav>
        <div className="pricing-heading">
          <p className="eyebrow">ONE BALANCE. ALL YOUR IDEAS.</p>
          <h1>Make something worth keeping.</h1>
          <p>
            Choose the room you need to create. A standard image costs 3 credits
            and high detail costs 8, across both retro portraits and figurines.
          </p>
        </div>
        <PricingCards ready={billingConfigured()} />
        <section className="pricing-faq">
          <h2>Clear before you create.</h2>
          <details>
            <summary>How are credits added?</summary>
            <p>
              Credits are added after a confirmed subscription payment. Monthly
              plans issue a month’s credits at each paid renewal. Yearly plans
              charge once a year and issue all twelve months’ credits together.
              Unused credits expire at the end of that paid period.
            </p>
          </details>
          <details>
            <summary>What happens if generation fails?</summary>
            <p>
              A confirmed failure restores the credits to their original credit
              balance and expiry date. A request with an uncertain outcome keeps
              credits reserved while it is checked. A completed image uses
              credits even if you decide not to keep it.
            </p>
          </details>
          <details>
            <summary>Can I cancel or switch plans?</summary>
            <p>
              Manage payment methods, invoices and cancellation from your
              account. Cancellation stops the next renewal and keeps paid
              credits available until their expiry. This release supports
              choosing a new plan after the existing subscription ends;
              immediate prorated upgrades are not offered.
            </p>
          </details>
          <details>
            <summary>Is there a free way to try the tools?</summary>
            <p>
              When credit accounts are enabled, a verified account receives 9
              one-time welcome credits, valid for 30 days. That covers three
              standard images. If the site is still using its earlier allowance
              system, the retro studio displays the available daily allowance
              instead. No card is required to sign up.
            </p>
          </details>
        </section>
      </main>
      <Footer />
    </>
  );
}
