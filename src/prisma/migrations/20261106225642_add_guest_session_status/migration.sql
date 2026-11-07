-- CreateEnum
CREATE TYPE "GuestSessionStatus" AS ENUM ('PENDING', 'ACTIVE', 'REJECTED');

-- AlterTable
ALTER TABLE "GuestSession" ADD COLUMN     "status" "GuestSessionStatus" NOT NULL DEFAULT 'PENDING';

-- CreateIndex
CREATE INDEX "GuestSession_status_idx" ON "GuestSession"("status");
