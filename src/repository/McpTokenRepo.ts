import { prisma } from "@/lib/db";
import type { ActiveMcpTokenRecord, McpTokenRecord } from "@/types/McpToken";
import { DBException } from "@/utils/exceptions/RepoException";

// The columns safe to send back. tokenHash is left out on purpose.
const mcpTokenSelect = {
  id: true,
  name: true,
  expiresAt: true,
  revokedAt: true,
  lastUsedAt: true,
  createdAt: true,
  clientId: true,
} as const;

export class McpTokenRepo {
  private static instance: McpTokenRepo;

  private constructor() {}

  static getInstance(): McpTokenRepo {
    if (!McpTokenRepo.instance) {
      McpTokenRepo.instance = new McpTokenRepo();
    }

    return McpTokenRepo.instance;
  }

  async create(data: {
    businessId: string;
    userId: string;
    name: string;
    tokenHash: string;
    expiresAt: Date;
    // The assistant that got this token by signing in, if it did.
    clientId?: string;
  }): Promise<McpTokenRecord> {
    try {
      return await prisma.mcpToken.create({ data, select: mcpTokenSelect });
    } catch (err) {
      throw new DBException("Error creating MCP token", err as Error);
    }
  }

  // Only a token that is neither revoked nor expired comes back.
  async findActiveByHash(tokenHash: string): Promise<ActiveMcpTokenRecord | null> {
    try {
      return await prisma.mcpToken.findFirst({
        where: {
          tokenHash,
          revokedAt: null,
          expiresAt: { gt: new Date() },
        },
        select: {
          id: true,
          businessId: true,
          userId: true,
          expiresAt: true,
          user: { select: { role: true, isActive: true } },
        },
      });
    } catch (err) {
      throw new DBException("Error loading MCP token", err as Error);
    }
  }

  async touch(tokenId: string): Promise<void> {
    try {
      await prisma.mcpToken.updateMany({
        where: { id: tokenId },
        data: { lastUsedAt: new Date() },
      });
    } catch (err) {
      throw new DBException("Error updating MCP token", err as Error);
    }
  }

  async findManyByBusiness(businessId: string): Promise<McpTokenRecord[]> {
    try {
      return await prisma.mcpToken.findMany({
        where: { businessId },
        orderBy: { createdAt: "desc" },
        select: mcpTokenSelect,
      });
    } catch (err) {
      throw new DBException("Error listing MCP tokens", err as Error);
    }
  }

  // The revoked token, or null when no active token has this id in this business.
  async revoke(tokenId: string, businessId: string): Promise<McpTokenRecord | null> {
    try {
      const [revoked] = await prisma.mcpToken.updateManyAndReturn({
        where: { id: tokenId, businessId, revokedAt: null },
        data: { revokedAt: new Date() },
        select: mcpTokenSelect,
      });

      return revoked ?? null;
    } catch (err) {
      throw new DBException("Error revoking MCP token", err as Error);
    }
  }
}

export const mcpTokenRepo = McpTokenRepo.getInstance();
