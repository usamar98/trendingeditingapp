import { parseArgs } from "node:util";
import { pathToFileURL } from "node:url";

export function catalogOptions(args) {
  const { values } = parseArgs({
    args,
    options: {
      query: { type: "string" },
      endpoint: { type: "string" },
      category: { type: "string" },
      cursor: { type: "string" },
      limit: { type: "string", default: "10" },
      help: { type: "boolean" },
    },
  });
  if (values.help) return null;
  const limit = Number(values.limit);
  if (!Number.isInteger(limit) || limit < 1 || limit > 50)
    throw new Error("--limit must be 1–50.");
  if (!values.query && !values.endpoint && !values.category)
    throw new Error(
      "Supply --query, --category or --endpoint. Use --help for examples.",
    );
  const url = new URL("https://api.fal.ai/v1/models");
  url.searchParams.set("limit", String(limit));
  url.searchParams.set("status", "active");
  if (values.query) url.searchParams.set("q", values.query);
  if (values.category) url.searchParams.set("category", values.category);
  if (values.cursor) url.searchParams.set("cursor", values.cursor);
  if (values.endpoint) {
    url.searchParams.set("endpoint_id", values.endpoint);
    url.searchParams.set("expand", "openapi-3.0");
  }
  return { url, endpoint: values.endpoint };
}

async function getJson(url, key, fetcher) {
  const response = await fetcher(url, {
    method: "GET",
    headers: { Authorization: `Key ${key}` },
    signal: AbortSignal.timeout(30_000),
    redirect: "error",
    cache: "no-store",
  });
  if (!response.ok) {
    await response.body?.cancel().catch(() => undefined);
    throw new Error(
      `fal catalog returned HTTP ${response.status}. Check key permissions and account access.`,
    );
  }
  return response.json();
}

/** Read-only discovery. No inference endpoints, uploads, or automatic registry edits. */
export async function discover(options, key, fetcher = fetch) {
  if (!key)
    throw new Error(
      "Set FAL_KEY in .env.local or your shell before searching fal. No generation was requested.",
    );
  const catalog = await getJson(options.url, key, fetcher);
  if (!Array.isArray(catalog.models))
    throw new Error("fal returned an unexpected catalog response.");
  let pricing = null;
  let pricingWarning = null;
  if (options.endpoint) {
    const url = new URL("https://api.fal.ai/v1/models/pricing");
    url.searchParams.set("endpoint_id", options.endpoint);
    try {
      pricing = await getJson(url, key, fetcher);
    } catch {
      pricingWarning =
        "Pricing unavailable. Check this model's fal pricing page before enabling it.";
    }
  }
  return {
    retrievedAt: new Date().toISOString(),
    source: options.url.toString(),
    models: catalog.models.map((model) => ({
      ...model,
      documentation: `https://fal.ai/models/${encodeURI(model.endpoint_id)}/api`,
    })),
    next_cursor: catalog.next_cursor ?? null,
    has_more: catalog.has_more === true,
    pricing,
    pricingWarning,
    nextStep:
      "Review the model schema, pricing, license and retention, then add a typed adapter in lib/server/ai/registry.ts. See docs/ADDING_FAL_FEATURES.md.",
  };
}

async function main() {
  try {
    const options = catalogOptions(process.argv.slice(2));
    if (!options) {
      console.log(
        'Search: npm run fal:discover -- --query "background removal"\nInspect schema/pricing: npm run fal:discover -- --endpoint openai/gpt-image-2.5/sunburst/edit\nOptional: --category image-to-image --limit 10 --cursor <next_cursor>\nRead-only; uses FAL_KEY from .env.local. Does not generate images.',
      );
      return;
    }
    console.log(
      JSON.stringify(await discover(options, process.env.FAL_KEY), null, 2),
    );
  } catch (error) {
    // Do not print provider bodies, request headers, stack traces or secrets.
    const message =
      error instanceof Error ? error.message : "Catalog request failed.";
    console.error(
      process.env.FAL_KEY
        ? message.replaceAll(process.env.FAL_KEY, "[redacted]")
        : message,
    );
    process.exitCode = 1;
  }
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href)
  await main();
