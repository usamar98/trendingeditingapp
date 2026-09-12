import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

const paths = [
  "/",
  "/guides",
  "/guides/1980s-ai-photo-prompts",
  "/guides/better-ai-portrait-likeness",
  "/about",
  "/privacy",
  "/terms",
];

test("sitemap contains canonical, server-rendered pages with distinct metadata and working links", async ({
  page,
  request,
}) => {
  test.setTimeout(90000);
  const xml = await (await request.get("/sitemap.xml")).text();
  const urls = [...xml.matchAll(/<loc>(.*?)<\/loc>/g)].map((match) => match[1]);
  expect(urls.map((url) => new URL(url).pathname).sort()).toEqual(
    [...paths].sort(),
  );
  const titles = new Set<string>();
  const descriptions = new Set<string>();
  const internalLinks = new Set<string>();
  for (const path of paths) {
    const response = await request.get(path);
    expect(response.status()).toBe(200);
    const html = await response.text();
    // Parse the raw HTTP response: these assertions do not rely on hydration.
    const seo = await page.evaluate((raw) => {
      const doc = new DOMParser().parseFromString(raw, "text/html");
      return {
        title: doc.title,
        description: doc
          .querySelector('meta[name="description"]')
          ?.getAttribute("content"),
        canonical: doc
          .querySelector('link[rel="canonical"]')
          ?.getAttribute("href"),
        ogUrl: doc
          .querySelector('meta[property="og:url"]')
          ?.getAttribute("content"),
        ogTitle: doc
          .querySelector('meta[property="og:title"]')
          ?.getAttribute("content"),
        h1: [...doc.querySelectorAll("h1")].map(
          (heading) => heading.textContent,
        ),
        robots: [...doc.querySelectorAll('meta[name="robots"]')].map((meta) =>
          meta.getAttribute("content"),
        ),
        schema: [
          ...doc.querySelectorAll('script[type="application/ld+json"]'),
        ].flatMap((script) => JSON.parse(script.textContent || "null")),
        links: [...doc.querySelectorAll('a[href^="/"]')].map((anchor) =>
          anchor.getAttribute("href")!,
        ),
      };
    }, html);
    expect(seo.h1).toHaveLength(1);
    expect(new URL(seo.canonical!).href).toBe(`http://localhost:3001${path}`);
    expect(new URL(seo.ogUrl!).href).toBe(new URL(seo.canonical!).href);
    expect(seo.ogTitle).toContain("EditingApp");
    expect(seo.description!.length).toBeGreaterThan(90);
    expect(seo.robots.join()).not.toContain("noindex");
    expect(seo.schema.length).toBeGreaterThanOrEqual(
      path === "/privacy" || path === "/terms" ? 0 : 1,
    );
    if (path.startsWith("/guides/")) {
      expect(seo.schema.some((item) => item["@type"] === "Article")).toBe(true);
      expect(
        seo.schema.some((item) => item["@type"] === "BreadcrumbList"),
      ).toBe(true);
    }
    titles.add(seo.title);
    descriptions.add(seo.description!);
    seo.links.forEach((link) => internalLinks.add(link.split("#")[0] || "/"));
  }
  expect(titles.size).toBe(paths.length);
  expect(descriptions.size).toBe(paths.length);
  for (const link of internalLinks)
    expect((await request.get(link)).status(), link).toBe(200);
  expect(await (await request.get("/robots.txt")).text()).toContain(
    "Sitemap: http://localhost:3001/sitemap.xml",
  );
  expect(
    (await request.get("/api/session")).headers()["x-robots-tag"],
  ).toContain("noindex");
  expect((await request.get("/guides/not-a-real-guide")).status()).toBe(404);
  expect(
    (await request.get("/retired-feature-that-does-not-exist")).status(),
  ).toBe(404);
});

test("guides and about page remain accessible and fit mobile screens", async ({
  page,
}, info) => {
  test.setTimeout(90000);
  for (const path of paths.filter(
    (path) => path.startsWith("/guides") || path === "/about",
  )) {
    await page.goto(path);
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth > window.innerWidth,
      ),
    ).toBe(false);
    const result = await new AxeBuilder({ page })
      .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
      .analyze();
    expect(
      result.violations.map(({ id, nodes }) => ({
        id,
        targets: nodes.map((node) => node.target),
      })),
      path,
    ).toEqual([]);
    if (path.endsWith("1980s-ai-photo-prompts")) {
      await page.screenshot({ path: `test-results/${info.project.name}-guide-top.png` });
      await page.screenshot({
        path: `test-results/${info.project.name}-guide.png`,
        fullPage: true,
      });
    }
  }
});
