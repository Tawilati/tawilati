import { mcpEndpoint } from "@/lib/mcp/handler";

// POST /api/mcp/<key>: the same MCP endpoint with the key in the address, for assistants whose setup
// has room for an address but not a header (Claude's "Add custom connector" form). The key is moved
// into the Authorization header and checked exactly as on /api/mcp. A key in an address can end up in
// server logs, so signing in is the safer way; revoking the key cuts this address off too.
const KEY = /^[0-9a-f]{64}$/;

async function withKeyInAddress(request: Request, { params }: { params: Promise<{ key: string }> }) {
  const { key } = await params;
  const headers = new Headers(request.headers);
  // Not a key's shape: send nothing, so the endpoint answers with its usual 401.
  if (KEY.test(key)) headers.set("authorization", `Bearer ${key}`);
  else headers.delete("authorization");

  const hasBody = request.method !== "GET" && request.method !== "HEAD";
  return mcpEndpoint(
    new Request(request.url, {
      method: request.method,
      headers,
      body: hasBody ? await request.arrayBuffer() : undefined,
      signal: request.signal,
    }),
  );
}

export { withKeyInAddress as GET, withKeyInAddress as POST, withKeyInAddress as DELETE };
