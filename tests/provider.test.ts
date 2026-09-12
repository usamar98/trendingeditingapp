import { afterEach, beforeEach, describe, it, expect, vi } from "vitest";
import { editPortrait } from "@/lib/server/provider";
import { runFeature } from "@/lib/server/ai/features";
import { runFal } from "@/lib/server/ai/fal";
import { configured } from "@/lib/server/config";

beforeEach(() => vi.stubEnv("FAL_KEY", "test-fal-key"));
afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});
const success = () =>
  Response.json(
    {
      images: [
        {
          url: `data:image/png;base64,${Buffer.from("image").toString("base64")}`,
        },
      ],
    },
    { headers: { "x-fal-request-id": "req_test" } },
  );
const generate = () => editPortrait(Buffer.from("selfie"), "studio", "medium");

describe("fal API adapter contract (mocked network)", () => {
  it("uses the documented Sunburst endpoint, reference input, size and inline output", async () => {
    const fetch = vi.fn().mockResolvedValue(success());
    vi.stubGlobal("fetch", fetch);
    const result = await generate();
    const [url, options] = fetch.mock.calls[0];
    expect(url).toBe("https://fal.run/openai/gpt-image-2.5/sunburst/edit");
    expect(options.method).toBe("POST");
    expect(options.headers.Authorization).toBe("Key test-fal-key");
    expect(options.headers["X-Fal-Store-IO"]).toBe("0");
    expect(options.headers["X-Fal-No-Retry"]).toBe("1");
    expect(
      JSON.parse(options.headers["X-Fal-Object-Lifecycle-Preference"]),
    ).toEqual({
      expiration_duration_seconds: 3600,
      initial_acl: { default: "forbid" },
    });
    expect(JSON.parse(options.body)).toEqual({
      prompt: expect.stringContaining("SAME person"),
      image_urls: [
        `data:image/jpeg;base64,${Buffer.from("selfie").toString("base64")}`,
      ],
      image_size: { width: 1024, height: 1536 },
      quality: "medium",
      num_images: 1,
      output_format: "png",
      sync_mode: true,
    });
    expect(options.redirect).toBe("error");
    expect(result.bytes.toString()).toBe("image");
    expect(result.requestId).toBe("req_test");
    expect(result.usage).toBeNull();
    expect(fetch).toHaveBeenCalledTimes(1);
  });
  it("never retries network failures or switches to another provider", async () => {
    const fetch = vi.fn().mockRejectedValue(new Error("timeout"));
    vi.stubGlobal("fetch", fetch);
    await expect(generate()).rejects.toMatchObject({
      uncertain: true,
      reason: "CONNECTION_UNCERTAIN",
    });
    expect(fetch).toHaveBeenCalledTimes(1);
  });
  it.each([
    [503, true, "PROVIDER_REJECTED"],
    [408, true, "PROVIDER_REJECTED"],
    [422, false, "PROVIDER_REJECTED"],
    [429, false, "PROVIDER_BUSY"],
  ])(
    "classifies HTTP %s without exposing the provider body",
    async (status, uncertain, reason) => {
      const fetch = vi
        .fn()
        .mockResolvedValue(
          new Response("secret internal details", { status: Number(status) }),
        );
      vi.stubGlobal("fetch", fetch);
      await expect(generate()).rejects.toMatchObject({
        uncertain,
        reason,
        message: reason,
      });
      expect(fetch).toHaveBeenCalledTimes(1);
    },
  );
  it.each([
    {},
    { images: [{ url: "https://fal.media/public-photo.png" }] },
    { images: [{ url: "http://169.254.169.254/credentials" }] },
    { images: [{ url: "data:image/png;base64,not base64" }] },
  ])(
    "rejects malformed or remote output without fetching it: %j",
    async (body) => {
      const fetch = vi.fn().mockResolvedValue(Response.json(body));
      vi.stubGlobal("fetch", fetch);
      await expect(generate()).rejects.toMatchObject({
        uncertain: true,
        reason: "INVALID_PROVIDER_RESPONSE",
      });
      expect(fetch).toHaveBeenCalledTimes(1);
    },
  );
  it("bounds a streaming response before decoding", async () => {
    let sent = 0;
    const stream = new ReadableStream({
      pull(controller) {
        if (sent++ < 33) controller.enqueue(new Uint8Array(1_000_000));
        else controller.close();
      },
    });
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(stream)));
    await expect(generate()).rejects.toMatchObject({
      uncertain: true,
      reason: "INVALID_PROVIDER_RESPONSE",
    });
  });
  it("fails closed for missing keys or unregistered features before a billable call", async () => {
    const fetch = vi.fn();
    vi.stubGlobal("fetch", fetch);
    vi.stubEnv("FAL_KEY", "");
    await expect(generate()).rejects.toMatchObject({
      uncertain: false,
      reason: "NOT_CONFIGURED",
    });
    await expect(
      runFeature("not-registered" as "retro-portrait", {
        photo: Buffer.from("x"),
        preset: "studio",
        quality: "medium",
      }),
    ).rejects.toMatchObject({ uncertain: false, reason: "INVALID_FEATURE" });
    vi.stubEnv("FAL_KEY", "test-key");
    await expect(runFal("https://evil.test/model", {})).rejects.toMatchObject({
      uncertain: false,
    });
    expect(fetch).not.toHaveBeenCalled();
  });
  it("enables generation without cron or direct OpenAI keys, but still requires fal", () => {
    for (const name of [
      "SUPABASE_URL",
      "SUPABASE_ANON_KEY",
      "SUPABASE_SERVICE_ROLE_KEY",
      "APP_URL",
    ])
      vi.stubEnv(name, "configured");
    vi.stubEnv("OPENAI_API_KEY", "");
    vi.stubEnv("CRON_SECRET", "");
    expect(configured()).toBe(true);
    vi.stubEnv("FAL_KEY", "");
    expect(configured()).toBe(false);
  });
});
