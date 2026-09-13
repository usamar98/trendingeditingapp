import "server-only";
import {
  FEATURES,
  type FeatureId,
  type FeatureInputs,
  type FeatureOutputs,
} from "./registry";
import { runFal } from "./fal";
import { ProviderError } from "./errors";
import { submitFal } from "./fal-queue";

export async function runFeature<K extends FeatureId>(
  id: K,
  input: FeatureInputs[K],
  options?: { webhookUrl: string },
): Promise<FeatureOutputs[K]> {
  if (!Object.hasOwn(FEATURES, id))
    throw new ProviderError(false, "INVALID_FEATURE");
  const feature = FEATURES[id];
  const payload = feature.buildInput(input);
  if (feature.mode === "queue" && !options?.webhookUrl)
    throw new ProviderError(false, "INVALID_FEATURE");
  const result =
    feature.mode === "queue"
      ? await submitFal(feature.endpoint, payload, options!.webhookUrl)
      : await runFal(feature.endpoint, payload);
  try {
    return feature.decode(result.data, result.requestId);
  } catch {
    throw new ProviderError(true, "INVALID_PROVIDER_RESPONSE");
  }
}
