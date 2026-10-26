// An expected failure with an HTTP status and a stable error code from the API contract.
// The UI maps the code to a friendly sentence; it is never shown as-is.
export class AppError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string = code,
  ) {
    super(message);
    this.name = "AppError";
  }
}

export const notFound = (code = "not_found") => new AppError(404, code);
export const conflict = (code: string) => new AppError(409, code);
