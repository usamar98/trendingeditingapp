import Link from "next/link";
import { Header, Footer } from "@/components/chrome";
import { GuideCards } from "@/components/guide-cards";
import { breadcrumbs, jsonLd, pageMetadata } from "@/lib/seo";

export const metadata = pageMetadata(
  "Retro Photo Guides: 80s Prompts & Selfie Tips",
  "Find your retro portrait style with original 1980s AI photo prompts, selfie preparation tips and a practical guide to reviewing your facial likeness.",
  "/guides",
);

export default function GuidesPage() {
  return (
    <>
      <Header />
      <main id="main" className="guides-hub">
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: jsonLd(
              breadcrumbs([
                { name: "Home", path: "/" },
                { name: "Photo guides", path: "/guides" },
              ]),
            ),
          }}
        />
        <nav className="breadcrumbs" aria-label="Breadcrumb">
          <Link href="/">Home</Link>
          <span aria-hidden="true">/</span>
          <span aria-current="page">Photo guides</span>
        </nav>
        <div className="guide-hub-heading">
          <p className="eyebrow">THE EDITINGAPP NOTEBOOK</p>
          <h1>A little direction for your trip back in time.</h1>
          <p>
            Explore the details behind an 80s AI photo, choose a clearer selfie
            and learn what to look for in the finished portrait. These guides
            explain the three styles available in EditingApp and the limits to
            keep in mind when reviewing an AI edit.
          </p>
        </div>
        <h2 className="guide-hub-subtitle">Retro portrait guides</h2>
        <GuideCards />
        <section className="guide-cta">
          <h2>Prefer to start with a style?</h2>
          <p>
            The studio has three ready-made presets, so you do not need to write
            or paste a prompt. Select a look, preview a selfie, check your
            allowance and review the result before downloading.
          </p>
          <Link href="/#studio" className="primary">
            Open the portrait studio
          </Link>
        </section>
      </main>
      <Footer />
    </>
  );
}
