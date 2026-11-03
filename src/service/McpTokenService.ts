import { createHash, randomBytes } from "node:crypto";
import type { AuthInfo } from "@modelcontextprotocol/server";
import { mcpTokenRepo } from "@/repository/McpTokenRepo";
import {
  mapToMcpIdentity,
  mapToMcpTokenResponse,
  mapToMcpTokenResponseList,
  type CreatedMcpTokenResponse,
  type McpTokenResponse,
} from "@/types/McpToken";
import { NotFoundException } from "@/utils/exceptions/http/NotFoundException";

const TOKEN_LIFETIME_MS = 90 * 24 * 60 * 60 * 1000; // 90 days

// The token is 32 random bytes, so SHA-256 is enough; bcrypt would slow every MCP request.
function hashToken(rawToken: string): string {
  return createHash("sha256").update(rawToken).digest("hex");
}

export class McpTokenService {
  private static instance: McpTokenService;

  private constructor() {}

  static getInstance(): McpTokenService {
    if (!McpTokenService.instance) {
      McpTokenService.instance = new McpTokenService();
    }

    return McpTokenService.instance;
  }

  // Only the hash is stored, so this response is the one time the raw token exists.
  async create(
    businessId: string,
    userId: string,
    name: string,
  ): Promise<CreatedMcpTokenResponse> {
    const rawToken = randomBytes(32).toString("hex");
    const record = await mcpTokenRepo.create({
      businessId,
      userId,
      name,
      tokenHash: hashToken(rawToken),
      expiresAt: new Date(Date.now() + TOKEN_LIFETIME_MS),
    });

    return { ...mapToMcpTokenResponse(record), token: rawToken };
  }

  // undefined tells withMcpAuth to refuse the request.
  async verify(rawToken?: string): Promise<AuthInfo | undefined> {
    if (!rawToken) return undefined;

    const record = await mcpTokenRepo.findActiveByHash(hashToken(rawToken));
    if (!record || !record.user.isActive) return undefined;

    await mcpTokenRepo.touch(record.id);

    return {
      token: rawToken,
      clientId: record.id,
      scopes: [],
      expiresAt: Math.floor(record.expiresAt.getTime() / 1000),
      extra: mapToMcpIdentity(record),
    };
  }

  async list(businessId: string): Promise<McpTokenResponse[]> {
    const records = await mcpTokenRepo.findManyByBusiness(businessId);
    return mapToMcpTokenResponseList(records);
  }

  async revoke(tokenId: string, businessId: string): Promise<McpTokenResponse> {
    const revoked = await mcpTokenRepo.revoke(tokenId, businessId);

    if (!revoked) {
      throw new NotFoundException("mcp_token_not_found");
    }

    return mapToMcpTokenResponse(revoked);
  }
}

export const mcpTokenService = McpTokenService.getInstance();
