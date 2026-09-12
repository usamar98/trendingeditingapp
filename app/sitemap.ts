import type { MetadataRoute } from "next";
import { PUBLIC_PAGES, siteUrl } from "@/lib/site";
export default function sitemap(): MetadataRoute.Sitemap {
  return PUBLIC_PAGES.map(({ path, updated }) => ({
    url: siteUrl(path),
    lastModified: updated,
  }));
}
