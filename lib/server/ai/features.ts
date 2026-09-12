import "server-only";
import {
  FEATURES,
  type FeatureId,
  type FeatureInputs,
  type FeatureOutputs,
} from "./registry";
import { runFal } from "./fal";
import { ProviderError } from "./errors";

export async function runFeature<K extends FeatureId>(
  id: K,
  input: FeatureInputs[K],
): Promise<FeatureOutputs[K]> {
  if (!Object.hasOwn(FEATURES, id))
    throw new ProviderError(false, "INVALID_FEATURE");
  const feature = FEATURES[id];
  const payload = feature.buildInput(input);
  const result = await runFal(feature.endpoint, payload);
  try {
    return feature.decode(result.data, result.requestId);
  } catch {
    throw new ProviderError(true, "INVALID_PROVIDER_RESPONSE");
  }
}
