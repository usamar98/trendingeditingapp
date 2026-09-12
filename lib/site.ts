/** Public URL utilities. Never include service credentials in this module. */
export function siteOrigin(
  value = process.env.APP_URL || "http://localhost:3000",
) {
  const url = new URL(value.trim());
  if (
    !["http:", "https:"].includes(url.protocol) ||
    url.username ||
    url.password
  ) {
    throw new Error("APP_URL must be an HTTP(S) origin without credentials.");
  }
  if (url.pathname !== "/" || url.search || url.hash) {
    throw new Error(
      "APP_URL must be a website origin without a path, query or fragment.",
    );
  }
  return url.origin;
}

export function siteUrl(path = "/") {
  if (!path.startsWith("/") || path.startsWith("//")) {
    throw new Error("A site URL must use an absolute local path.");
  }
  return new URL(path, siteOrigin()).href;
}

// Change a date only when that page's actual content changes.
export const PUBLIC_PAGES = [
  { path: "/", updated: "2026-09-12" },
  { path: "/guides", updated: "2026-09-12" },
  { path: "/guides/1980s-ai-photo-prompts", updated: "2026-09-12" },
  { path: "/guides/better-ai-portrait-likeness", updated: "2026-09-12" },
  { path: "/about", updated: "2026-09-12" },
  { path: "/privacy", updated: "2026-09-12" },
  { path: "/terms", updated: "2026-09-12" },
] as const;
