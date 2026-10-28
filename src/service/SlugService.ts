// src/service/SlugService.ts
//made  this so it can ensure uniqnes of slug
import { slugRepo } from "@/repository/SlugRepo";

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

    while (await slugRepo.businessSlugExists(candidate)) {
      n++;
      candidate = `${base}-${n}`;
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

    while (await slugRepo.tableSlugExists(businessId, candidate)) {
      n++;
      candidate = `${base}-${n}`;
    }

    return candidate;
  }
}

export const slugService = SlugService.getInstance();