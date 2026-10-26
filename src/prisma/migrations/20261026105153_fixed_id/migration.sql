/*
  Warnings:

  - The primary key for the `Business` table will be changed. If it partially fails, the table could be left without primary key constraint.
  - The primary key for the `DiningOrder` table will be changed. If it partially fails, the table could be left without primary key constraint.
  - The primary key for the `DiningTable` table will be changed. If it partially fails, the table could be left without primary key constraint.
  - The primary key for the `GuestSession` table will be changed. If it partially fails, the table could be left without primary key constraint.
  - The primary key for the `MenuCategory` table will be changed. If it partially fails, the table could be left without primary key constraint.
  - The primary key for the `MenuItem` table will be changed. If it partially fails, the table could be left without primary key constraint.
  - The primary key for the `OrderLine` table will be changed. If it partially fails, the table could be left without primary key constraint.
  - The primary key for the `Payment` table will be changed. If it partially fails, the table could be left without primary key constraint.
  - The primary key for the `Submission` table will be changed. If it partially fails, the table could be left without primary key constraint.
  - The primary key for the `TableSession` table will be changed. If it partially fails, the table could be left without primary key constraint.
  - The primary key for the `User` table will be changed. If it partially fails, the table could be left without primary key constraint.

*/
-- DropForeignKey
ALTER TABLE "DiningOrder" DROP CONSTRAINT "DiningOrder_businessId_fkey";

-- DropForeignKey
ALTER TABLE "DiningOrder" DROP CONSTRAINT "DiningOrder_guestSessionId_fkey";

-- DropForeignKey
ALTER TABLE "DiningOrder" DROP CONSTRAINT "DiningOrder_sessionId_fkey";

-- DropForeignKey
ALTER TABLE "DiningOrder" DROP CONSTRAINT "DiningOrder_tableId_fkey";

-- DropForeignKey
ALTER TABLE "DiningTable" DROP CONSTRAINT "DiningTable_businessId_fkey";

-- DropForeignKey
ALTER TABLE "GuestSession" DROP CONSTRAINT "GuestSession_sessionId_fkey";

-- DropForeignKey
ALTER TABLE "MenuCategory" DROP CONSTRAINT "MenuCategory_businessId_fkey";

-- DropForeignKey
ALTER TABLE "MenuItem" DROP CONSTRAINT "MenuItem_businessId_fkey";

-- DropForeignKey
ALTER TABLE "MenuItem" DROP CONSTRAINT "MenuItem_categoryId_fkey";

-- DropForeignKey
ALTER TABLE "OrderLine" DROP CONSTRAINT "OrderLine_menuItemId_fkey";

-- DropForeignKey
ALTER TABLE "OrderLine" DROP CONSTRAINT "OrderLine_orderId_fkey";

-- DropForeignKey
ALTER TABLE "Payment" DROP CONSTRAINT "Payment_recordedById_fkey";

-- DropForeignKey
ALTER TABLE "Payment" DROP CONSTRAINT "Payment_sessionId_fkey";

-- DropForeignKey
ALTER TABLE "Submission" DROP CONSTRAINT "Submission_businessId_fkey";

-- DropForeignKey
ALTER TABLE "Submission" DROP CONSTRAINT "Submission_orderId_fkey";

-- DropForeignKey
ALTER TABLE "TableSession" DROP CONSTRAINT "TableSession_businessId_fkey";

-- DropForeignKey
ALTER TABLE "TableSession" DROP CONSTRAINT "TableSession_tableId_fkey";

-- DropForeignKey
ALTER TABLE "User" DROP CONSTRAINT "User_businessId_fkey";

-- AlterTable
ALTER TABLE "Business" DROP CONSTRAINT "Business_pkey",
ALTER COLUMN "id" DROP DEFAULT,
ALTER COLUMN "id" SET DATA TYPE TEXT,
ADD CONSTRAINT "Business_pkey" PRIMARY KEY ("id");
DROP SEQUENCE "Business_id_seq";

-- AlterTable
ALTER TABLE "DiningOrder" DROP CONSTRAINT "DiningOrder_pkey",
ALTER COLUMN "id" DROP DEFAULT,
ALTER COLUMN "id" SET DATA TYPE TEXT,
ALTER COLUMN "businessId" SET DATA TYPE TEXT,
ALTER COLUMN "sessionId" SET DATA TYPE TEXT,
ALTER COLUMN "tableId" SET DATA TYPE TEXT,
ALTER COLUMN "guestSessionId" SET DATA TYPE TEXT,
ADD CONSTRAINT "DiningOrder_pkey" PRIMARY KEY ("id");
DROP SEQUENCE "DiningOrder_id_seq";

-- AlterTable
ALTER TABLE "DiningTable" DROP CONSTRAINT "DiningTable_pkey",
ALTER COLUMN "id" DROP DEFAULT,
ALTER COLUMN "id" SET DATA TYPE TEXT,
ALTER COLUMN "businessId" SET DATA TYPE TEXT,
ADD CONSTRAINT "DiningTable_pkey" PRIMARY KEY ("id");
DROP SEQUENCE "DiningTable_id_seq";

-- AlterTable
ALTER TABLE "GuestSession" DROP CONSTRAINT "GuestSession_pkey",
ALTER COLUMN "id" DROP DEFAULT,
ALTER COLUMN "id" SET DATA TYPE TEXT,
ALTER COLUMN "sessionId" SET DATA TYPE TEXT,
ADD CONSTRAINT "GuestSession_pkey" PRIMARY KEY ("id");
DROP SEQUENCE "GuestSession_id_seq";

