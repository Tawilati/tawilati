import { prisma } from "@/lib/db";
import { DBException } from "@/utils/exceptions/RepoException";

export class SlugRepo {
  private static instance: SlugRepo;

  //Prevents other files from creating instances with `new`.
  private constructor() {}

  static getInstance(): SlugRepo {
    if (!SlugRepo.instance) {
      SlugRepo.instance = new SlugRepo();
    }
    return SlugRepo.instance;
  }

  async businessSlugExists(slug: string): Promise<boolean> {
    try {
      const business = await prisma.business.findUnique({
        where: { slug },
        select: { id: true },
      });
      return business !== null;
    } catch (err) {
      throw new DBException("Error checking business slug uniqueness", err as Error);
    }
  }

  async tableSlugExists(businessId: string, slug: string): Promise<boolean> {
    try {
      const table = await prisma.diningTable.findUnique({
        where: { businessId_slug: { businessId, slug } },
        select: { id: true },
      });
      return table !== null;
    } catch (err) {
      throw new DBException("Error checking table slug uniqueness", err as Error);
    }
  }
}

export const slugRepo = SlugRepo.getInstance();
