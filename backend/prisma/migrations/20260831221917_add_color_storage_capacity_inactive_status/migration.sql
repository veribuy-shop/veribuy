-- AlterEnum
ALTER TYPE "listings"."ListingStatus" ADD VALUE 'INACTIVE';

-- AlterTable
ALTER TABLE "listings"."listings" ADD COLUMN     "color" TEXT,
ADD COLUMN     "storage_capacity" TEXT;
