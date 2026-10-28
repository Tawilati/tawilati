import { unstable_rethrow } from "next/navigation";
import type { NextRequest } from "next/server";
import { z } from "zod";
import { BadRequestException } from "@/utils/exceptions/http/BadRequestException";
import { handleRouteError } from "@/utils/handleRouteError";

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

// Parses route parameters; throws validation_error (400) if they don't match.
export async function parseParams<S extends z.ZodType>(
  params: Promise<unknown>,
  schema: S,
): Promise<z.output<S>> {
  const result = schema.safeParse(await params);
  if (!result.success) throw result.error;
  return result.data;
}

// Parses the JSON body; throws invalid_json (400) if it isn't JSON, validation_error (400) if it doesn't match.
export async function parseBody<S extends z.ZodType>(request: NextRequest, schema: S): Promise<z.output<S>> {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    throw new BadRequestException("invalid_json");
  }
  const result = schema.safeParse(body);
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
    return handleRouteError(error);
  }
}
