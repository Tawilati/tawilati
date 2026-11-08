// Plumbing for the OAuth endpoints an AI assistant talks to (register, token, metadata).
// These answer in the OAuth shapes the standards fix, { error: "invalid_grant" } and so on,
// not the app's { success, message } envelope, because assistants parse them by the standard.
import { getPublicOrigin } from "mcp-handler";
import { ZodError } from "zod";
import { HttpException } from "@/utils/exceptions/http/HttpException";
import logger from "@/utils/logger";

// Assistants running in a browser (the MCP Inspector, for one) read these from another origin.
export const OAUTH_CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, MCP-Protocol-Version",
};

export function oauthJson(body: unknown, status = 200): Response {
  return Response.json(body, {
    status,
    headers: { ...OAUTH_CORS_HEADERS, "Cache-Control": "no-store" },
  });
}

export function oauthError(error: string, status = 400): Response {
  return oauthJson({ error }, status);
}

export function oauthPreflight(): Response {
  return new Response(null, { status: 204, headers: OAUTH_CORS_HEADERS });
}

// The address assistants must use. NEXT_PUBLIC_APP_URL wins, like the QR codes; otherwise the
// address the request came in on, read through any proxy in front of the app.
export function publicOrigin(request: Request): string {
  const configured = process.env.NEXT_PUBLIC_APP_URL?.replace(/\/+$/, "");
  return configured || getPublicOrigin(request);
}

// The token endpoint takes a form body (RFC 6749 §4.1.3); JSON is accepted too. Anything else is null.
export async function readOAuthBody(request: Request): Promise<unknown> {
  const type = request.headers.get("content-type") ?? "";
  try {
    if (type.includes("application/x-www-form-urlencoded")) {
      return Object.fromEntries(new URLSearchParams(await request.text()));
    }
    return await request.json();
  } catch {
    return null;
  }
}

// Runs an OAuth route. A thrown HttpException's message is the OAuth error code; a Zod error becomes
// the code `onInvalid` picks; anything unexpected is logged and answered as server_error.
export async function handleOAuth(
  run: () => Promise<Response>,
  onInvalid: (error: ZodError) => string = () => "invalid_request",
): Promise<Response> {
  try {
    return await run();
  } catch (error) {
    if (error instanceof ZodError) return oauthError(onInvalid(error));
    if (error instanceof HttpException && error.status < 500) return oauthError(error.message, error.status);
    logger.error("[OAuth] Unexpected error", error);
    return oauthError("server_error", 500);
  }
}
