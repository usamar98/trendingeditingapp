export class AppError extends Error {
  constructor(
    public code: string,
    message: string,
    public status = 400,
  ) {
    super(message);
  }
}
export function errorResponse(error: unknown) {
  if (error instanceof AppError)
    return Response.json(
      { error: error.message, code: error.code },
      { status: error.status },
    );
  // Never log request bodies, photographs, credentials or raw provider errors.
  console.error(
    "EditingApp request failed",
    error instanceof Error ? error.name : "UnknownError",
  );
  return Response.json(
    {
      error:
        "Something went wrong. Check the existing request before trying again.",
      code: "INTERNAL",
    },
    { status: 500 },
  );
}
