-- A chargeback or refund after the seller was paid flags the payout for an admin,
-- who can take the money back from the seller's Stripe account.
ALTER TYPE "PayoutStatus" ADD VALUE 'REVERSED';

ALTER TABLE "payouts" ADD COLUMN "flagged_at" TIMESTAMP(3);
ALTER TABLE "payouts" ADD COLUMN "flagged_reason" TEXT;
ALTER TABLE "payouts" ADD COLUMN "stripe_reversal_id" TEXT;
ALTER TABLE "payouts" ADD COLUMN "reversed_at" TIMESTAMP(3);

CREATE UNIQUE INDEX "payouts_stripe_reversal_id_key" ON "payouts"("stripe_reversal_id");
CREATE INDEX "payouts_flagged_at_idx" ON "payouts"("flagged_at");
