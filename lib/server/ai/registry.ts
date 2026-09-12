import "server-only";
import { portraitPrompt, type Preset, type Quality } from "@/lib/presets";

export type PortraitInput = { photo: Buffer; preset: Preset; quality: Quality };
export type PortraitOutput = {
  bytes: Buffer;
  requestId: string | null;
  usage: null;
};
export type FeatureInputs = { "retro-portrait": PortraitInput };
export type FeatureOutputs = { "retro-portrait": PortraitOutput };
export type FeatureId = keyof FeatureInputs;

type FalFeature<K extends FeatureId> = {
  provider: "fal";
  endpoint: string;
  version: string;
  docs: string;
  buildInput: (input: FeatureInputs[K]) => Record<string, unknown>;
  decode: (data: unknown, requestId: string | null) => FeatureOutputs[K];
};

function decodePortrait(
  data: unknown,
  requestId: string | null,
): PortraitOutput {
  const images = (data as { images?: { url?: unknown }[] } | null)?.images;
  if (!Array.isArray(images) || images.length !== 1)
    throw new Error("Missing portrait");
  const uri = images[0]?.url;
  const prefix = "data:image/png;base64,";
  // sync_mode is part of this model's schema. Never fetch an unexpected output URL.
  if (typeof uri !== "string" || !uri.startsWith(prefix))
    throw new Error("Expected private data URI");
  const encoded = uri.slice(prefix.length);
  if (
    !encoded.length ||
    encoded.length % 4 !== 0 ||
    encoded.length > 32_000_000 ||
    !/^[A-Za-z0-9+/]+={0,2}$/.test(encoded)
  )
    throw new Error("Invalid image encoding");
  const bytes = Buffer.from(encoded, "base64");
  if (bytes.toString("base64") !== encoded) throw new Error("Invalid base64");
  // Full PNG decoding/dimension validation happens before private storage in jobs.ts.
  return { bytes, requestId, usage: null };
}

/** Add reviewed model adapters here. Catalog discovery never modifies this allowlist. */
export const FEATURES: { [K in FeatureId]: FalFeature<K> } = {
  "retro-portrait": {
    provider: "fal",
    endpoint: "openai/gpt-image-2.5/sunburst/edit",
    version: "1",
    docs: "https://fal.ai/models/openai/gpt-image-2.5/sunburst/edit/api",
    buildInput: ({ photo, preset, quality }) => ({
      prompt: portraitPrompt(preset),
      image_urls: [`data:image/jpeg;base64,${photo.toString("base64")}`],
      image_size: { width: 1024, height: 1536 },
      quality,
      num_images: 1,
      output_format: "png",
      sync_mode: true,
    }),
    decode: decodePortrait,
  },
};
