import { unstable_rethrow } from "next/navigation";
import type { NextRequest } from "next/server";
import { z } from "zod";
import logger from "@/utils/logger";
import { HttpException } from "@/utils/exceptions/http/HttpException";

// Same shape as src/proxy.ts and src/lib/auth/gaurd.ts: { success: false, message, details? }.
// For API errors the message is the contract code (e.g. "invalid_qr"); the UI maps it to a sentence.
export function errorResponse(status: number, message: string, details?: unknown) {
  return Response.json({ success: false, message, ...(details ? { details } : {}) }, { status });
}

// Parses the query string; throws validation_error (400) if it doesn't match.
export function parseQuery<S extends z.ZodType>(request: NextRequest, schema: S): z.output<S> {
  const result = schema.safeParse(Object.fromEntries(request.nextUrl.searchParams));
  if (!result.success) throw result.error;
  return result.data;
}

// Runs a route body and turns thrown errors into the JSON error shape above.
export async function handle(run: () => Promise<Response>): Promise<Response> {
  try {
    return await run();
  } catch (error) {
    // Let Next.js's own control-flow signals through (prerender bail-out, notFound(), redirect()).
    unstable_rethrow(error);
    if (error instanceof HttpException) return errorResponse(error.status, error.message, error.details);
    if (error instanceof z.ZodError) {
      return errorResponse(400, "validation_error", z.flattenError(error).fieldErrors);
    }
    logger.error("Unhandled error in route handler", error);
    return errorResponse(500, "internal_error");
  }
}
