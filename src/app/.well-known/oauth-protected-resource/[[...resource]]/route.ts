import { oauthJson, oauthPreflight, publicOrigin } from "@/lib/oauth/http";
import { protectedResourceMetadata } from "@/lib/oauth/metadata";

// GET /.well-known/oauth-protected-resource[/api/mcp] (RFC 9728): the MCP endpoint's 401 points here.
// It names this app as the place to sign in. Both the bare path and the one with the resource's path work,
// since assistants try either.
export function GET(request: Request) {
  return oauthJson(protectedResourceMetadata(publicOrigin(request)));
}

export const OPTIONS = oauthPreflight;
