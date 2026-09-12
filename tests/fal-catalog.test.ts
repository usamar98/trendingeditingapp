import { describe, it, expect, vi } from "vitest";
import { catalogOptions, discover } from "../scripts/fal-catalog.mjs";

describe("read-only fal model discovery", () => {
  it("uses official search parameters and exposes pagination", async () => {
    const options = catalogOptions([
      "--query",
      "background removal",
      "--category",
      "image-to-image",
      "--cursor",
      "Mg==",
    ]);
    expect(options!.url.searchParams.get("q")).toBe("background removal");
    expect(options!.url.searchParams.has("query")).toBe(false);
    expect(options!.url.searchParams.get("cursor")).toBe("Mg==");
    const fetcher = vi
      .fn()
      .mockResolvedValue(
        Response.json({
          models: [
            {
              endpoint_id: "fal-ai/example",
              metadata: { category: "image-to-image" },
            },
          ],
          next_cursor: "Mw==",
          has_more: true,
        }),
      );
    const result = await discover(options!, "test-key", fetcher);
    expect(fetcher.mock.calls[0][1]).toMatchObject({
      method: "GET",
      headers: { Authorization: "Key test-key" },
    });
    expect(result.has_more).toBe(true);
    expect(result.next_cursor).toBe("Mw==");
    expect(result.models[0].documentation).toBe(
      "https://fal.ai/models/fal-ai/example/api",
    );
    expect(fetcher).toHaveBeenCalledTimes(1);
  });
  it("retrieves the exact endpoint's schema and account pricing without inference", async () => {
    const endpoint = "openai/gpt-image-2.5/sunburst/edit";
    const options = catalogOptions(["--endpoint", endpoint]);
    expect(options!.url.searchParams.get("expand")).toBe("openapi-3.0");
    const fetcher = vi
      .fn()
      .mockResolvedValueOnce(
        Response.json({
          models: [{ endpoint_id: endpoint, openapi: { openapi: "3.0.0" } }],
        }),
      )
      .mockResolvedValueOnce(
        Response.json({ prices: [{ endpoint_id: endpoint, unit: "token" }] }),
      );
    const result = await discover(options!, "test-key", fetcher);
    expect(result.models[0].openapi).toEqual({ openapi: "3.0.0" });
    expect(result.pricing?.prices[0].unit).toBe("token");
    expect(
      fetcher.mock.calls.every(
        ([url, init]) => url.hostname === "api.fal.ai" && init.method === "GET",
      ),
    ).toBe(true);
    expect(fetcher.mock.calls[1][0].searchParams.get("endpoint_id")).toBe(
      endpoint,
    );
  });
  it("reports missing credentials, invalid arguments and sanitized HTTP errors", async () => {
    const options = catalogOptions(["--query", "upscale"]);
    const fetcher = vi.fn();
    await expect(discover(options!, "", fetcher)).rejects.toThrow(
      "Set FAL_KEY",
    );
    expect(fetcher).not.toHaveBeenCalled();
    expect(() =>
      catalogOptions(["--query", "upscale", "--limit", "0"]),
    ).toThrow("1–50");
    expect(() => catalogOptions([])).toThrow("Supply");
    expect(catalogOptions(["--help"])).toBeNull();
    fetcher.mockResolvedValue(
      new Response("sensitive payload", { status: 401 }),
    );
    await expect(discover(options!, "test-key", fetcher)).rejects.toThrow(
      "HTTP 401",
    );
  });
  it("keeps discovered schema usable when account pricing is unavailable", async () => {
    const options = catalogOptions(["--endpoint", "fal-ai/example"]);
    const fetcher = vi
      .fn()
      .mockResolvedValueOnce(
        Response.json({ models: [{ endpoint_id: "fal-ai/example" }] }),
      )
      .mockResolvedValueOnce(new Response("", { status: 403 }));
    const result = await discover(options!, "test-key", fetcher);
    expect(result.models).toHaveLength(1);
    expect(result.pricing).toBeNull();
    expect(result.pricingWarning).toContain("Pricing unavailable");
  });
});
