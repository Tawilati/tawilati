import { z } from "zod";

// Where an assistant may send the owner back to: an https address, or http only on this computer
// (assistants that run locally, like Claude Code, listen on localhost). No fragment (RFC 6749 §3.1.2).
export function isAllowedRedirectUri(value: string): boolean {
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    return false;
  }
  if (url.hash) return false;
  if (url.protocol === "https:") return true;
  return url.protocol === "http:" && ["localhost", "127.0.0.1", "[::1]"].includes(url.hostname);
}

const redirectUri = z.string().max(2000).refine(isAllowedRedirectUri, "redirect_uri must be https (or http on localhost)");

// RFC 7591 registration. Other metadata (logo_uri, scope, grant_types...) is accepted and ignored:
// every client is registered as a public client using the authorization code flow.
export const registerClientSchema = z.object({
  redirect_uris: z.array(redirectUri).min(1).max(10),
  // The consent screen shows it; long names are cut rather than refused so registration never fails on it.
  client_name: z
    .string()
    .trim()
    .transform((name) => name.slice(0, 100))
    .optional(),
});

// RFC 7636: 43 to 128 characters from the unreserved set. An S256 challenge is always 43.
const codeVerifier = z.string().regex(/^[A-Za-z0-9\-._~]{43,128}$/);
const codeChallenge = z.string().regex(/^[A-Za-z0-9\-_]{43}$/);

// The query the assistant opens /oauth/authorize with (after client_id and redirect_uri are checked).
export const authorizeQuerySchema = z.object({
  response_type: z.literal("code"),
  code_challenge: codeChallenge,
  code_challenge_method: z.literal("S256"),
  state: z.string().max(1000).optional(),
});

// The owner's answer on the consent screen, posted to /api/oauth/authorize.
export const authorizeDecisionSchema = z
  .object({
    clientId: z.string().uuid(),
    redirectUri: z.string().max(2000),
    codeChallenge,
    state: z.string().max(1000).optional(),
    decision: z.enum(["allow", "deny"]),
  })
  .strict();

// POST /api/oauth/token. Only the authorization code grant exists.
export const tokenRequestSchema = z.object({
  grant_type: z.literal("authorization_code"),
  code: z.string().regex(/^[0-9a-f]{64}$/),
  redirect_uri: z.string().max(2000),
  client_id: z.string().uuid(),
  code_verifier: codeVerifier,
});
