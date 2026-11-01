import { ROLE, toRole } from "./Roles";

// What the repository returns for lists and revokes. Never includes tokenHash.
export type McpTokenRecord = {
  id: string;
  name: string;
  expiresAt: Date;
  revokedAt: Date | null;
  lastUsedAt: Date | null;
  createdAt: Date;
};

// What findActiveByHash returns: enough to decide whether the token may be used, and as whom.
export type ActiveMcpTokenRecord = {
  id: string;
  businessId: string;
  userId: string;
  expiresAt: Date;
  user: { role: string; isActive: boolean };
};

// Who a verified token acts as. Stored in AuthInfo.extra and read by every MCP tool.
export type McpIdentity = {
  userId: string;
  businessId: string;
  role: ROLE;
};

// What the token routes send back when listing tokens.
export interface McpTokenResponse {
  id: string;
  name: string;
  expiresAt: Date;
  revokedAt: Date | null;
  lastUsedAt: Date | null;
  createdAt: Date;
}

// Sent only once, when the token is created. The raw token can't be shown again.
export interface CreatedMcpTokenResponse extends McpTokenResponse {
  token: string;
}

export function mapToMcpTokenResponse(record: McpTokenRecord): McpTokenResponse {
  return {
    id: record.id,
    name: record.name,
    expiresAt: record.expiresAt,
    revokedAt: record.revokedAt,
    lastUsedAt: record.lastUsedAt,
    createdAt: record.createdAt,
  };
}

export function mapToMcpTokenResponseList(records: McpTokenRecord[]): McpTokenResponse[] {
  return records.map(mapToMcpTokenResponse);
}

export function mapToMcpIdentity(record: ActiveMcpTokenRecord): McpIdentity {
  return {
    userId: record.userId,
    businessId: record.businessId,
    role: toRole(record.user.role),
  };
}
