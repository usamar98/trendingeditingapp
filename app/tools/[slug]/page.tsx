import Link from "next/link";
import Image from "next/image";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { Header, Footer } from "@/components/chrome";
import Studio from "@/components/studio";
import { TOOL_CATALOG, findTool } from "@/lib/tools";
import { breadcrumbs, jsonLd, pageMetadata } from "@/lib/seo";
import { siteUrl } from "@/lib/site";
import { GuideCards } from "@/components/guide-cards";
export function generateStaticParams() {
  return TOOL_CATALOG.map(({ slug }) => ({ slug }));
}
export const dynamicParams = false;
type Props = { params: Promise<{ slug: string }> };
export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const tool = findTool((await params).slug);
  if (!tool) notFound();
  return pageMetadata(tool.title, tool.meta, `/tools/${tool.slug}`);
}
export default async function ToolPage({ params }: Props) {
  const tool = findTool((await params).slug);
  if (!tool) notFound();
  const figurine = tool.id === "ai-figurine";
  return (
    <>
      <Header />
      <main id="main" className="tool-page">
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: jsonLd([
              breadcrumbs([
                { name: "Home", path: "/" },
                { name: tool.name, path: `/tools/${tool.slug}` },
              ]),
              {
                "@context": "https://schema.org",
                "@type": "WebApplication",
                "@id": siteUrl(`/tools/${tool.slug}#app`),
                name: tool.name,
                url: siteUrl(`/tools/${tool.slug}`),
                applicationCategory: "PhotographyApplication",
                operatingSystem: "Web browser",
                description: tool.meta,
                featureList: tool.presets.map((preset) => preset.name),
                publisher: {
                  "@type": "Organization",
                  name: "EditingApp",
                  url: siteUrl(),
                },
              },
            ]),
          }}
        />
        <nav className="breadcrumbs" aria-label="Breadcrumb">
          <Link href="/">All tools</Link>
          <span>/</span>
          <span aria-current="page">{tool.name}</span>
        </nav>
        <section className="tool-intro">
          <p className="eyebrow">{tool.name.toUpperCase()}</p>
          <h1>{tool.headline}</h1>
          <p>{tool.description}</p>
        </section>
        <Studio featureId={tool.id} />
        <section className="tool-how" id="how-it-works">
          <div className="section-title">
            <p className="eyebrow">FROM YOUR PHOTO TO YOUR NEXT FAVORITE</p>
            <h2>
              {figurine
                ? "A small version of a big personality."
                : "Your throwback, in a few steps."}
            </h2>
          </div>
          <div className="steps">
            <article>
              <span className="step-num">01 / CHOOSE & UPLOAD</span>
              <h3>Start with a clear photo.</h3>
              <p>
                {figurine
                  ? "Choose a desk collectible or boxed edition. Use one person with a clear face; a waist-up or full-body photo gives the model more clothing information."
                  : "Choose studio, cinema or vintage album styling. Upload one clear, evenly lit selfie without strong filters."}
              </p>
            </article>
            <article>
              <span className="step-num">02 / GENERATE & REVIEW</span>
              <h3>Keep what makes it you.</h3>
              <p>
                Check the displayed credits before submitting. Compare facial
                details, clothing and edges with your original once processing
                finishes.
              </p>
            </article>
            <article>
              <span className="step-num">03 / DOWNLOAD</span>
              <h3>Your image, your choice.</h3>
              <p>
                Save a 1024 × 1536 PNG or a labeled before-and-after. Your
                images stay out of public galleries unless you choose to share
                them yourself.
              </p>
            </article>
          </div>
        </section>
        <section className="styles-section" id="styles">
          <div className="section-title">
            <p className="eyebrow">EXPLORE THE LOOKS</p>
            <h2>
              {figurine
                ? "Your collectible. Your edition."
                : "Find your retro personality."}
            </h2>
          </div>
          <div className={`style-gallery ${figurine ? "two-styles" : ""}`}>
            {tool.presets.map((preset) => (
              <article key={preset.id}>
                <div className="gallery-image">
                  <Image
                    src={preset.image}
                    alt={`AI-created ${preset.name} demonstration featuring a fictional adult`}
                    fill
                    sizes="(max-width: 700px) 90vw, 40vw"
                  />
                </div>
                <div className="gallery-caption">
                  <h3>{preset.name}</h3>
                  <a href="#studio">Try this tool</a>
                </div>
                <p>{preset.description}</p>
              </article>
            ))}
          </div>
          <p className="gallery-disclosure">
            AI-created fictional demonstrations. These illustrate intended
            styles and are not outputs from tested user generations.
          </p>
        </section>
        <section className="tool-details">
          <h2>
            {figurine
              ? "What an AI figurine generator actually makes"
              : "An AI portrait, beyond a vintage filter"}
          </h2>
          <p>
            {figurine
              ? "This tool produces a flat image of an imagined collectible figure. It does not manufacture a physical toy, create an STL file or generate a rotatable 3D model. The desk style uses a clear display base; the boxed style adds a simple unbranded presentation box. Clothing and facial details come from your reference where visible, and unseen details may be invented."
              : "A vintage filter mostly changes color and texture. The retro portrait studio can restyle clothes, hair, background and light while asking the model to preserve your recognizable identity. Each preset supplies a coherent photographic direction, so you do not need to write a prompt."}
          </p>
          <p>
            Facial likeness is not guaranteed. Review the eyes, mouth, skin tone
            and distinctive features rather than judging only the overall style.
            Choose a photograph you have permission to edit and label shared
            results as AI-created.
          </p>
          <h2>Photo preparation and private handling</h2>
          <p>
            Use a still JPG, PNG or WebP under 4 MB, at least 256 × 256 pixels
            and no more than 16 megapixels. Export HEIC images as JPG first.
            Your preview stays in the browser until you generate; submitted
            photos are processed through fal and stored privately in Supabase.
            Access expires after 24 hours. Automatic deletion requires scheduled
            cleanup; manual deletion is available after processing.{" "}
            <Link href="/privacy">Read the photo privacy notice</Link>.
          </p>
          <h2>Credits and interrupted requests</h2>
          <p>
            The studio shows the allowance or credits available to your account
            before generation. Standard images use 3 credits and high detail
            uses 8 under credit plans. A confirmed failure restores credits with
            their original expiry. An uncertain request keeps its reservation.
            Use Check request after an interruption instead of submitting
            another billable generation.{" "}
            <Link href="/pricing">Compare credit plans</Link>.
          </p>
          {figurine ? (
            <>
              <h2>Why a collectible portrait?</h2>
              <p>
                Figurines and action figures are part of the ongoing
                personal-photo transformation trend, mentioned alongside retro
                portraits in{" "}
                <a href="https://www.moneycontrol.com/news/trends/from-ghibli-to-the-80s-instagram-trends-why-are-we-obsessed-with-turning-ourselves-into-ai-generated-versions-14026300.html">
                  Moneycontrol’s September 9, 2026 coverage
                </a>
                . The appeal is a familiar face in an unexpected setting. This
                is a creative direction, not a promise of Google rankings,
                popularity or an exact replica.
              </p>
              <p>
                For a clearer miniature, use a reference where both eyes are
                visible. Avoid a distant group shot or a face partly hidden
                behind a hand. Check the figure’s hands, base, clothing seams
                and box edges before saving. A good result should read as a
                crafted object while keeping recognizable cues from your photo.
              </p>
            </>
          ) : (
            <GuideCards />
          )}
        </section>
      </main>
      <Footer />
    </>
  );
}
