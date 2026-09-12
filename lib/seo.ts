import type { Metadata } from "next";
import { siteUrl } from "@/lib/site";

export function pageMetadata(
  title: string,
  description: string,
  path: string,
): Metadata {
  const socialTitle = `${title} | EditingApp`;
  return {
    title,
    description,
    alternates: { canonical: siteUrl(path) },
    openGraph: {
      title: socialTitle,
      description,
      url: siteUrl(path),
      siteName: "EditingApp",
      locale: "en_US",
      type: "website",
      images: [
        {
          url: siteUrl("/opengraph-image"),
          width: 1200,
          height: 630,
          alt: "EditingApp AI retro portrait generator",
        },
      ],
    },
    twitter: {
      card: "summary_large_image",
      title: socialTitle,
      description,
      images: [siteUrl("/opengraph-image")],
    },
  };
}

export function jsonLd(value: unknown) {
  return JSON.stringify(value).replace(/</g, "\\u003c");
}

export function breadcrumbs(items: { name: string; path: string }[]) {
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: items.map((item, index) => ({
      "@type": "ListItem",
      position: index + 1,
      name: item.name,
      item: siteUrl(item.path),
    })),
  };
}
