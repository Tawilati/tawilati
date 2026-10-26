import type { NextRequest } from "next/server";
import { z } from "zod";
import logger from "@/src/utils/logger";
import { AppError } from "@/src/server/errors";

export function errorResponse(status: number, code: string, details?: unknown) {
  return Response.json({ error: { code, ...(details ? { details } : {}) } }, { status });
}

// Parses the query string; throws validation_error (400) if it doesn't match.
export function parseQuery<S extends z.ZodType>(request: NextRequest, schema: S): z.output<S> {
  const result = schema.safeParse(Object.fromEntries(request.nextUrl.searchParams));
  if (!result.success) throw result.error;
  return result.data;
}

// Runs a route body and turns thrown errors into the JSON error shape of the API contract.
export async function handle(run: () => Promise<Response>): Promise<Response> {
  try {
    return await run();
  } catch (error) {
    if (error instanceof AppError) return errorResponse(error.status, error.code);
    if (error instanceof z.ZodError) {
      return errorResponse(400, "validation_error", z.flattenError(error).fieldErrors);
    }
    logger.error("Unhandled error in route handler", error);
    return errorResponse(500, "internal_error");
  }
}
