// The owner's AI integrations screen talks to /api/mcp-tokens. Each connection is one MCP token; the key itself
// is only in the create response, never in the list. Error codes never reach the person: `integrationSentenceFor`
// turns each one into a sentence.
import { ApiError, call } from "../api";

export type Connection = {
  id: string;
  name: string;
  expiresAt: string;
  revokedAt: string | null;
  lastUsedAt: string | null;
  createdAt: string;
  // "key": created on this screen. "sign-in": an assistant connected by having the owner sign in.
  source: "key" | "sign-in";
};

// Only the create response carries the key.
export type NewConnection = Connection & { token: string };

export type ConnectionStatus = "active" | "revoked" | "expired";

export const integrationsApi = {
  list: () => call<Connection[]>("/api/mcp-tokens", "GET"),
  create: (name: string) => call<NewConnection>("/api/mcp-tokens", "POST", { name }),
  revoke: (id: string) => call<Connection>(`/api/mcp-tokens/${id}/revoke`, "POST"),
};

// Same limit as createMcpTokenSchema.
export const NAME_MAX = 100;

export function connectionStatus(connection: Connection, now: Date = new Date()): ConnectionStatus {
  if (connection.revokedAt) return "revoked";
  if (new Date(connection.expiresAt).getTime() <= now.getTime()) return "expired";
  return "active";
}

const SENTENCES: Record<string, string> = {
  offline: "We couldn't reach Tawilati. Check your connection and try again.",
  unauthorized: "Your session ended. Sign in again to keep going.",
  forbidden: "Only the business owner can manage AI integrations.",
  validation_error: `Give the connection a name of up to ${NAME_MAX} characters.`,
  mcp_token_not_found: "This connection was already revoked. Refresh the page.",
};

export function integrationSentenceFor(error: unknown): string {
  const code = error instanceof ApiError ? error.code : "";
  return SENTENCES[code] ?? "Something went wrong on our side. Please try again in a moment.";
}

// "3 Nov 2026"
export function formatDay(iso: string): string {
  return new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
}

// The address an AI assistant connects to. The public address wins, like the QR codes.
// Pasted on its own into Claude or ChatGPT, the assistant asks the owner to sign in.
export function mcpUrl(origin: string): string {
  return `${process.env.NEXT_PUBLIC_APP_URL ?? origin}/api/mcp`;
}

// What goes in the assistant's "Authorization" header for a connection made with a key. A header keeps the key
// out of addresses (and so out of server logs); /api/mcp/<key> still works for assistants that can't send one.
export function authorizationHeader(token: string): string {
  return `Bearer ${token}`;
}

// One line the owner can paste into a terminal to add Tawilati to Claude Code. User scope, so it works
// in every folder (a local server is tied to one folder's exact path, which Windows spells two ways).
export function claudeCodeCommand(url: string, token: string): string {
  return `claude mcp add --scope user --transport http tawilati ${url} --header "Authorization: Bearer ${token}"`;
}
