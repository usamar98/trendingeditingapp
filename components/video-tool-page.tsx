import Link from "next/link";
import { ArrowUpRight, Clapperboard, Plus } from "lucide-react";
import { Header, Footer } from "./chrome";
import VideoStudio from "./video-studio";
import { breadcrumbs, jsonLd } from "@/lib/seo";
import { siteUrl } from "@/lib/site";
import { VIDEO_PRESETS } from "@/lib/video";

const FAQS = [
  [
    "How do I turn a photo into an AI video?",
    "Choose a movement, upload a clear JPG, PNG or WebP, and review the displayed credit cost. After you generate, the model animates your image into a short silent MP4. You can play the video, compare it with the original photo and download it. This creates motion within a photo; it does not create a slideshow.",
  ],
  [
    "How much does a video cost?",
    "Cinematic Portrait, Photo Comes Alive and Golden Breeze each use 60 credits for one five-second video. Copy a Motion uses 90 credits for a clip following your 3–5 second reference. These prices cover video generation only. Creating a new retro portrait first uses separate image credits. Downloading and replaying your result use no additional credits.",
  ],
  [
    "Will the face stay recognizable?",
    "The presets ask for consistent facial identity, age and skin tone, with restrained movement. AI can still alter facial details, hands or clothing. A clear face, simple background and a small movement are useful starting points. Review the complete clip before saving. Large head turns, hidden faces and crowded photos are more difficult.",
  ],
  [
    "Can I animate a retro portrait I made here?",
    "Yes. Open a completed portrait and choose Animate this photo. Its private result becomes the starting frame in the video studio. The portrait must still be within its 24-hour access window. You can also upload a portrait you previously downloaded.",
  ],
  [
    "How does Copy a Motion work?",
    "Upload a photo of one person and your own 3–5 second H.264 MP4 showing a dance or gesture. The reference clip must be under 3 MB; the combined files must be under 4 MB. Match the body framing in both files, keep the head and body visible, and avoid obstructions. The video follows that movement; its original sound is not included.",
  ],
  [
    "Can I close the page while my video generates?",
    "Yes. Once the request is saved, processing continues in the provider queue. Sign back into the same account and open Your recent videos. Check video status reconnects to the existing request without submitting another generation. The studio does not display a made-up completion percentage or guaranteed waiting time.",
  ],
  [
    "What happens if a video fails?",
    "A confirmed generation failure restores the reserved credits with their original expiry. If a connection is interrupted and the outcome is uncertain, the reservation remains until the request is resolved. Check the existing request before trying anything else. A completed video uses credits even if you choose not to keep it.",
  ],
  [
    "Are my videos public, and how long can I download them?",
    "EditingApp does not publish your files to a gallery. Your account has access for 24 hours from submission. Private download links are short-lived and can be refreshed in the studio. You can delete completed files yourself. Automatic deletion uses scheduled cleanup, with additional cleanup when you revisit expired requests. Provider retention is described in the privacy notice.",
  ],
] as const;
export function VideoToolPage() {
  return (
    <>
      <Header />
      <main id="main" className="video-page">
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: jsonLd([
              breadcrumbs([
                { name: "Home", path: "/" },
                { name: "AI Photo to Video", path: "/tools/ai-photo-to-video" },
              ]),
              {
                "@context": "https://schema.org",
                "@type": "WebApplication",
                "@id": siteUrl("/tools/ai-photo-to-video#app"),
                name: "EditingApp AI Photo to Video",
                url: siteUrl("/tools/ai-photo-to-video"),
                applicationCategory: "MultimediaApplication",
                operatingSystem: "Web browser",
                description:
                  "Animate a photo into a short AI video. Choose cinematic movement or transfer motion from your own reference clip, review privately and download MP4.",
                featureList: VIDEO_PRESETS.map((p) => p.name),
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
          <span aria-current="page">AI Photo to Video</span>
        </nav>
        <section className="video-intro">
          <div>
            <p className="eyebrow">
              <Clapperboard size={16} /> AI PHOTO TO VIDEO
            </p>
            <h1>
              Your photo.
              <br />
              <em>Its next scene.</em>
            </h1>
            <p>
              That look. That little smile. Turn a still photo into a short
              video with a movement that feels like you.
            </p>
          </div>
          <div className="video-intro-note">
            <span>01 PHOTO. A NEW POSSIBILITY.</span>
            <p>
              Choose a movement.
              <br />
              Make your moment move.
            </p>
            <a href="#video-studio">
              Step into the studio <ArrowUpRight size={17} />
            </a>
          </div>
        </section>
        <VideoStudio />
        <section className="video-how">
          <div className="section-title">
            <p className="eyebrow">FROM STILL TO SOMETHING MORE</p>
            <h2>A little direction goes a long way.</h2>
          </div>
          <div className="steps">
            <article>
              <span className="step-num">01 / SET THE SCENE</span>
              <h3>Start with a good photo.</h3>
              <p>
                Pick a sharp photo with even lighting and one clearly visible
                person. Your image sets the composition, clothing and
                atmosphere. For video, use at least 300 pixels on each side and
                avoid extreme panoramic crops.
              </p>
            </article>
            <article>
              <span className="step-num">02 / KEEP IT SIMPLE</span>
              <h3>Give it one movement.</h3>
              <p>
                A gentle push-in, a quiet smile or a soft breeze keeps attention
                on your face. For a dance or gesture, Copy a Motion takes your
                own reference clip. Each option shows its credit cost before you
                generate.
              </p>
            </article>
            <article>
              <span className="step-num">03 / WATCH IT BACK</span>
              <h3>Make sure it feels right.</h3>
              <p>
                Play the whole clip. Check facial details and movement against
                your original. Download the silent MP4, then add music or
                captions in your preferred editor. Label shared results as
                AI-generated.
              </p>
            </article>
          </div>
        </section>
        <section className="video-tips">
          <div>
            <p className="eyebrow">A FRAME WORTH KEEPING</p>
            <h2>Your original does the storytelling.</h2>
          </div>
          <div>
            <p>
              Photo-to-video animation starts with the scene already in your
              image. It works best when your request builds on that scene. A
              close-up portrait suits a blink or gentle smile; a photo that
              shows the body gives a movement reference more room to work.
            </p>
            <p>
              Strong filters, motion blur and hidden hands can carry through
              into the video. Choose a different source when you want a
              substantially different setting. If you want an 80s look first,
              create a{" "}
              <Link href="/tools/ai-retro-portraits">retro portrait</Link>,
              review it and use its Animate this photo action.
            </p>
            <p>
              These are creative interpretations, not a reconstruction of what
              someone actually did. Review your result and respect the
              permissions of everyone pictured.
            </p>
          </div>
        </section>
        <section className="faq-section video-faq">
          <div>
            <p className="eyebrow">BEFORE YOUR FIRST TAKE</p>
            <h2>
              A few things
              <br />
              you might wonder.
            </h2>
            <Link href="/pricing">
              Compare credit plans <ArrowUpRight size={16} />
            </Link>
          </div>
          <div className="faq-list">
            {FAQS.map(([q, a]) => (
              <details key={q}>
                <summary>
                  {q}
                  <Plus size={18} />
                </summary>
                <p>{a}</p>
              </details>
            ))}
          </div>
        </section>
      </main>
      <Footer />
    </>
  );
}
