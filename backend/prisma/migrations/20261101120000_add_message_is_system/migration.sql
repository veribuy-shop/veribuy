-- AlterTable
ALTER TABLE "messages" ADD COLUMN "is_system" BOOLEAN NOT NULL DEFAULT false;

-- Backfill: mark existing automated order and offer notifications.
UPDATE "messages" SET "is_system" = true
WHERE "subject" IN (
    'Payment secured in escrow',
    'New order — payment received',
    'Refund processed for your order',
    'Your order has been shipped',
    'Your order has been delivered',
    'Order completed — escrow released',
    'Order completed'
  )
  OR "subject" LIKE 'New offer: £%'
  OR "subject" LIKE 'Offer accepted: £%'
  OR "subject" LIKE 'Offer declined for %'
  OR "subject" LIKE '%Referral Bonus Earned%';
