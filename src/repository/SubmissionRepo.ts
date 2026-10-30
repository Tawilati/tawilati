import { Prisma, type Submission } from "@/app/generated/prisma/client";
import { prisma } from "@/lib/db";
import type { DbClient } from "@/types/Db";
import { DBException } from "@/utils/exceptions/RepoException";

export class SubmissionRepo {
  private static instance: SubmissionRepo;

  private constructor() {}

  static getInstance(): SubmissionRepo {
    if (!SubmissionRepo.instance) {
      SubmissionRepo.instance = new SubmissionRepo();
    }

    return SubmissionRepo.instance;
  }
  async FindByKey(
    businessId: string,
    idempotencyKey: string,
  ): Promise<Submission | null> {
    try {
      return await prisma.submission.findUnique({
        where: {
          businessId_idempotencyKey: {
            businessId,
            idempotencyKey,
          },
        },
      });
    } catch (error) {
      throw new DBException(
        "Error finding submission by idempotency key",
        error instanceof Error ? error : new Error(String(error)),
      );
    }
  }

  async create(
    data: {
      businessId: string;
      idempotencyKey: string;
      payloadHash: string;
    },
    tx: DbClient = prisma,
  ): Promise<Submission> {
    try {
      return await tx.submission.create({ data });
    } catch (error) {
      // A concurrent request with the same key: let handleRouteError answer 409
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === "P2002"
      ) {
        throw error;
      }
      throw new DBException(
        "Error creating submission",
        error instanceof Error ? error : new Error(String(error)),
      );
    }
  }

  async linkToOrder(
    submissionId: string,
    orderId: string,
    tx: DbClient = prisma,
  ): Promise<Submission> {
    try {
      return await tx.submission.update({
        where: { id: submissionId },
        data: { orderId },
      });
    } catch (error) {
      throw new DBException(
        "Error linking submission to order",
        error instanceof Error ? error : new Error(String(error)),
      );
    }
  }
}

export const submissionRepo = SubmissionRepo.getInstance();