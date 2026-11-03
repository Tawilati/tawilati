-- A guest can ask for the bill from their phone; the waiter's table tile turns yellow, then orange after a while.
-- Cleared when the guest sends another round.

-- AlterTable
ALTER TABLE "TableSession" ADD COLUMN "billRequestedAt" TIMESTAMP(3);
