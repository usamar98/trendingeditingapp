import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { Header, Footer } from "@/components/chrome";
import { GuideCards } from "@/components/guide-cards";
import { GUIDES, findGuide } from "@/lib/guides";
import { breadcrumbs, jsonLd, pageMetadata } from "@/lib/seo";
import { siteUrl } from "@/lib/site";

export const dynamicParams = false;
export function generateStaticParams() {
  return GUIDES.map(({ slug }) => ({ slug }));
}
type Props = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const guide = findGuide((await params).slug);
  if (!guide) notFound();
  const metadata = pageMetadata(
    guide.seoTitle,
    guide.description,
    `/guides/${guide.slug}`,
  );
  return {
    ...metadata,
    openGraph: {
      ...metadata.openGraph,
      type: "article",
      publishedTime: guide.published,
      modifiedTime: guide.published,
      authors: [siteUrl("/about")],
    },
  };
}

export default async function GuidePage({ params }: Props) {
  const guide = findGuide((await params).slug);
  if (!guide) notFound();
  const url = siteUrl(`/guides/${guide.slug}`);
  const structured = [
    {
      "@context": "https://schema.org",
      "@type": "Article",
      "@id": `${url}#article`,
      headline: guide.title,
      description: guide.description,
      image: [siteUrl(guide.image)],
      datePublished: guide.published,
      dateModified: guide.published,
      mainEntityOfPage: url,
      author: {
        "@type": "Organization",
        name: "EditingApp",
        url: siteUrl("/about"),
      },
      publisher: {
        "@type": "Organization",
        "@id": siteUrl("/#organization"),
        name: "EditingApp",
        url: siteUrl(),
      },
      inLanguage: "en",
    },
    breadcrumbs([
      { name: "Home", path: "/" },
      { name: "Photo guides", path: "/guides" },
      { name: guide.title, path: `/guides/${guide.slug}` },
    ]),
  ];
  return (
    <>
      <Header />
      <main id="main" className="guide-page">
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: jsonLd(structured) }}
        />
        <nav className="breadcrumbs" aria-label="Breadcrumb">
          <Link href="/">Home</Link>
          <span aria-hidden="true">/</span>
          <Link href="/guides">Photo guides</Link>
          <span aria-hidden="true">/</span>
          <span aria-current="page">
            {guide.slug === "1980s-ai-photo-prompts"
              ? "80s photo prompts"
              : "Selfie & likeness tips"}
          </span>
        </nav>
        <article>
          <header className="guide-hero">
            <div>
              <p className="eyebrow">THE EDITINGAPP NOTEBOOK</p>
              <h1>{guide.title}</h1>
              <p className="guide-intro">{guide.intro}</p>
              <p className="guide-byline">
                By <Link href="/about">EditingApp</Link> · Published{" "}
                <time dateTime={guide.published}>September 12, 2026</time>
              </p>
            </div>
            <figure>
              <Image
                src={guide.image}
                alt={guide.imageAlt}
                width={1024}
                height={1536}
                sizes="(max-width: 700px) 75vw, 290px"
                priority
              />
              <figcaption>
                AI-created demonstration with a fictional subject. Illustrates
                styling; not a tested user result.
              </figcaption>
            </figure>
          </header>
          <div className="guide-layout">
            <nav className="guide-toc" aria-label="On this page">
              <p className="eyebrow">IN THIS GUIDE</p>
              <ol>
                {guide.sections.map((section) => (
                  <li key={section.id}>
                    <a href={`#${section.id}`}>{section.title}</a>
                  </li>
                ))}
              </ol>
            </nav>
            <div className="guide-body">
              {guide.sections.map((section) => (
                <section id={section.id} key={section.id}>
                  <h2>{section.title}</h2>
                  {section.content}
                </section>
              ))}
              <section className="guide-cta">
                <h2>Make a portrait you can review.</h2>
                <p>
                  Choose your retro style, preview your selfie and check your
                  allowance before you generate.
                </p>
                <Link href="/#studio" className="primary">
                  Create an AI retro portrait
                </Link>
              </section>
            </div>
          </div>
        </article>
        <aside className="related-guides" aria-label="Related reading">
          <h2>Keep exploring</h2>
          <GuideCards exclude={guide.slug} />
        </aside>
      </main>
      <Footer />
    </>
  );
}
