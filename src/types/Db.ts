import type { Prisma } from "@/app/generated/prisma/client";
import type { prisma } from "@/lib/db";

// A repository method that can run inside a transaction takes either the transaction or the client.
export type DbClient = Prisma.TransactionClient | typeof prisma;
