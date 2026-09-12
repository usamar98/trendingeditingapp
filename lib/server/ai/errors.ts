import "server-only";

export class ProviderError extends Error {
  constructor(
    public uncertain: boolean,
    public reason: string,
  ) {
    super(reason);
  }
}
