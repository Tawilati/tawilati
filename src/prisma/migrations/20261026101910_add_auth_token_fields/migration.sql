-- AlterTable
ALTER TABLE "User" ADD COLUMN     "lastLogin" TIMESTAMP(3),
ADD COLUMN     "refreshToken" TEXT,
ADD COLUMN     "refreshTokenExpiresAt" TIMESTAMP(3),
ADD COLUMN     "resetPasswordExpiresAt" TIMESTAMP(3),
ADD COLUMN     "resetPasswordToken" TEXT;

-- CreateIndex
CREATE INDEX "User_refreshTokenExpiresAt_idx" ON "User"("refreshTokenExpiresAt");

-- CreateIndex
CREATE INDEX "User_resetPasswordExpiresAt_idx" ON "User"("resetPasswordExpiresAt");