-- AlterTable
ALTER TABLE "MenuCategory" DROP CONSTRAINT "MenuCategory_pkey",
ALTER COLUMN "id" DROP DEFAULT,
ALTER COLUMN "id" SET DATA TYPE TEXT,
ALTER COLUMN "businessId" SET DATA TYPE TEXT,
ADD CONSTRAINT "MenuCategory_pkey" PRIMARY KEY ("id");
DROP SEQUENCE "MenuCategory_id_seq";

-- AlterTable
ALTER TABLE "MenuItem" DROP CONSTRAINT "MenuItem_pkey",
ALTER COLUMN "id" DROP DEFAULT,
ALTER COLUMN "id" SET DATA TYPE TEXT,
ALTER COLUMN "businessId" SET DATA TYPE TEXT,
ALTER COLUMN "categoryId" SET DATA TYPE TEXT,
ADD CONSTRAINT "MenuItem_pkey" PRIMARY KEY ("id");
DROP SEQUENCE "MenuItem_id_seq";

-- AlterTable
ALTER TABLE "OrderLine" DROP CONSTRAINT "OrderLine_pkey",
ALTER COLUMN "id" DROP DEFAULT,
ALTER COLUMN "id" SET DATA TYPE TEXT,
ALTER COLUMN "orderId" SET DATA TYPE TEXT,
ALTER COLUMN "menuItemId" SET DATA TYPE TEXT,
ADD CONSTRAINT "OrderLine_pkey" PRIMARY KEY ("id");
DROP SEQUENCE "OrderLine_id_seq";

-- AlterTable
ALTER TABLE "Payment" DROP CONSTRAINT "Payment_pkey",
ALTER COLUMN "id" DROP DEFAULT,
ALTER COLUMN "id" SET DATA TYPE TEXT,
ALTER COLUMN "sessionId" SET DATA TYPE TEXT,
ALTER COLUMN "recordedById" SET DATA TYPE TEXT,
ADD CONSTRAINT "Payment_pkey" PRIMARY KEY ("id");
DROP SEQUENCE "Payment_id_seq";

-- AlterTable
ALTER TABLE "Submission" DROP CONSTRAINT "Submission_pkey",
ALTER COLUMN "id" DROP DEFAULT,
ALTER COLUMN "id" SET DATA TYPE TEXT,
ALTER COLUMN "businessId" SET DATA TYPE TEXT,
ALTER COLUMN "orderId" SET DATA TYPE TEXT,
ADD CONSTRAINT "Submission_pkey" PRIMARY KEY ("id");
DROP SEQUENCE "Submission_id_seq";

-- AlterTable
ALTER TABLE "TableSession" DROP CONSTRAINT "TableSession_pkey",
ALTER COLUMN "id" DROP DEFAULT,
ALTER COLUMN "id" SET DATA TYPE TEXT,
ALTER COLUMN "businessId" SET DATA TYPE TEXT,
ALTER COLUMN "tableId" SET DATA TYPE TEXT,
ALTER COLUMN "activeTableId" SET DATA TYPE TEXT,
ADD CONSTRAINT "TableSession_pkey" PRIMARY KEY ("id");
DROP SEQUENCE "TableSession_id_seq";

-- AlterTable
ALTER TABLE "User" DROP CONSTRAINT "User_pkey",
ALTER COLUMN "id" DROP DEFAULT,
ALTER COLUMN "id" SET DATA TYPE TEXT,
ALTER COLUMN "businessId" SET DATA TYPE TEXT,
ADD CONSTRAINT "User_pkey" PRIMARY KEY ("id");
DROP SEQUENCE "User_id_seq";

-- AddForeignKey
ALTER TABLE "User" ADD CONSTRAINT "User_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "Business"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MenuCategory" ADD CONSTRAINT "MenuCategory_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "Business"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MenuItem" ADD CONSTRAINT "MenuItem_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "Business"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MenuItem" ADD CONSTRAINT "MenuItem_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "MenuCategory"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DiningTable" ADD CONSTRAINT "DiningTable_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "Business"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TableSession" ADD CONSTRAINT "TableSession_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "Business"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TableSession" ADD CONSTRAINT "TableSession_tableId_fkey" FOREIGN KEY ("tableId") REFERENCES "DiningTable"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GuestSession" ADD CONSTRAINT "GuestSession_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "TableSession"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DiningOrder" ADD CONSTRAINT "DiningOrder_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "Business"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DiningOrder" ADD CONSTRAINT "DiningOrder_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "TableSession"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DiningOrder" ADD CONSTRAINT "DiningOrder_tableId_fkey" FOREIGN KEY ("tableId") REFERENCES "DiningTable"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DiningOrder" ADD CONSTRAINT "DiningOrder_guestSessionId_fkey" FOREIGN KEY ("guestSessionId") REFERENCES "GuestSession"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrderLine" ADD CONSTRAINT "OrderLine_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "DiningOrder"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrderLine" ADD CONSTRAINT "OrderLine_menuItemId_fkey" FOREIGN KEY ("menuItemId") REFERENCES "MenuItem"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Submission" ADD CONSTRAINT "Submission_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "Business"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Submission" ADD CONSTRAINT "Submission_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "DiningOrder"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Payment" ADD CONSTRAINT "Payment_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "TableSession"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Payment" ADD CONSTRAINT "Payment_recordedById_fkey" FOREIGN KEY ("recordedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
