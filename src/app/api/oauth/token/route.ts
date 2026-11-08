import { handleOAuth, oauthError, oauthJson, oauthPreflight, readOAuthBody } from "@/lib/oauth/http";
import { oauthService } from "@/service/OAuthService";
import { tokenRequestSchema } from "@/validation/oauthSchemas";

// POST /api/oauth/token (public, RFC 6749 §4.1.3 with PKCE): the assistant swaps the one-time code from
// the owner's "Allow" for an MCP token. Form or JSON body. Answers 200 with the token, or 400 { error }:
// unsupported_grant_type, invalid_request, invalid_grant (unknown, used, expired or mismatched code).
export async function POST(request: Request) {
  return handleOAuth(async () => {
    const body = await readOAuthBody(request);
    const grantType = (body as { grant_type?: unknown } | null)?.grant_type;
    if (typeof grantType === "string" && grantType !== "authorization_code") {
      return oauthError("unsupported_grant_type");
    }
    return oauthJson(await oauthService.exchangeCode(tokenRequestSchema.parse(body)));
  });
}

export const OPTIONS = oauthPreflight;
