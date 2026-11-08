// What an AI assistant reads to find out how to sign in (RFC 8414 and RFC 9728).
// The MCP endpoint's 401 points at the protected resource document, which names this app as the
// authorization server, whose document lists the endpoints below.
import { MCP_SCOPE } from "@/types/OAuth";

export const MCP_PATH = "/api/mcp";
// Where the MCP endpoint's 401 points (RFC 9728 §3.1: the well-known prefix, then the resource's path).
export const PROTECTED_RESOURCE_METADATA_PATH = `/.well-known/oauth-protected-resource${MCP_PATH}`;

export function authorizationServerMetadata(origin: string) {
  return {
    issuer: origin,
    authorization_endpoint: `${origin}/oauth/authorize`,
    token_endpoint: `${origin}/api/oauth/token`,
    registration_endpoint: `${origin}/api/oauth/register`,
    response_types_supported: ["code"],
    grant_types_supported: ["authorization_code"],
    token_endpoint_auth_methods_supported: ["none"],
    code_challenge_methods_supported: ["S256"],
    scopes_supported: [MCP_SCOPE],
  };
}

export function protectedResourceMetadata(origin: string) {
  return {
    resource: `${origin}${MCP_PATH}`,
    authorization_servers: [origin],
    bearer_methods_supported: ["header"],
    scopes_supported: [MCP_SCOPE],
    resource_name: "Tawilati",
  };
}
