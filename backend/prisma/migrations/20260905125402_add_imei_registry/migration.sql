-- AlterEnum
ALTER TYPE "listings"."IntegrityFlag" ADD VALUE 'DUPLICATE_IMEI';

-- AlterEnum
ALTER TYPE "trust_lens"."IntegrityFlag" ADD VALUE 'DUPLICATE_IMEI';

-- AlterTable
ALTER TABLE "transactions"."invoices" ADD COLUMN     "protection_fee" DECIMAL(10,2);

-- CreateTable
CREATE TABLE "trust_lens"."imei_registry" (
    "id" TEXT NOT NULL,
    "imei" TEXT NOT NULL,
    "brand" TEXT,
    "model" TEXT,
    "first_listing_id" TEXT NOT NULL,
    "first_seller_id" TEXT NOT NULL,
    "last_listing_id" TEXT NOT NULL,
    "last_seller_id" TEXT NOT NULL,
    "times_listed" INTEGER NOT NULL DEFAULT 1,
    "is_flagged" BOOLEAN NOT NULL DEFAULT false,
    "flag_reason" TEXT,
    "first_listed_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "last_listed_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "imei_registry_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "imei_registry_imei_key" ON "trust_lens"."imei_registry"("imei");

-- CreateIndex
CREATE INDEX "imei_registry_imei_idx" ON "trust_lens"."imei_registry"("imei");

-- CreateIndex
CREATE INDEX "imei_registry_is_flagged_idx" ON "trust_lens"."imei_registry"("is_flagged");

-- CreateIndex
CREATE INDEX "imei_registry_first_seller_id_idx" ON "trust_lens"."imei_registry"("first_seller_id");

-- CreateIndex
CREATE INDEX "imei_registry_last_seller_id_idx" ON "trust_lens"."imei_registry"("last_seller_id");
