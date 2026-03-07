-- AlterTable
ALTER TABLE "escrow_records" ALTER COLUMN "currency" SET DEFAULT 'GBP';

-- AlterTable
ALTER TABLE "orders" ADD COLUMN     "payment_intent_id" TEXT,
ADD COLUMN     "tracking_number" TEXT,
ALTER COLUMN "currency" SET DEFAULT 'GBP';

-- CreateIndex
CREATE INDEX "orders_payment_intent_id_idx" ON "orders"("payment_intent_id");
