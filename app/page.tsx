import Link from "next/link";
import Image from "next/image";
import {
  ArrowUpRight,
  ArrowRight,
  Sparkles,
  ScanFace,
  Download,
  Plus,
} from "lucide-react";
import { Header, Footer } from "@/components/chrome";
import { GuideCards } from "@/components/guide-cards";
import { PricingCards } from "@/components/pricing-cards";
import { TOOL_CATALOG } from "@/lib/tools";
import { siteUrl } from "@/lib/site";
import { jsonLd, pageMetadata } from "@/lib/seo";
import { billingConfigured } from "@/lib/server/stripe";
export const metadata = pageMetadata(
  "AI Photo Tools — Retro Portraits & Figurine Generator",
  "Create a new version of your photo with EditingApp. Explore 80s AI retro portraits and collectible figurine images, review results and download your favorites.",
  "/",
);
const FAQS = [
  [
    "What can I create with EditingApp?",
    "Turn a reference photo into an AI retro portrait or an image of a collectible figurine. Each tool has its own styles and upload workspace. The figurine tool creates an image, not a physical toy or a 3D-printable file.",
  ],
  [
    "Will the result still look like me?",
    "The instructions prioritize recognizable facial features, age and skin tone. AI can still change details. Compare the original and result carefully before downloading; likeness is not guaranteed.",
  ],
  [
    "How do credits work?",
    "A standard image uses 3 credits and high detail uses 8. Paid monthly plans add credits after each successful renewal; yearly plans issue twelve months of credits after the yearly payment. Credits expire at the end of their paid period. Your studio shows the current credits or allowance before submission.",
  ],
  [
    "Which photo should I upload?",
    "Use one clearly visible face in a still JPG, PNG or WebP under 4 MB. Each side must be at least 256 pixels and the image must be no larger than 16 megapixels. For a figurine, a waist-up or full-body photo gives more clothing information. Convert HEIC to JPG first.",
  ],
  [
    "What happens if generation fails?",
    "A confirmed failure restores the reserved credits to their original expiry. If the outcome is uncertain, credits stay reserved while you check the same request. Use Check request after a connection interruption; submitting again would start a different generation.",
  ],
  [
    "Are my photos public?",
    "No public gallery is created. Your selfie is previewed locally until you generate. Submitted photos are processed through fal and stored privately. Access expires after 24 hours; automatic deletion requires scheduled cleanup. You can delete photos manually after processing. Separate provider retention policies apply.",
  ],
  [
    "Can I download a before-and-after image?",
    "Yes. Review your original and result side by side or with the comparison slider, then save the portrait PNG or a labeled comparison. Downloads do not automatically post to Instagram, TikTok or another social account.",
  ],
];
export default function Home() {
  const structured = [
    {
      "@context": "https://schema.org",
      "@type": "Organization",
      "@id": siteUrl("/#organization"),
      name: "EditingApp",
      url: siteUrl(),
      description:
        "AI photo tools for retro portraits and collectible figurine images.",
    },
    {
      "@context": "https://schema.org",
      "@type": "WebSite",
      "@id": siteUrl("/#website"),
      name: "EditingApp",
      url: siteUrl(),
      publisher: { "@id": siteUrl("/#organization") },
      inLanguage: "en",
    },
    {
      "@context": "https://schema.org",
      "@type": "ItemList",
      name: "EditingApp AI photo tools",
      itemListElement: TOOL_CATALOG.map((tool, index) => ({
        "@type": "ListItem",
        position: index + 1,
        name: tool.name,
        url: siteUrl(`/tools/${tool.slug}`),
      })),
    },
  ];
  return (
    <>
      <Header />
      <main id="main">
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: jsonLd(structured) }}
        />
        <section className="hub-hero">
          <div className="hub-hero-copy">
            <p className="eyebrow">
              <Sparkles size={15} /> A LITTLE IMAGINATION. A LOT OF YOU.
            </p>
            <h1>
              AI photo tools.
              <br />
              <span>Your next alter ego.</span>
            </h1>
            <p>
              A throwback portrait. A miniature you. Find a new way to see
              yourself—with simple tools made for your next creative idea.
            </p>
            <a href="#tools" className="primary">
              Find your next look <ArrowRight size={18} />
            </a>
            <div className="hero-details">
              <span>Photo in. Possibility out.</span>
              <span>Review before you download.</span>
            </div>
          </div>
          <figure className="hero-collectible">
            <Image
              src="/images/figurine-desk.png"
              alt="AI-created demonstration of a fictional woman as a miniature desk collectible"
              width={1024}
              height={1536}
              sizes="(max-width: 700px) 75vw, 380px"
              priority
            />
            <figcaption>
              <span>THE MINI-ME EDITION</span>
              <strong>A new kind of self-portrait.</strong>
              <small>Fictional AI-created demonstration</small>
            </figcaption>
          </figure>
        </section>
        <section id="tools" className="tools-section">
          <span id="studio" />
          <div className="section-title split">
            <div>
              <p className="eyebrow">YOUR CREATIVE TOOLBOX</p>
              <h2>Pick a possibility.</h2>
            </div>
            <p>
              One photo. A style that speaks to you.
              <br />
              Each tool has its own little studio.
            </p>
          </div>
          <div className="tool-grid">
            {TOOL_CATALOG.map((tool) => (
              <article
                className={`tool-card ${tool.id === "ai-figurine" ? "figurine-card" : ""}`}
                key={tool.id}
              >
                <Link
                  className="tool-card-image"
                  href={`/tools/${tool.slug}`}
                  aria-label={`Explore ${tool.name}`}
                >
                  <Image
                    src={tool.image}
                    alt={tool.alt}
                    fill
                    sizes="(max-width: 700px) 90vw, 45vw"
                  />
                  <span>{tool.badge}</span>
                </Link>
                <div className="tool-card-content">
                  <p className="eyebrow">{tool.category}</p>
                  <h3>
                    <Link href={`/tools/${tool.slug}`}>{tool.name}</Link>
                  </h3>
                  <p>{tool.description}</p>
                  <div className="tool-card-bottom">
                    <span>3 credits / standard image</span>
                    <Link href={`/tools/${tool.slug}`}>
                      Open studio <ArrowUpRight size={17} />
                    </Link>
                  </div>
                </div>
              </article>
            ))}
          </div>
          <p className="gallery-disclosure">
            All examples are AI-created demonstrations with fictional people,
            not tested customer results. Availability and your current allowance
            are shown inside each studio.
          </p>
        </section>
        <section className="how-section" id="how-it-works">
          <div className="section-title">
            <p className="eyebrow">SMALL STEPS. A NEW PERSPECTIVE.</p>
            <h2>Make it yours in a few steps.</h2>
          </div>
          <div className="steps">
            <article>
              <span className="step-icon">
                <Sparkles size={24} />
              </span>
              <span className="step-num">01 / FIND YOUR LOOK</span>
              <h3>Choose a tool and style.</h3>
              <p>
                Explore a new visual direction, then open its studio. Every tool
                shows its options and credit cost before you submit.
              </p>
            </article>
            <article>
              <span className="step-icon">
                <ScanFace size={24} />
              </span>
              <span className="step-num">02 / UPLOAD & REVIEW</span>
              <h3>Keep the details that matter.</h3>
              <p>
                Start with a clear photo. Generate once and compare the result
                with your reference, giving your face a careful look.
              </p>
            </article>
            <article>
              <span className="step-icon">
                <Download size={24} />
              </span>
              <span className="step-num">03 / SAVE YOUR FAVORITE</span>
              <h3>A keeper, on your terms.</h3>
              <p>
                Download your image or a labeled before-and-after. You decide
                what to share and what stays in your private studio.
              </p>
            </article>
          </div>
        </section>
        <section className="home-pricing" id="plans">
          <div className="section-title">
            <p className="eyebrow">KEEP YOUR IDEAS COMING</p>
            <h2>A little room. Or a whole studio.</h2>
            <p>
              One credit balance across the available tools. Choose monthly or
              save with a yearly plan.
            </p>
          </div>
          <PricingCards ready={billingConfigured()} />
        </section>
        <section className="home-guides" aria-labelledby="guides-heading">
          <div className="section-title">
            <p className="eyebrow">THE EDITINGAPP NOTEBOOK</p>
            <h2 id="guides-heading">Good starting points. Better keepsakes.</h2>
          </div>
          <GuideCards />
        </section>
        <section className="faq-section" id="faq">
          <div>
            <p className="eyebrow">BEFORE YOUR NEXT IDEA</p>
            <h2>
              A few things
              <br />
              you might wonder.
            </h2>
          </div>
          <div className="faq-list">
            {FAQS.map(([question, answer]) => (
              <details key={question}>
                <summary>
                  {question}
                  <Plus size={18} />
                </summary>
                <p>
                  {answer}
                  {question === "Are my photos public?" && (
                    <>
                      {" "}
                      <Link href="/privacy">Read the photo privacy notice</Link>
                      .
                    </>
                  )}
                </p>
              </details>
            ))}
          </div>
        </section>
      </main>
      <Footer />
    </>
  );
}
