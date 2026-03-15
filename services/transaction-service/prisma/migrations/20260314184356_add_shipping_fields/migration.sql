-- AlterTable
ALTER TABLE "invoices" ADD COLUMN     "shipping_fee" DECIMAL(10,2),
ADD COLUMN     "total_amount" DECIMAL(10,2);

-- AlterTable
ALTER TABLE "orders" ADD COLUMN     "shipping_fee" DECIMAL(10,2),
ADD COLUMN     "shipping_service" TEXT,
ADD COLUMN     "total_amount" DECIMAL(10,2);

-- Backfill: set total_amount = amount for existing orders (no shipping fee)
UPDATE "orders" SET "total_amount" = "amount" WHERE "total_amount" IS NULL;
UPDATE "invoices" SET "total_amount" = "amount" WHERE "total_amount" IS NULL;
