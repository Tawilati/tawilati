import { mcpEndpoint } from "@/lib/mcp/handler";

// POST /api/mcp (Bearer McpToken): the MCP endpoint AI assistants connect to, with the key in the
// Authorization header (Claude Code, or Claude after the owner signed in). The proxy steps aside for
// this path; src/lib/mcp/handler.ts checks the token.
export { mcpEndpoint as GET, mcpEndpoint as POST, mcpEndpoint as DELETE };
