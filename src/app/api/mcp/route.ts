import { createMcpHandler, withMcpAuth } from "mcp-handler";
import { registerTawilatiTools } from "@/lib/mcp/tools";
import { mcpTokenService } from "@/service/McpTokenService";

// POST /api/mcp (Bearer McpToken): the MCP endpoint AI assistants connect to.
// The proxy steps aside for this path; withMcpAuth refuses any request whose token
// mcpTokenService.verify doesn't accept (missing, unknown, revoked, expired, deactivated user).
const handler = createMcpHandler(registerTawilatiTools, {
  serverInfo: { name: "tawilati", version: "1.0.0" },
});

const authenticated = withMcpAuth(handler, (_request, token) => mcpTokenService.verify(token), {
  required: true,
});

export { authenticated as GET, authenticated as POST, authenticated as DELETE };
