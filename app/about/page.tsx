import Link from "next/link";
import { Header, Footer } from "@/components/chrome";
import { breadcrumbs, jsonLd, pageMetadata } from "@/lib/seo";

export const metadata = pageMetadata(
  "About EditingApp & Our AI Photo Tools",
  "Learn about EditingApp’s retro portrait and figurine tools, fictional style demonstrations, credit plans, and private photo review and downloads.",
  "/about",
);

export default function AboutPage() {
  return (
    <>
      <Header />
      <main id="main" className="legal about-page">
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: jsonLd(
              breadcrumbs([
                { name: "Home", path: "/" },
                { name: "About EditingApp", path: "/about" },
              ]),
            ),
          }}
        />
        <nav className="breadcrumbs" aria-label="Breadcrumb">
          <Link href="/">Home</Link>
          <span aria-hidden="true">/</span>
          <span aria-current="page">About</span>
        </nav>
        <p className="eyebrow">A NEW PORTRAIT. AN OLD-SCHOOL FEELING.</p>
        <h1>About EditingApp</h1>
        <p>
          EditingApp turns a reference photo into an imaginative retro portrait
          or collectible figurine image. Each tool is built around one short
          workflow: choose a look, upload a photo, generate, compare and
          download. You do not need to learn image-model controls or write a
          long prompt to try the available styles.
        </p>
        <h2>Three looks, one recognizable person</h2>
        <p>
          80s Studio pairs soft flash with tailored clothing and a classic
          backdrop. Retro Cinema uses more dramatic light and richer colors.
          Vintage Family Album creates an informal single-person keepsake with
          warm light and gently faded tones. These are visual directions rather
          than claims of historical accuracy for every detail.
        </p>
        <p>
          The editing instructions prioritize recognizable facial features, age,
          skin tone and expression. AI can still change them. That is why
          comparing the result with the original is part of the product, and why
          downloading comes after you have had a chance to review the face.
        </p>
        <h2>What the examples show</h2>
        <p>
          The AI Figurine Generator imagines you as a miniature desk collectible
          or a boxed edition. It creates a still image with sculpted materials
          and presentation styling. It does not make a physical toy or a
          3D-printable file.
        </p>
        <p>
          The example portraits on this site are AI-created demonstrations
          featuring fictional people. They illustrate clothing, lighting and
          color choices; they are not real customers, testimonials or evidence
          from a tested user generation. Your output will depend on the
          reference photo and the image model’s interpretation.
        </p>
        <p>
          The <Link href="/guides">photo guides</Link> explain how the styles
          work, how to prepare a clearer selfie and what to inspect in a
          finished portrait. Dated trend observations are linked to their
          sources. We do not treat social posts as proof of search volume or
          claim that using the app guarantees popular posts.
        </p>
        <h2>Your preview, your decision to share</h2>
        <p>
          Choosing a file first creates a local browser preview. Generating
          sends it for processing through fal to an OpenAI image model and uses
          private Supabase storage. You verify your email to generate and
          retrieve your photos. A standard image uses 3 credits and high detail
          uses 8 under credit plans. The studio shows your current credits or
          allowance before submission.{" "}
          <Link href="/pricing">Compare monthly and yearly plans</Link>.
        </p>
        <p>
          You can save a portrait PNG or a labeled before-and-after image.
          Downloads do not publish to a gallery or post to a social account.
          Photo access expires after 24 hours; automatic deletion requires
          scheduled cleanup. Read the{" "}
          <Link href="/privacy">photo privacy notice</Link> for provider
          processing, retention and deletion details.
        </p>
        <h2>What this release is designed for</h2>
        <p>
          EditingApp makes imaginative still portraits of one person. It does
          not restore historical photographs, combine family members, create
          videos or verify a person’s identity. Use photos you have permission
          to edit, review results before keeping them and label shared portraits
          as AI-created. The <Link href="/terms">terms of use</Link> explain
          allowances and responsible use.
        </p>
        <Link href="/#tools" className="primary">
          Explore the photo tools
        </Link>
      </main>
      <Footer />
    </>
  );
}
