-- Postage the seller covers on a free-delivery order, taken off their payout.
ALTER TABLE "orders" ADD COLUMN "seller_shipping_fee" DECIMAL(10,2);
