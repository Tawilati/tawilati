// src/service/SlugService.ts
//made  this so it can ensure uniqnes of slug
import { prisma } from "@/lib/db";

import { DBException } from "@/utils/exceptions/RepoException";

export class SlugService {
  private static instance: SlugService;

  static getInstance(): SlugService {
    if (!SlugService.instance) {
      SlugService.instance = new SlugService();
    }
    return SlugService.instance;
  }

  /**
   * Return the first free Business slug by appending -2, -3, ...
   * Not race-proof — the DB unique constraint + P2002 catch is the backstop.
   */
  async uniqueBusinessSlug(base: string): Promise<string> {
    let candidate = base;
    let n = 1;

    try {
      while (
        await prisma.business.findUnique({
          where: { slug: candidate },
          select: { id: true },
        })
      ) {
        n++;
        candidate = `${base}-${n}`;
      }
    } catch (err) {
      throw new DBException("Error checking business slug uniqueness", err as Error);
    }

    return candidate;
  }

  /**
   * Return the first free DiningTable slug for this business.
   * Unique per business (not globally).
   */
  async uniqueTableSlug(businessId: string, base: string): Promise<string> {
    let candidate = base;
    let n = 1;

    try {
      while (
        await prisma.diningTable.findUnique({
          where: { businessId_slug: { businessId, slug: candidate } },
          select: { id: true },
        })
      ) {
        n++;
        candidate = `${base}-${n}`;
      }
    } catch (err) {
      throw new DBException("Error checking table slug uniqueness", err as Error);
    }

    return candidate;
  }
}

export const slugService = SlugService.getInstance();