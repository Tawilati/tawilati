import { prisma } from "@/lib/db";
import type { CreateOAuthCodeInput, OAuthClientRecord, SpentOAuthCodeRecord } from "@/types/OAuth";
import { DBException } from "@/utils/exceptions/RepoException";

const clientSelect = { id: true, name: true, redirectUris: true, createdAt: true } as const;

// Registered AI assistants and the one-time codes owners hand them. Clients belong to no business
// (they register before anyone signs in); every code carries the business of the owner who allowed it.
export class OAuthRepo {
  private static instance: OAuthRepo;

  private constructor() {}

  static getInstance(): OAuthRepo {
    if (!OAuthRepo.instance) {
      OAuthRepo.instance = new OAuthRepo();
    }

    return OAuthRepo.instance;
  }

  async createClient(data: { name: string; redirectUris: string[] }): Promise<OAuthClientRecord> {
    try {
      return await prisma.oAuthClient.create({ data, select: clientSelect });
    } catch (err) {
      throw new DBException("Error registering OAuth client", err as Error);
    }
  }

  async findClient(clientId: string): Promise<OAuthClientRecord | null> {
    try {
      return await prisma.oAuthClient.findUnique({ where: { id: clientId }, select: clientSelect });
    } catch (err) {
      throw new DBException("Error loading OAuth client", err as Error);
    }
  }

  async createCode(data: CreateOAuthCodeInput): Promise<void> {
    try {
      await prisma.oAuthCode.create({ data, select: { id: true } });
    } catch (err) {
      throw new DBException("Error creating OAuth code", err as Error);
    }
  }

  // Spends the code in one conditional update, so of two requests racing on one code only one gets it.
  // null when the code is unknown, already used or expired.
  async spendCode(codeHash: string): Promise<SpentOAuthCodeRecord | null> {
    try {
      const [spent] = await prisma.oAuthCode.updateManyAndReturn({
        where: { codeHash, usedAt: null, expiresAt: { gt: new Date() } },
        data: { usedAt: new Date() },
        select: {
          clientId: true,
          businessId: true,
          userId: true,
          redirectUri: true,
          codeChallenge: true,
          client: { select: { name: true } },
        },
      });

      return spent ?? null;
    } catch (err) {
      throw new DBException("Error using OAuth code", err as Error);
    }
  }
}

export const oauthRepo = OAuthRepo.getInstance();
