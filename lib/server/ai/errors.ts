import "server-only";

export class ProviderError extends Error {
  constructor(
    public uncertain: boolean,
    public reason: string,
  ) {
    super(reason);
  }
}

// Only a final queue result can establish a failed generation. HTTP failures
// while checking status or retrieving media must never trigger a refund/replay.
export class ProviderReadError extends Error {
  constructor(
    public reason: string,
    public httpStatus?: number,
    public definitive = false,
  ) {
    super(reason);
  }
}
