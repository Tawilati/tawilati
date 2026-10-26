-- Business names become unique, and businesses and tables get a fixed URL name (slug)
-- used in the customer menu link: /menu/{business.slug}/{table.slug}?t={qrToken}

-- DropIndex
DROP INDEX "Business_name_idx";

-- AlterTable: add as nullable, backfill existing rows, then require it
ALTER TABLE "Business" ADD COLUMN "slug" VARCHAR(60);
UPDATE "Business" SET "slug" = 'business-' || "id";
ALTER TABLE "Business" ALTER COLUMN "slug" SET NOT NULL;

ALTER TABLE "DiningTable" ADD COLUMN "slug" VARCHAR(60);
UPDATE "DiningTable" SET "slug" = 'table-' || "id";
ALTER TABLE "DiningTable" ALTER COLUMN "slug" SET NOT NULL;

-- CreateIndex
CREATE UNIQUE INDEX "Business_name_key" ON "Business"("name");

-- CreateIndex
CREATE UNIQUE INDEX "Business_slug_key" ON "Business"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "DiningTable_businessId_slug_key" ON "DiningTable"("businessId", "slug");
