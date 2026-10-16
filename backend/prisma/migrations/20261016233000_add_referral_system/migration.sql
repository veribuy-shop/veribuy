-- ═══════════════════════════════════════════════════════════════════════════
-- VeriBuy Referral System Migration
-- Adds referral tracking, £5 qualification on first sale, and balance storage
-- ═══════════════════════════════════════════════════════════════════════════

-- 1. Create ReferralStatus enum if not exists
DO $$ BEGIN
  CREATE TYPE "ReferralStatus" AS ENUM ('PENDING', 'QUALIFIED', 'PAID');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- 2. Add columns to users
ALTER TABLE "users" 
  ADD COLUMN IF NOT EXISTS "referral_code" text,
  ADD COLUMN IF NOT EXISTS "referred_by_id" text;

CREATE UNIQUE INDEX IF NOT EXISTS "users_referral_code_key" ON "users"("referral_code");
CREATE INDEX IF NOT EXISTS "users_referral_code_idx" ON "users"("referral_code");
CREATE INDEX IF NOT EXISTS "users_referred_by_id_idx" ON "users"("referred_by_id");

DO $$ BEGIN
  ALTER TABLE "users" 
    ADD CONSTRAINT "users_referred_by_id_fkey" 
    FOREIGN KEY ("referred_by_id") REFERENCES "users"("id") ON UPDATE CASCADE ON DELETE SET NULL;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- 3. Add referral_bonus_balance to profiles
ALTER TABLE "profiles" 
  ADD COLUMN IF NOT EXISTS "referral_bonus_balance" numeric(10,2) NOT NULL DEFAULT 0.00;

-- 4. Create referrals table
CREATE TABLE IF NOT EXISTS "referrals" (
  "id" text NOT NULL,
  "referrer_id" text NOT NULL,
  "referred_id" text NOT NULL,
  "status" "ReferralStatus" NOT NULL DEFAULT 'PENDING',
  "reward_amount" numeric(10,2) NOT NULL DEFAULT 5.00,
  "currency" text NOT NULL DEFAULT 'GBP',
  "qualifying_order_id" text,
  "qualified_at" timestamp(3) without time zone,
  "paid_at" timestamp(3) without time zone,
  "created_at" timestamp(3) without time zone NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" timestamp(3) without time zone NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "referrals_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "referrals_referred_id_key" ON "referrals"("referred_id");
CREATE UNIQUE INDEX IF NOT EXISTS "referrals_qualifying_order_id_key" ON "referrals"("qualifying_order_id");
CREATE INDEX IF NOT EXISTS "referrals_referrer_id_idx" ON "referrals"("referrer_id");
CREATE INDEX IF NOT EXISTS "referrals_referred_id_idx" ON "referrals"("referred_id");
CREATE INDEX IF NOT EXISTS "referrals_status_idx" ON "referrals"("status");
CREATE INDEX IF NOT EXISTS "referrals_created_at_idx" ON "referrals"("created_at");

DO $$ BEGIN
  ALTER TABLE "referrals" 
    ADD CONSTRAINT "referrals_referrer_id_fkey" 
    FOREIGN KEY ("referrer_id") REFERENCES "users"("id") ON UPDATE CASCADE ON DELETE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  ALTER TABLE "referrals" 
    ADD CONSTRAINT "referrals_referred_id_fkey" 
    FOREIGN KEY ("referred_id") REFERENCES "users"("id") ON UPDATE CASCADE ON DELETE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  ALTER TABLE "referrals" 
    ADD CONSTRAINT "referrals_qualifying_order_id_fkey" 
    FOREIGN KEY ("qualifying_order_id") REFERENCES "orders"("id") ON UPDATE CASCADE ON DELETE SET NULL;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;
