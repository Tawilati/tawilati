import { createHash, timingSafeEqual } from "node:crypto";

// PKCE (RFC 7636), S256 only: the challenge is the base64url SHA-256 of the verifier, without padding.
export function s256Challenge(codeVerifier: string): string {
  return createHash("sha256").update(codeVerifier).digest("base64url");
}

// True when the verifier sent with the code matches the challenge sent when the code was asked for.
export function verifyPkce(codeVerifier: string, codeChallenge: string): boolean {
  const expected = Buffer.from(s256Challenge(codeVerifier));
  const given = Buffer.from(codeChallenge);
  return expected.length === given.length && timingSafeEqual(expected, given);
}
