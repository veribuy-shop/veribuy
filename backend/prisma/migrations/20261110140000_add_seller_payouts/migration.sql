-- Seller payouts through Stripe Connect: the seller's connected account, and one
-- traceable payout record per completed order.
ALTER TABLE "users" ADD COLUMN "stripe_account_id" TEXT;
ALTER TABLE "users" ADD COLUMN "stripe_payouts_enabled" BOOLEAN NOT NULL DEFAULT false;
CREATE UNIQUE INDEX "users_stripe_account_id_key" ON "users"("stripe_account_id");

CREATE TYPE "PayoutStatus" AS ENUM ('PENDING', 'AWAITING_SELLER', 'PAID', 'FAILED', 'ON_HOLD');

CREATE TABLE "payouts" (
    "id" TEXT NOT NULL,
    "order_id" TEXT NOT NULL,
    "seller_id" TEXT NOT NULL,
    "amount" DECIMAL(10,2) NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'GBP',
    "status" "PayoutStatus" NOT NULL DEFAULT 'PENDING',
    "stripe_transfer_id" TEXT,
    "stripe_account_id" TEXT,
    "failure_reason" TEXT,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "last_attempt_at" TIMESTAMP(3),
    "paid_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "payouts_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "payouts_amount_positive" CHECK ("amount" > 0)
);

CREATE UNIQUE INDEX "payouts_order_id_key" ON "payouts"("order_id");
CREATE UNIQUE INDEX "payouts_stripe_transfer_id_key" ON "payouts"("stripe_transfer_id");
CREATE INDEX "payouts_status_created_at_idx" ON "payouts"("status", "created_at");
CREATE INDEX "payouts_seller_id_created_at_idx" ON "payouts"("seller_id", "created_at" DESC);

ALTER TABLE "payouts" ADD CONSTRAINT "payouts_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "orders"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "payouts" ADD CONSTRAINT "payouts_seller_id_fkey" FOREIGN KEY ("seller_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Orders completed before payouts existed were never paid: queue them so they are
-- transferred once the seller sets up payouts.
INSERT INTO "payouts" ("id", "order_id", "seller_id", "amount", "currency", "status", "updated_at")
SELECT gen_random_uuid()::text, o."id", o."seller_id", o."amount" - COALESCE(o."seller_shipping_fee", 0), o."currency", 'AWAITING_SELLER', CURRENT_TIMESTAMP
FROM "orders" o
WHERE o."status" = 'COMPLETED' AND o."amount" - COALESCE(o."seller_shipping_fee", 0) > 0;
