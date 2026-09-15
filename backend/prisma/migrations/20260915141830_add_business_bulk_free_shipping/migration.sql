-- CreateEnum
CREATE TYPE "users"."AccountType" AS ENUM ('INDIVIDUAL', 'BUSINESS');

-- AlterTable
ALTER TABLE "listings"."listings" ADD COLUMN     "free_shipping" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "is_bulk_listing" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "quantity" INTEGER NOT NULL DEFAULT 1;

-- AlterTable
ALTER TABLE "transactions"."orders" ADD COLUMN     "free_shipping" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "users"."profiles" ADD COLUMN     "account_type" "users"."AccountType" NOT NULL DEFAULT 'INDIVIDUAL',
ADD COLUMN     "company_name" TEXT,
ADD COLUMN     "company_number" TEXT,
ADD COLUMN     "vat_number" TEXT;

-- CreateIndex
CREATE INDEX "profiles_account_type_idx" ON "users"."profiles"("account_type");
