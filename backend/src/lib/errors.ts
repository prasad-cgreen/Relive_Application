export class HttpError extends Error {
  constructor(
    public status: number,
    public code: string,
    message: string,
    public retryable = false,
    public details?: unknown,
  ) {
    super(message);
  }
}

export class ProviderError extends Error {
  constructor(
    public kind: "BUSINESS_FAILURE" | "TECHNICAL_FAILURE" | "TIMEOUT",
    public code: string,
    message: string,
    public retryable: boolean,
  ) {
    super(message);
  }
}
