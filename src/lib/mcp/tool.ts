// Shared plumbing for the MCP tools: who is calling, may they, and how errors come back.
import type {
  CallToolResult,
  McpServer,
  ServerContext,
  StandardSchemaWithJSON,
} from "@modelcontextprotocol/server";
import type { z } from "zod";
import type { McpIdentity } from "@/types/McpToken";
import { hasPermission, type PERMISSION } from "@/types/Roles";
import { AuthenticationException } from "@/utils/exceptions/http/AuthenticationException";
import { ForbiddenException } from "@/utils/exceptions/http/ForbiddenException";
import { handleRouteError } from "@/utils/handleRouteError";

// withMcpAuth put the verified token on the request; mcpTokenService.verify stored the identity in extra.
export function getIdentity(ctx: ServerContext): McpIdentity {
  const identity = ctx.http?.authInfo?.extra as McpIdentity | undefined;
  if (!identity?.businessId || !identity.role) {
    throw new AuthenticationException("unauthorized");
  }
  return identity;
}

export function requirePermission(identity: McpIdentity, permission: PERMISSION): void {
  if (!hasPermission(identity.role, permission)) {
    throw new ForbiddenException("forbidden");
  }
}

// A thrown error becomes the same { success: false, message: "<code>", details? } body the
// HTTP routes send, so a client sees the same codes. Unexpected errors stay generic.
export async function errorResult(error: unknown): Promise<CallToolResult> {
  const body = await handleRouteError(error).json();
  return { isError: true, content: [{ type: "text", text: JSON.stringify(body) }] };
}

function dataResult(data: unknown): CallToolResult {
  return { content: [{ type: "text", text: JSON.stringify(data ?? { success: true }) }] };
}

type ToolConfig<S extends z.ZodObject> = {
  title: string;
  description: string;
  inputSchema: S;
  permission: PERMISSION;
  readOnly: boolean;
};

// Registers a tool that checks the caller's permission before running, scopes everything to the
// token's business (never to an input field), and turns thrown errors into an error result.
export function registerTool<S extends z.ZodObject>(
  server: McpServer,
  name: string,
  { title, description, inputSchema, permission, readOnly }: ToolConfig<S>,
  run: (input: z.output<S>, identity: McpIdentity) => Promise<unknown>,
): void {
  // Widened for the SDK: its callback type can't be worked out while S is still generic.
  const schema: StandardSchemaWithJSON = inputSchema;
  server.registerTool(
    name,
    {
      title,
      description,
      inputSchema: schema,
      annotations: { readOnlyHint: readOnly, destructiveHint: false },
    },
    // The SDK has already parsed input against inputSchema, so it is a z.output<S>.
    async (input: unknown, ctx: ServerContext) => {
      try {
        const identity = getIdentity(ctx);
        requirePermission(identity, permission);
        return dataResult(await run(input as z.output<S>, identity));
      } catch (error) {
        return errorResult(error);
      }
    },
  );
}
