import { createMcpHandler, withMcpAuth } from "mcp-handler";
import { registerTawilatiTools } from "@/lib/mcp/tools";
import { PROTECTED_RESOURCE_METADATA_PATH } from "@/lib/oauth/metadata";
import { mcpTokenService } from "@/service/McpTokenService";

const handler = createMcpHandler(registerTawilatiTools, {
  serverInfo: { name: "tawilati", version: "1.0.0" },
});

// The MCP endpoint behind both addresses: /api/mcp (key in the Authorization header, from a key or from
// signing in) and /api/mcp/<key> (key in the address). Refuses any request whose token
// mcpTokenService.verify doesn't accept (missing, unknown, revoked, expired, deactivated user). Its 401
// points the assistant at the sign-in metadata, which is how Claude knows to ask the owner to sign in.
export const mcpEndpoint = withMcpAuth(handler, (_request, token) => mcpTokenService.verify(token), {
  required: true,
  resourceMetadataPath: PROTECTED_RESOURCE_METADATA_PATH,
  resourceUrl: process.env.NEXT_PUBLIC_APP_URL?.replace(/\/+$/, "") || undefined,
});
