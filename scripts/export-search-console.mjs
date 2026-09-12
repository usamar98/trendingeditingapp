import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

// Public read-only export. No Google, Supabase or provider credentials are used.
const origin = "https://www.editingapp.live";
const destination = path.resolve("deliverables/search-console");
async function getPublic(url) {
  const response = await fetch(url, {
    redirect: "error",
    signal: AbortSignal.timeout(30000),
  });
  if (!response.ok) throw new Error(`${url}: HTTP ${response.status}`);
  return response;
}
const sitemap = await (await getPublic(`${origin}/sitemap.xml`)).text();
const robots = await (await getPublic(`${origin}/robots.txt`)).text();
if (
  !sitemap.includes(
    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
  )
)
  throw new Error("Expected the public XML sitemap.");
const urls = [...sitemap.matchAll(/<loc>([^<]+)<\/loc>/g)].map(
  (match) => match[1],
);
if (!urls.length || new Set(urls).size !== urls.length)
  throw new Error("Sitemap is empty or contains duplicate URLs.");
for (const url of urls) {
  const parsed = new URL(url);
  if (
    parsed.origin !== origin ||
    parsed.pathname.includes("//") ||
    /^\/(api|auth)(\/|$)/.test(parsed.pathname) ||
    parsed.search ||
    parsed.hash
  )
    throw new Error(`Unexpected sitemap URL: ${url}`);
  const page = await getPublic(url);
  if ((page.headers.get("x-robots-tag") || "").includes("noindex"))
    throw new Error(`Sitemap contains noindex page: ${url}`);
  const html = await page.text();
  const canonical = html.match(
    /<link\s+rel="canonical"\s+href="([^"]+)"/i,
  )?.[1];
  if (!canonical || new URL(canonical).href !== url)
    throw new Error(`Canonical mismatch: ${url}`);
}
if (!robots.includes(`Sitemap: ${origin}/sitemap.xml`))
  throw new Error("robots.txt must reference the canonical sitemap.");
await mkdir(destination, { recursive: true });
for (const name of ["README.md", "STRUCTURE.md"])
  await writeFile(
    path.join(destination, name),
    await readFile(`docs/search-console/${name}`),
  );
await writeFile(path.join(destination, "sitemap.xml"), sitemap);
await writeFile(path.join(destination, "robots.txt"), robots);
const priority = (url) =>
  url === `${origin}/` ? 0 : url.includes("/guides/") ? 1 : 2;
await writeFile(
  path.join(destination, "urls-to-inspect.txt"),
  [...urls].sort((a, b) => priority(a) - priority(b)).join("\n") + "\n",
);
const reviewPath = path.join(destination, "old-url-review.csv");
try {
  await writeFile(reviewPath, "old_url,new_url_or_none,action,reason\n", {
    flag: "wx",
  });
} catch (error) {
  if (error.code !== "EEXIST") throw error;
} // Preserve the operator's completed worksheet.
await writeFile(
  path.join(destination, "export-manifest.json"),
  JSON.stringify(
    {
      exportedAt: new Date().toISOString(),
      source: origin,
      checkedPages: urls.length,
      sitemap: `${origin}/sitemap.xml`,
      note: "Public HTTP checks only. No Search Console submission or Google indexing verification was performed.",
    },
    null,
    2,
  ) + "\n",
);
console.log(
  `Exported ${urls.length} checked public URLs and Search Console instructions to ${destination}`,
);
