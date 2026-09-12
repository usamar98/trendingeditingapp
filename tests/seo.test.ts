import { afterEach, describe, expect, it, vi } from "vitest";
import { PUBLIC_PAGES, siteOrigin, siteUrl } from "@/lib/site";
import { breadcrumbs, jsonLd, pageMetadata } from "@/lib/seo";
import { GUIDES } from "@/lib/guides";
import sitemap from "@/app/sitemap";
import robots from "@/app/robots";
import { appUrl, sameOrigin } from "@/lib/server/config";

afterEach(() => vi.unstubAllEnvs());

describe("public SEO URLs", () => {
  it("normalizes the configured trailing slash for metadata, sitemap, robots and auth", () => {
    vi.stubEnv("APP_URL", "https://www.editingapp.live/");
    expect(appUrl()).toBe("https://www.editingapp.live");
    expect(siteUrl("/privacy")).toBe("https://www.editingapp.live/privacy");
    expect(siteUrl()).toBe("https://www.editingapp.live/");
    expect(robots().sitemap).toBe("https://www.editingapp.live/sitemap.xml");
    expect(() =>
      sameOrigin(
        new Request(siteUrl("/api/portraits"), {
          headers: { origin: "https://www.editingapp.live" },
        }),
      ),
    ).not.toThrow();
    expect(() =>
      sameOrigin(
        new Request(siteUrl("/api/portraits"), {
          headers: { origin: "https://another.example" },
        }),
      ),
    ).toThrow();
  });

  it.each([
    "ftp://example.com",
    "https://user:pass@example.com",
    "https://example.com/path",
    "https://example.com/?query=yes",
    "https://example.com/#hash",
  ])("rejects an unsafe or ambiguous APP_URL: %s", (origin) => {
    expect(() => siteOrigin(origin)).toThrow();
  });

  it("rejects protocol-relative and external canonical paths", () => {
    expect(() => siteUrl("//another.example")).toThrow();
    expect(() => siteUrl("https://another.example/")).toThrow();
  });

  it("lists every guide once and excludes private and retired URLs", () => {
    vi.stubEnv("APP_URL", "https://www.editingapp.live/");
    const entries = sitemap();
    expect(new Set(entries.map((entry) => entry.url)).size).toBe(
      PUBLIC_PAGES.length,
    );
    for (const guide of GUIDES)
      expect(entries).toContainEqual({
        url: siteUrl(`/guides/${guide.slug}`),
        lastModified: guide.published,
      });
    for (const entry of entries) {
      expect(new URL(entry.url).pathname).not.toMatch(/\/\/|^\/api|^\/auth/);
      expect(entry.lastModified).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      expect(entry).not.toHaveProperty("priority");
      expect(entry).not.toHaveProperty("changeFrequency");
    }
  });

  it("gives each page its own canonical and social URL", () => {
    vi.stubEnv("APP_URL", "https://www.editingapp.live/");
    for (const { path } of PUBLIC_PAGES) {
      const metadata = pageMetadata("Title", "Description", path);
      expect(metadata.alternates?.canonical).toBe(siteUrl(path));
      expect(metadata.openGraph?.url).toBe(siteUrl(path));
    }
    expect(
      breadcrumbs([
        { name: "Home", path: "/" },
        { name: "Guides", path: "/guides" },
      ]).itemListElement[1],
    ).toEqual({
      "@type": "ListItem",
      position: 2,
      name: "Guides",
      item: siteUrl("/guides"),
    });
  });

  it("keeps JSON-LD parseable without allowing script termination", () => {
    const input = { name: "</script><script>alert('x')</script>" };
    const encoded = jsonLd(input);
    expect(encoded).not.toContain("<");
    expect(JSON.parse(encoded)).toEqual(input);
  });
});
