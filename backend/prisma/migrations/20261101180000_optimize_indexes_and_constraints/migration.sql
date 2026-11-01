-- Index and integrity pass for read-heavy marketplace traffic.
-- * Drops indexes that are a left prefix of another index (or of a unique
--   constraint): they cost a write on every insert/update and serve no query.
-- * Adds composite indexes for the feed sorts, inbox threads, offer lists and
--   the background jobs, plus trigram indexes for listing search.
-- * Makes orders.payment_intent_id unique (one PaymentIntent per order).
-- * Adds CHECK constraints for money, counters and ratings.

CREATE EXTENSION IF NOT EXISTS pg_trgm;

DROP INDEX IF EXISTS "addresses_postal_code_idx";
DROP INDEX IF EXISTS "addresses_profile_id_idx";
DROP INDEX IF EXISTS "bids_listing_id_idx";
DROP INDEX IF EXISTS "evidence_checklists_fulfilled_idx";
DROP INDEX IF EXISTS "evidence_checklists_required_idx";
DROP INDEX IF EXISTS "evidence_checklists_verification_request_id_idx";
DROP INDEX IF EXISTS "evidence_items_pack_id_idx";
DROP INDEX IF EXISTS "identifier_validations_imei_idx";
DROP INDEX IF EXISTS "identifier_validations_serial_number_idx";
DROP INDEX IF EXISTS "imei_registry_imei_idx";
DROP INDEX IF EXISTS "invoices_buyer_id_idx";
DROP INDEX IF EXISTS "invoices_order_id_idx";
DROP INDEX IF EXISTS "invoices_status_idx";
DROP INDEX IF EXISTS "listings_auction_ends_at_idx";
DROP INDEX IF EXISTS "listings_device_type_idx";
DROP INDEX IF EXISTS "listings_seller_id_idx";
DROP INDEX IF EXISTS "listings_status_idx";
DROP INDEX IF EXISTS "messages_created_at_idx";
DROP INDEX IF EXISTS "messages_is_read_idx";
DROP INDEX IF EXISTS "messages_recipient_id_idx";
DROP INDEX IF EXISTS "messages_sender_id_idx";
DROP INDEX IF EXISTS "notification_logs_user_id_idx";
DROP INDEX IF EXISTS "offers_buyer_id_status_idx";
DROP INDEX IF EXISTS "offers_seller_id_status_idx";
DROP INDEX IF EXISTS "orders_buyer_id_idx";
DROP INDEX IF EXISTS "orders_payment_intent_id_idx";
DROP INDEX IF EXISTS "orders_seller_id_idx";
DROP INDEX IF EXISTS "orders_status_idx";
DROP INDEX IF EXISTS "profiles_user_id_idx";
DROP INDEX IF EXISTS "referrals_referred_id_idx";
DROP INDEX IF EXISTS "refresh_tokens_revoked_at_idx";
DROP INDEX IF EXISTS "refresh_tokens_user_id_idx";
DROP INDEX IF EXISTS "users_referral_code_idx";
DROP INDEX IF EXISTS "verification_requests_status_idx";

CREATE INDEX IF NOT EXISTS "listings_status_price_idx" ON "listings"("status", "price");
CREATE INDEX IF NOT EXISTS "listings_status_bid_count_idx" ON "listings"("status", "bid_count" DESC);
CREATE INDEX IF NOT EXISTS "listings_status_auction_ends_at_idx" ON "listings"("status", "auction_ends_at");
CREATE INDEX IF NOT EXISTS "listings_title_trgm_idx" ON "listings" USING GIN ("title" gin_trgm_ops);
CREATE INDEX IF NOT EXISTS "listings_brand_trgm_idx" ON "listings" USING GIN ("brand" gin_trgm_ops);
CREATE INDEX IF NOT EXISTS "listings_model_trgm_idx" ON "listings" USING GIN ("model" gin_trgm_ops);
CREATE INDEX IF NOT EXISTS "listings_description_trgm_idx" ON "listings" USING GIN ("description" gin_trgm_ops);
CREATE INDEX IF NOT EXISTS "messages_sender_id_recipient_id_created_at_idx" ON "messages"("sender_id", "recipient_id", "created_at");
CREATE INDEX IF NOT EXISTS "offers_buyer_id_created_at_idx" ON "offers"("buyer_id", "created_at" DESC);
CREATE INDEX IF NOT EXISTS "offers_seller_id_created_at_idx" ON "offers"("seller_id", "created_at" DESC);
CREATE INDEX IF NOT EXISTS "offers_status_expires_at_idx" ON "offers"("status", "expires_at");
CREATE UNIQUE INDEX IF NOT EXISTS "orders_payment_intent_id_key" ON "orders"("payment_intent_id");
CREATE INDEX IF NOT EXISTS "orders_status_created_at_idx" ON "orders"("status", "created_at");

-- CHECK constraints are added NOT VALID so existing rows never block a deploy;
-- new writes are enforced immediately, and each is then validated against
-- existing data when that data already complies.
DO $$
DECLARE
  c RECORD;
BEGIN
  FOR c IN
    SELECT * FROM (VALUES
      ('listings', 'listings_price_positive', 'price > 0'),
      ('listings', 'listings_quantity_non_negative', 'quantity >= 0'),
      ('listings', 'listings_counters_non_negative', 'bid_count >= 0 AND view_count >= 0'),
      ('listings', 'listings_auction_amounts_positive', '(starting_bid IS NULL OR starting_bid > 0) AND (reserve_price IS NULL OR reserve_price > 0) AND (current_bid IS NULL OR current_bid > 0) AND (buy_it_now_price IS NULL OR buy_it_now_price > 0)'),
      ('bids', 'bids_amount_positive', 'amount > 0 AND (max_bid IS NULL OR max_bid > 0)'),
      ('offers', 'offers_amount_positive', 'amount > 0'),
      ('offers', 'offers_buyer_ne_seller', 'buyer_id <> seller_id'),
      ('orders', 'orders_amounts_non_negative', 'amount >= 0 AND (protection_fee IS NULL OR protection_fee >= 0) AND (shipping_fee IS NULL OR shipping_fee >= 0) AND (total_amount IS NULL OR total_amount >= 0)'),
      ('escrow_records', 'escrow_records_amount_non_negative', 'amount >= 0'),
      ('refund_records', 'refund_records_amount_positive', 'amount > 0'),
      ('ratings', 'ratings_rating_range', 'rating BETWEEN 1 AND 5'),
      ('profiles', 'profiles_counters_non_negative', 'total_sales >= 0 AND total_purchases >= 0 AND referral_bonus_balance >= 0'),
      ('evidence_items', 'evidence_items_size_non_negative', 'size_bytes >= 0')
    ) AS t(tbl, name, expr)
  LOOP
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = c.name) THEN
      EXECUTE format('ALTER TABLE %I ADD CONSTRAINT %I CHECK (%s) NOT VALID', c.tbl, c.name, c.expr);
    END IF;
    BEGIN
      EXECUTE format('ALTER TABLE %I VALIDATE CONSTRAINT %I', c.tbl, c.name);
    EXCEPTION WHEN check_violation THEN
      RAISE NOTICE 'Existing rows violate %, left NOT VALID', c.name;
    END;
  END LOOP;
END $$;
