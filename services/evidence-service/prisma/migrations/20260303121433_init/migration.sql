-- CreateEnum
CREATE TYPE "EvidenceType" AS ENUM ('DEVICE_IMAGE', 'SCREEN_IMAGE', 'BODY_IMAGE', 'SETTINGS_SCREENSHOT', 'IMEI_SCREENSHOT', 'PACKAGING_IMAGE', 'ACCESSORIES_IMAGE', 'OTHER');

-- CreateTable
CREATE TABLE "evidence_packs" (
    "id" TEXT NOT NULL,
    "listing_id" TEXT NOT NULL,
    "seller_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "evidence_packs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "evidence_items" (
    "id" TEXT NOT NULL,
    "pack_id" TEXT NOT NULL,
    "type" "EvidenceType" NOT NULL,
    "url" TEXT NOT NULL,
    "filename" TEXT NOT NULL,
    "mime_type" TEXT NOT NULL,
    "size_bytes" INTEGER NOT NULL,
    "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "metadata" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "evidence_items_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "evidence_packs_listing_id_key" ON "evidence_packs"("listing_id");

-- AddForeignKey
ALTER TABLE "evidence_items" ADD CONSTRAINT "evidence_items_pack_id_fkey" FOREIGN KEY ("pack_id") REFERENCES "evidence_packs"("id") ON DELETE CASCADE ON UPDATE CASCADE;
