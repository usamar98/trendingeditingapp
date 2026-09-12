import Image from "next/image";
import {
  ArrowDown,
  ArrowUpRight,
  Camera,
  ScanFace,
  Download,
  Plus,
} from "lucide-react";
import { Header, Footer } from "@/components/chrome";
import Studio from "@/components/studio";
import { PRESETS } from "@/lib/presets";
import { appUrl } from "@/lib/server/config";
const faqs = [
  [
    "What is an AI retro portrait?",
    "It’s a new image made from your reference selfie, with styling inspired by a past decade. EditingApp changes the clothing, hair, light and photographic texture to create a 1980s look. It is an AI interpretation, not a restored historical photograph.",
  ],
  [
    "Will the portrait still look like me?",
    "The editing instructions prioritize your facial proportions, skin tone, age and distinctive features. Likeness is not guaranteed: AI can change small details or expressions. Compare the result with your original and review your eyes, nose, mouth and hairline before downloading.",
  ],
  [
    "Which selfie should I upload?",
    "Use one clear face, evenly lit and looking toward the camera. Avoid sunglasses, heavy filters and distant group shots. Upload a still JPG, PNG or WebP under 4 MB, at least 256 × 256 pixels, and no larger than 16 megapixels. HEIC photos need to be exported as JPG first.",
  ],
  [
    "How much does a portrait cost?",
    "The initial release offers 3 generations per verified email each day, resetting at 00:00 UTC. Each request uses one generation, including high detail. No payment is collected. A confirmed failed generation restores your allowance; an uncertain request keeps it reserved until its outcome is known. A shared site limit may also temporarily pause generation.",
  ],
  [
    "What happens to my photo?",
    "Before you generate, your selfie is only previewed in your browser. When you submit, EditingApp sends it through fal to an OpenAI image model and stores a metadata-stripped copy and the result in private Supabase storage. Access expires after 24 hours; scheduled cleanup removes the files. You can delete them sooner after processing. Separate provider retention policies apply; see Photo privacy.",
  ],
  [
    "Can I download a before-and-after image?",
    "Yes. Review your original and AI portrait side by side or use the comparison slider. Download the portrait as a 1024 × 1536 PNG or save a labeled before-and-after image. The comparison is composed in your browser and is not published to a public gallery.",
  ],
  [
    "How long does generation take?",
    "Allow a few minutes; processing time depends on provider demand and detail level. EditingApp shows the state of your actual request rather than a made-up progress percentage. If the connection is interrupted, use Check request. It checks for the same portrait without generating another one.",
  ],
];
export default function Home() {
  const structured = {
    "@context": "https://schema.org",
    "@type": "WebApplication",
    name: "EditingApp AI Retro Portrait Generator",
    url: appUrl(),
    applicationCategory: "PhotographyApplication",
    operatingSystem: "Web browser",
    description:
      "Create an AI retro portrait from a reference selfie, compare it with the original, and download the result.",
    featureList: [
      "80s Studio",
      "Retro Cinema",
      "Vintage Family Album",
      "Original and result comparison",
      "Portrait and before-and-after downloads",
    ],
  };
  return (
    <>
      <Header />
      <main id="main">
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify(structured).replace(/</g, "\\u003c"),
          }}
        />
        <section className="intro">
          <div className="intro-copy">
            <p className="eyebrow">
              <span /> A LITTLE NOSTALGIA. A LOT OF YOU.
            </p>
            <h1>
              Your face.
              <br />
              <span>A different decade.</span>
            </h1>
            <p className="intro-description">
              Meet your 1980s alter ego. Turn a selfie into a retro portrait
              with the hair, the light, and all the feeling.
            </p>
          </div>
          <div className="intro-aside">
            <div className="year-mark">
              19<span>80</span>
              <span className="year-star">✳</span>
            </div>
            <p>
              THE AI RETRO
              <br />
              PORTRAIT GENERATOR
            </p>
            <a href="#studio" aria-label="Go to the portrait studio">
              <ArrowDown size={20} />
            </a>
          </div>
        </section>
        <Studio />
        <section className="how-section" id="how-it-works">
          <div className="section-title">
            <p className="eyebrow">NO PROMPT WRITING REQUIRED</p>
            <h2>Your throwback, in a few steps.</h2>
          </div>
          <div className="steps">
            <article>
              <span className="step-icon">
                <Camera size={24} />
              </span>
              <span className="step-num">01 / PICK & UPLOAD</span>
              <h3>Find your kind of retro.</h3>
              <p>
                Choose a visual style and add one clear selfie. A well-lit face
                gives the edit a better starting point.
              </p>
            </article>
            <article>
              <span className="step-icon">
                <ScanFace size={24} />
              </span>
              <span className="step-num">02 / GENERATE & REVIEW</span>
              <h3>Meet your other-decade self.</h3>
              <p>
                Check your allowance, generate a portrait, then compare the
                details against your original.
              </p>
            </article>
            <article>
              <span className="step-icon">
                <Download size={24} />
              </span>
              <span className="step-num">03 / KEEP THE MEMORY</span>
              <h3>Ready for the family album.</h3>
              <p>
                Save your favorite portrait or a before-and-after image. You
                decide what leaves your private studio.
              </p>
            </article>
          </div>
        </section>
        <section className="styles-section" id="styles">
          <div className="section-title split">
            <div>
              <p className="eyebrow">THREE WAYS TO TURN BACK TIME</p>
              <h2>Find your retro personality.</h2>
            </div>
            <p>
              Soft studio flash, a cinematic mood,
              <br />
              or a memory from the mantelpiece.
            </p>
          </div>
          <div className="style-gallery">
            {PRESETS.map((p, i) => (
              <article key={p.id}>
                <div className="gallery-image">
                  <Image
                    src={p.image}
                    alt={`AI-created ${p.name} demonstration with ${i === 0 ? "voluminous hair, cream blazer and blue studio background" : i === 1 ? "burgundy clothing and dramatic teal and amber lighting" : "knitwear and warm window light"}`}
                    fill
                    sizes="(max-width: 700px) 90vw, 33vw"
                  />
                  <span>0{i + 1}</span>
                </div>
                <div className="gallery-caption">
                  <div>
                    <p className="eyebrow">{p.eyebrow}</p>
                    <h3>{p.name}</h3>
                  </div>
                  <a
                    href="#studio"
                    aria-label={`Explore ${p.name} in the studio`}
                  >
                    <ArrowUpRight size={23} />
                  </a>
                </div>
                <p>{p.description}</p>
              </article>
            ))}
          </div>
          <p className="gallery-disclosure">
            AI-created demonstrations featuring a fictional model. These
            illustrate the styles and are not outputs from a tested user
            generation.
          </p>
        </section>
        <section className="editorial">
          <span className="editorial-star">✳</span>
          <div>
            <p className="eyebrow">MORE THAN A VINTAGE FILTER</p>
            <h2>It’s the details that make a decade.</h2>
            <p>
              A retro filter changes a photo’s color. An AI retro portrait can
              also reimagine the clothes, hairstyle, backdrop and lighting. Our
              presets pair those details with instructions to preserve your
              recognizable facial features.
            </p>
            <p>
              For a believable 80s photo, start with a simple selfie and let the
              styling do the work. Review the face carefully and label shared
              results as AI-created. A convincing throwback should still feel
              like you.
            </p>
            <a className="text-link" href="#studio">
              Create your own retro portrait <ArrowUpRight size={17} />
            </a>
          </div>
        </section>
        <section className="faq-section" id="faq">
          <div>
            <p className="eyebrow">BEFORE YOUR TIME TRAVEL</p>
            <h2>
              A few things
              <br />
              you might wonder.
            </h2>
          </div>
          <div className="faq-list">
            {faqs.map(([question, answer]) => (
              <details key={question}>
                <summary>
                  {question}
                  <Plus size={18} />
                </summary>
                <p>
                  {answer}
                  {question === "What happens to my photo?" && (
                    <>
                      {" "}
                      Read the <a href="/privacy">full photo privacy notice</a>.
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
