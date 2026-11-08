import { oauthJson, oauthPreflight, publicOrigin } from "@/lib/oauth/http";
import { authorizationServerMetadata } from "@/lib/oauth/metadata";

// GET /.well-known/oauth-authorization-server (RFC 8414): where an AI assistant registers, sends the
// owner to sign in, and swaps the code for a token.
export function GET(request: Request) {
  return oauthJson(authorizationServerMetadata(publicOrigin(request)));
}

export const OPTIONS = oauthPreflight;
