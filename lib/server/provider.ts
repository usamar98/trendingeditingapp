import "server-only";
import type { Preset, Quality } from "@/lib/presets";
import { runFeature } from "./ai/features";
export { ProviderError } from "./ai/errors";

export async function editPortrait(
  photo: Buffer,
  preset: Preset,
  quality: Quality,
) {
  return runFeature("retro-portrait", { photo, preset, quality });
}
