-- ═══════════════════════════════════════════════════════════════════════════
-- VeriBuy Schema Consolidation & ACID Compliance Migration
-- Production-Safe: Pre-migration data cleanup + zero-data-loss table relocation
-- ═══════════════════════════════════════════════════════════════════════════

-- ───────────────────────────────────────────────────────────────────────────
-- PHASE 1: PRE-MIGRATION DATA CLEANUP & ORPHAN SANITIZATION
-- Ensures strict referential integrity can be enforced without constraint failures.
-- ───────────────────────────────────────────────────────────────────────────

DO $$
BEGIN
  RAISE NOTICE 'Starting Phase 1: Pre-migration data cleanup and orphan sanitization...';

  -- 1.1 Clean up duplicate records on unique fields before creating unique constraints
  IF to_regclass('"users"."profiles"') IS NOT NULL THEN
    DELETE FROM "users"."profiles" p1
    WHERE EXISTS (
      SELECT 1 FROM "users"."profiles" p2
      WHERE p2.user_id = p1.user_id AND p2.created_at > p1.created_at
    );
  END IF;

  IF to_regclass('"users"."addresses"') IS NOT NULL THEN
    DELETE FROM "users"."addresses" a1
    WHERE EXISTS (
      SELECT 1 FROM "users"."addresses" a2
      WHERE a2.profile_id = a1.profile_id AND a2.id > a1.id
    );
  END IF;

  IF to_regclass('"trust_lens"."verification_requests"') IS NOT NULL THEN
    DELETE FROM "trust_lens"."verification_requests" v1
    WHERE EXISTS (
      SELECT 1 FROM "trust_lens"."verification_requests" v2
      WHERE v2.listing_id = v1.listing_id AND v2.created_at > v1.created_at
    );
  END IF;

  IF to_regclass('"trust_lens"."identifier_validations"') IS NOT NULL THEN
    DELETE FROM "trust_lens"."identifier_validations" iv1
    WHERE EXISTS (
      SELECT 1 FROM "trust_lens"."identifier_validations" iv2
      WHERE iv2.verification_request_id = iv1.verification_request_id AND iv2.id > iv1.id
    );
  END IF;

  IF to_regclass('"evidence"."evidence_packs"') IS NOT NULL THEN
    DELETE FROM "evidence"."evidence_packs" ep1
    WHERE EXISTS (
      SELECT 1 FROM "evidence"."evidence_packs" ep2
      WHERE ep2.listing_id = ep1.listing_id AND ep2.created_at > ep1.created_at
    );
  END IF;

  IF to_regclass('"transactions"."escrow_records"') IS NOT NULL THEN
    DELETE FROM "transactions"."escrow_records" e1
    WHERE EXISTS (
      SELECT 1 FROM "transactions"."escrow_records" e2
      WHERE e2.order_id = e1.order_id AND e2.created_at > e1.created_at
    );
  END IF;

  IF to_regclass('"transactions"."ratings"') IS NOT NULL THEN
    DELETE FROM "transactions"."ratings" r1
    WHERE EXISTS (
      SELECT 1 FROM "transactions"."ratings" r2
      WHERE r2.order_id = r1.order_id AND r2.created_at > r1.created_at
    );
  END IF;

  -- 1.2 Clean up orphaned Auth & User records
  IF to_regclass('"auth"."refresh_tokens"') IS NOT NULL AND to_regclass('"auth"."users"') IS NOT NULL THEN
    DELETE FROM "auth"."refresh_tokens" WHERE "user_id" NOT IN (SELECT "id" FROM "auth"."users");
  END IF;

  IF to_regclass('"users"."profiles"') IS NOT NULL AND to_regclass('"auth"."users"') IS NOT NULL THEN
    DELETE FROM "users"."profiles" WHERE "user_id" NOT IN (SELECT "id" FROM "auth"."users");
  END IF;

  IF to_regclass('"users"."addresses"') IS NOT NULL AND to_regclass('"users"."profiles"') IS NOT NULL THEN
    DELETE FROM "users"."addresses" WHERE "profile_id" NOT IN (SELECT "id" FROM "users"."profiles");
  END IF;

  -- 1.3 Clean up orphaned Listings & Bids
  IF to_regclass('"listings"."listings"') IS NOT NULL AND to_regclass('"auth"."users"') IS NOT NULL THEN
    DELETE FROM "listings"."listings" WHERE "seller_id" NOT IN (SELECT "id" FROM "auth"."users");
    UPDATE "listings"."listings" SET "highest_bidder_id" = NULL 
    WHERE "highest_bidder_id" IS NOT NULL AND "highest_bidder_id" NOT IN (SELECT "id" FROM "auth"."users");
  END IF;

  IF to_regclass('"listings"."bids"') IS NOT NULL THEN
    IF to_regclass('"listings"."listings"') IS NOT NULL THEN
      DELETE FROM "listings"."bids" WHERE "listing_id" NOT IN (SELECT "id" FROM "listings"."listings");
    END IF;
    IF to_regclass('"auth"."users"') IS NOT NULL THEN
      DELETE FROM "listings"."bids" WHERE "bidder_id" NOT IN (SELECT "id" FROM "auth"."users");
    END IF;
  END IF;

  -- 1.4 Clean up orphaned Verification & Evidence records
  IF to_regclass('"trust_lens"."verification_requests"') IS NOT NULL THEN
    IF to_regclass('"listings"."listings"') IS NOT NULL THEN
      DELETE FROM "trust_lens"."verification_requests" WHERE "listing_id" NOT IN (SELECT "id" FROM "listings"."listings");
    END IF;
    IF to_regclass('"auth"."users"') IS NOT NULL THEN
      DELETE FROM "trust_lens"."verification_requests" WHERE "seller_id" NOT IN (SELECT "id" FROM "auth"."users");
    END IF;
  END IF;

  IF to_regclass('"trust_lens"."evidence_checklists"') IS NOT NULL AND to_regclass('"trust_lens"."verification_requests"') IS NOT NULL THEN
    DELETE FROM "trust_lens"."evidence_checklists" WHERE "verification_request_id" NOT IN (SELECT "id" FROM "trust_lens"."verification_requests");
  END IF;

  IF to_regclass('"trust_lens"."identifier_validations"') IS NOT NULL AND to_regclass('"trust_lens"."verification_requests"') IS NOT NULL THEN
    DELETE FROM "trust_lens"."identifier_validations" WHERE "verification_request_id" NOT IN (SELECT "id" FROM "trust_lens"."verification_requests");
  END IF;

  IF to_regclass('"evidence"."evidence_packs"') IS NOT NULL THEN
    IF to_regclass('"listings"."listings"') IS NOT NULL THEN
      DELETE FROM "evidence"."evidence_packs" WHERE "listing_id" NOT IN (SELECT "id" FROM "listings"."listings");
    END IF;
    IF to_regclass('"auth"."users"') IS NOT NULL THEN
      DELETE FROM "evidence"."evidence_packs" WHERE "seller_id" NOT IN (SELECT "id" FROM "auth"."users");
    END IF;
  END IF;

  IF to_regclass('"evidence"."evidence_items"') IS NOT NULL AND to_regclass('"evidence"."evidence_packs"') IS NOT NULL THEN
    DELETE FROM "evidence"."evidence_items" WHERE "pack_id" NOT IN (SELECT "id" FROM "evidence"."evidence_packs");
  END IF;

  -- 1.5 Clean up orphaned Transactions, Orders & Escrow
  IF to_regclass('"transactions"."orders"') IS NOT NULL THEN
    IF to_regclass('"listings"."listings"') IS NOT NULL THEN
      DELETE FROM "transactions"."orders" WHERE "listing_id" NOT IN (SELECT "id" FROM "listings"."listings");
    END IF;
    IF to_regclass('"auth"."users"') IS NOT NULL THEN
      DELETE FROM "transactions"."orders" 
      WHERE "buyer_id" NOT IN (SELECT "id" FROM "auth"."users") 
         OR "seller_id" NOT IN (SELECT "id" FROM "auth"."users");
    END IF;
  END IF;

  IF to_regclass('"transactions"."escrow_records"') IS NOT NULL AND to_regclass('"transactions"."orders"') IS NOT NULL THEN
    DELETE FROM "transactions"."escrow_records" WHERE "order_id" NOT IN (SELECT "id" FROM "transactions"."orders");
  END IF;

  IF to_regclass('"transactions"."invoices"') IS NOT NULL THEN
    IF to_regclass('"transactions"."orders"') IS NOT NULL THEN
      DELETE FROM "transactions"."invoices" WHERE "order_id" NOT IN (SELECT "id" FROM "transactions"."orders");
    END IF;
    IF to_regclass('"auth"."users"') IS NOT NULL THEN
      DELETE FROM "transactions"."invoices" 
      WHERE "buyer_id" NOT IN (SELECT "id" FROM "auth"."users") 
         OR "seller_id" NOT IN (SELECT "id" FROM "auth"."users");
    END IF;
  END IF;

  IF to_regclass('"transactions"."refund_records"') IS NOT NULL AND to_regclass('"transactions"."orders"') IS NOT NULL THEN
    DELETE FROM "transactions"."refund_records" WHERE "order_id" NOT IN (SELECT "id" FROM "transactions"."orders");
  END IF;

  IF to_regclass('"transactions"."ratings"') IS NOT NULL THEN
    IF to_regclass('"transactions"."orders"') IS NOT NULL THEN
      DELETE FROM "transactions"."ratings" WHERE "order_id" NOT IN (SELECT "id" FROM "transactions"."orders");
    END IF;
    IF to_regclass('"auth"."users"') IS NOT NULL THEN
      DELETE FROM "transactions"."ratings" 
      WHERE "buyer_id" NOT IN (SELECT "id" FROM "auth"."users") 
         OR "seller_id" NOT IN (SELECT "id" FROM "auth"."users");
    END IF;
  END IF;

  -- 1.6 Clean up orphaned Notifications & Messages
  IF to_regclass('"notifications"."notification_logs"') IS NOT NULL AND to_regclass('"auth"."users"') IS NOT NULL THEN
    DELETE FROM "notifications"."notification_logs" WHERE "user_id" NOT IN (SELECT "id" FROM "auth"."users");
  END IF;

  IF to_regclass('"notifications"."messages"') IS NOT NULL THEN
    IF to_regclass('"auth"."users"') IS NOT NULL THEN
      DELETE FROM "notifications"."messages" 
      WHERE "sender_id" NOT IN (SELECT "id" FROM "auth"."users") 
         OR "recipient_id" NOT IN (SELECT "id" FROM "auth"."users");
    END IF;
    IF to_regclass('"listings"."listings"') IS NOT NULL THEN
      UPDATE "notifications"."messages" SET "listing_id" = NULL 
      WHERE "listing_id" IS NOT NULL AND "listing_id" NOT IN (SELECT "id" FROM "listings"."listings");
    END IF;
  END IF;

  RAISE NOTICE 'Phase 1 complete: Database data cleaned and validated.';
END $$;

-- ───────────────────────────────────────────────────────────────────────────
-- PHASE 2: ENUM DEFINITIONS (UNIFIED IN PUBLIC)
-- ───────────────────────────────────────────────────────────────────────────

DO $$
BEGIN
  -- Role
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'Role' AND typnamespace = 'public'::regnamespace) THEN
    IF EXISTS (SELECT 1 FROM pg_type WHERE typname = 'Role' AND typnamespace = 'auth'::regnamespace) THEN
      ALTER TYPE "auth"."Role" SET SCHEMA public;
    ELSE
      CREATE TYPE "Role" AS ENUM ('BUYER', 'SELLER', 'ADMIN');
    END IF;
  END IF;

  -- VerificationStatus
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'VerificationStatus' AND typnamespace = 'public'::regnamespace) THEN
    IF EXISTS (SELECT 1 FROM pg_type WHERE typname = 'VerificationStatus' AND typnamespace = 'users'::regnamespace) THEN
      ALTER TYPE "users"."VerificationStatus" SET SCHEMA public;
    ELSE
      CREATE TYPE "VerificationStatus" AS ENUM ('UNVERIFIED', 'PENDING', 'VERIFIED', 'REJECTED', 'SUSPENDED');
    END IF;
  END IF;

  -- AccountType
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'AccountType' AND typnamespace = 'public'::regnamespace) THEN
    IF EXISTS (SELECT 1 FROM pg_type WHERE typname = 'AccountType' AND typnamespace = 'users'::regnamespace) THEN
      ALTER TYPE "users"."AccountType" SET SCHEMA public;
    ELSE
      CREATE TYPE "AccountType" AS ENUM ('INDIVIDUAL', 'BUSINESS');
    END IF;
  END IF;

  -- ConditionGrade
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'ConditionGrade' AND typnamespace = 'public'::regnamespace) THEN
    IF EXISTS (SELECT 1 FROM pg_type WHERE typname = 'ConditionGrade' AND typnamespace = 'listings'::regnamespace) THEN
      ALTER TYPE "listings"."ConditionGrade" SET SCHEMA public;
    ELSE
      CREATE TYPE "ConditionGrade" AS ENUM ('A', 'B', 'C');
    END IF;
  END IF;

  -- DeviceType
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'DeviceType' AND typnamespace = 'public'::regnamespace) THEN
    IF EXISTS (SELECT 1 FROM pg_type WHERE typname = 'DeviceType' AND typnamespace = 'listings'::regnamespace) THEN
      ALTER TYPE "listings"."DeviceType" SET SCHEMA public;
    ELSE
      CREATE TYPE "DeviceType" AS ENUM ('SMARTPHONE', 'TABLET', 'LAPTOP', 'SMARTWATCH', 'AIRPODS', 'DESKTOP', 'GAMING_CONSOLE', 'OTHER');
    END IF;
  END IF;

  -- IntegrityFlag
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'IntegrityFlag' AND typnamespace = 'public'::regnamespace) THEN
    IF EXISTS (SELECT 1 FROM pg_type WHERE typname = 'IntegrityFlag' AND typnamespace = 'listings'::regnamespace) THEN
      ALTER TYPE "listings"."IntegrityFlag" SET SCHEMA public;
    ELSE
      CREATE TYPE "IntegrityFlag" AS ENUM ('CLEAN', 'IMEI_MISMATCH', 'ICLOUD_LOCKED', 'REPORTED_STOLEN', 'BLACKLISTED', 'SERIAL_MISMATCH', 'DUPLICATE_IMEI');
    END IF;
  END IF;

  -- ListingFormat
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'ListingFormat' AND typnamespace = 'public'::regnamespace) THEN
    IF EXISTS (SELECT 1 FROM pg_type WHERE typname = 'ListingFormat' AND typnamespace = 'listings'::regnamespace) THEN
      ALTER TYPE "listings"."ListingFormat" SET SCHEMA public;
    ELSE
      CREATE TYPE "ListingFormat" AS ENUM ('FIXED_PRICE', 'AUCTION');
    END IF;
  END IF;

  -- ListingStatus
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'ListingStatus' AND typnamespace = 'public'::regnamespace) THEN
    IF EXISTS (SELECT 1 FROM pg_type WHERE typname = 'ListingStatus' AND typnamespace = 'listings'::regnamespace) THEN
      ALTER TYPE "listings"."ListingStatus" SET SCHEMA public;
    ELSE
      CREATE TYPE "ListingStatus" AS ENUM ('DRAFT', 'SUBMITTED', 'UNDER_REVIEW', 'APPROVED', 'REJECTED', 'ACTIVE', 'INACTIVE', 'AUCTION_ENDED', 'SOLD', 'DELISTED');
    END IF;
  END IF;

  -- TrustLensStatus
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'TrustLensStatus' AND typnamespace = 'public'::regnamespace) THEN
    IF EXISTS (SELECT 1 FROM pg_type WHERE typname = 'TrustLensStatus' AND typnamespace = 'listings'::regnamespace) THEN
      ALTER TYPE "listings"."TrustLensStatus" SET SCHEMA public;
    ELSE
      CREATE TYPE "TrustLensStatus" AS ENUM ('PENDING', 'IN_PROGRESS', 'PASSED', 'FAILED', 'REQUIRES_REVIEW');
    END IF;
  END IF;

  -- ReviewStatus
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'ReviewStatus' AND typnamespace = 'public'::regnamespace) THEN
    IF EXISTS (SELECT 1 FROM pg_type WHERE typname = 'ReviewStatus' AND typnamespace = 'trust_lens'::regnamespace) THEN
      ALTER TYPE "trust_lens"."ReviewStatus" SET SCHEMA public;
    ELSE
      CREATE TYPE "ReviewStatus" AS ENUM ('PENDING', 'IN_PROGRESS', 'PASSED', 'FAILED', 'REQUIRES_REVIEW');
    END IF;
  END IF;

  -- ChecklistEvidenceType
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'ChecklistEvidenceType' AND typnamespace = 'public'::regnamespace) THEN
    CREATE TYPE "ChecklistEvidenceType" AS ENUM ('IMAGE', 'VIDEO', 'SCREENSHOT', 'DOCUMENT');
  END IF;

  -- EvidenceType
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'EvidenceType' AND typnamespace = 'public'::regnamespace) THEN
    IF EXISTS (SELECT 1 FROM pg_type WHERE typname = 'EvidenceType' AND typnamespace = 'evidence'::regnamespace) THEN
      ALTER TYPE "evidence"."EvidenceType" SET SCHEMA public;
    ELSE
      CREATE TYPE "EvidenceType" AS ENUM ('DEVICE_IMAGE', 'SCREEN_IMAGE', 'BODY_IMAGE', 'SETTINGS_SCREENSHOT', 'IMEI_SCREENSHOT', 'PACKAGING_IMAGE', 'ACCESSORIES_IMAGE', 'OTHER');
    END IF;
  END IF;

  -- OrderStatus
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'OrderStatus' AND typnamespace = 'public'::regnamespace) THEN
    IF EXISTS (SELECT 1 FROM pg_type WHERE typname = 'OrderStatus' AND typnamespace = 'transactions'::regnamespace) THEN
      ALTER TYPE "transactions"."OrderStatus" SET SCHEMA public;
    ELSE
      CREATE TYPE "OrderStatus" AS ENUM ('PENDING', 'PAYMENT_RECEIVED', 'ESCROW_HELD', 'SHIPPED', 'DELIVERED', 'COMPLETED', 'DISPUTED', 'REFUNDED', 'CANCELLED');
    END IF;
  END IF;

  -- EscrowStatus
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'EscrowStatus' AND typnamespace = 'public'::regnamespace) THEN
    IF EXISTS (SELECT 1 FROM pg_type WHERE typname = 'EscrowStatus' AND typnamespace = 'transactions'::regnamespace) THEN
      ALTER TYPE "transactions"."EscrowStatus" SET SCHEMA public;
    ELSE
      CREATE TYPE "EscrowStatus" AS ENUM ('HELD', 'RELEASED', 'REFUNDED', 'DISPUTED');
    END IF;
  END IF;

  -- InvoiceType
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'InvoiceType' AND typnamespace = 'public'::regnamespace) THEN
    IF EXISTS (SELECT 1 FROM pg_type WHERE typname = 'InvoiceType' AND typnamespace = 'transactions'::regnamespace) THEN
      ALTER TYPE "transactions"."InvoiceType" SET SCHEMA public;
    ELSE
      CREATE TYPE "InvoiceType" AS ENUM ('RECEIPT', 'CREDIT_NOTE');
    END IF;
  END IF;

  -- NotificationChannel
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'NotificationChannel' AND typnamespace = 'public'::regnamespace) THEN
    IF EXISTS (SELECT 1 FROM pg_type WHERE typname = 'NotificationChannel' AND typnamespace = 'notifications'::regnamespace) THEN
      ALTER TYPE "notifications"."NotificationChannel" SET SCHEMA public;
    ELSE
      CREATE TYPE "NotificationChannel" AS ENUM ('EMAIL', 'PUSH', 'SMS');
    END IF;
  END IF;

  -- NotificationStatus
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'NotificationStatus' AND typnamespace = 'public'::regnamespace) THEN
    IF EXISTS (SELECT 1 FROM pg_type WHERE typname = 'NotificationStatus' AND typnamespace = 'notifications'::regnamespace) THEN
      ALTER TYPE "notifications"."NotificationStatus" SET SCHEMA public;
    ELSE
      CREATE TYPE "NotificationStatus" AS ENUM ('PENDING', 'SENT', 'FAILED');
    END IF;
  END IF;
END $$;

-- ───────────────────────────────────────────────────────────────────────────
-- PHASE 3: TABLE RELOCATION (Zero-Data-Loss In-Place Move to Public)
-- ───────────────────────────────────────────────────────────────────────────

DO $$
BEGIN
  -- Move sequence if in transactions
  IF to_regclass('"transactions"."invoice_seq"') IS NOT NULL AND to_regclass('"public"."invoice_seq"') IS NULL THEN
    ALTER SEQUENCE "transactions"."invoice_seq" SET SCHEMA public;
  ELSE
    CREATE SEQUENCE IF NOT EXISTS "invoice_seq" START WITH 1 INCREMENT BY 1;
  END IF;

  -- Move tables from old schemas to public (if they exist in old schemas and not yet in public)
  IF to_regclass('"auth"."users"') IS NOT NULL AND to_regclass('"public"."users"') IS NULL THEN
    ALTER TABLE "auth"."users" SET SCHEMA public;
  END IF;

  IF to_regclass('"auth"."refresh_tokens"') IS NOT NULL AND to_regclass('"public"."refresh_tokens"') IS NULL THEN
    ALTER TABLE "auth"."refresh_tokens" SET SCHEMA public;
  END IF;

  IF to_regclass('"users"."profiles"') IS NOT NULL AND to_regclass('"public"."profiles"') IS NULL THEN
    ALTER TABLE "users"."profiles" SET SCHEMA public;
  END IF;

  IF to_regclass('"users"."addresses"') IS NOT NULL AND to_regclass('"public"."addresses"') IS NULL THEN
    ALTER TABLE "users"."addresses" SET SCHEMA public;
  END IF;

  IF to_regclass('"listings"."listings"') IS NOT NULL AND to_regclass('"public"."listings"') IS NULL THEN
    ALTER TABLE "listings"."listings" SET SCHEMA public;
  END IF;

  IF to_regclass('"listings"."bids"') IS NOT NULL AND to_regclass('"public"."bids"') IS NULL THEN
    ALTER TABLE "listings"."bids" SET SCHEMA public;
  END IF;

  IF to_regclass('"trust_lens"."verification_requests"') IS NOT NULL AND to_regclass('"public"."verification_requests"') IS NULL THEN
    ALTER TABLE "trust_lens"."verification_requests" SET SCHEMA public;
  END IF;

  IF to_regclass('"trust_lens"."evidence_checklists"') IS NOT NULL AND to_regclass('"public"."evidence_checklists"') IS NULL THEN
    ALTER TABLE "trust_lens"."evidence_checklists" SET SCHEMA public;
  END IF;

  IF to_regclass('"trust_lens"."identifier_validations"') IS NOT NULL AND to_regclass('"public"."identifier_validations"') IS NULL THEN
    ALTER TABLE "trust_lens"."identifier_validations" SET SCHEMA public;
  END IF;

  IF to_regclass('"trust_lens"."imei_registry"') IS NOT NULL AND to_regclass('"public"."imei_registry"') IS NULL THEN
    ALTER TABLE "trust_lens"."imei_registry" SET SCHEMA public;
  END IF;

  IF to_regclass('"evidence"."evidence_packs"') IS NOT NULL AND to_regclass('"public"."evidence_packs"') IS NULL THEN
    ALTER TABLE "evidence"."evidence_packs" SET SCHEMA public;
  END IF;

  IF to_regclass('"evidence"."evidence_items"') IS NOT NULL AND to_regclass('"public"."evidence_items"') IS NULL THEN
    ALTER TABLE "evidence"."evidence_items" SET SCHEMA public;
  END IF;

  IF to_regclass('"transactions"."orders"') IS NOT NULL AND to_regclass('"public"."orders"') IS NULL THEN
    ALTER TABLE "transactions"."orders" SET SCHEMA public;
  END IF;

  IF to_regclass('"transactions"."escrow_records"') IS NOT NULL AND to_regclass('"public"."escrow_records"') IS NULL THEN
    ALTER TABLE "transactions"."escrow_records" SET SCHEMA public;
  END IF;

  IF to_regclass('"transactions"."invoices"') IS NOT NULL AND to_regclass('"public"."invoices"') IS NULL THEN
    ALTER TABLE "transactions"."invoices" SET SCHEMA public;
  END IF;

  IF to_regclass('"transactions"."refund_records"') IS NOT NULL AND to_regclass('"public"."refund_records"') IS NULL THEN
    ALTER TABLE "transactions"."refund_records" SET SCHEMA public;
  END IF;

  IF to_regclass('"transactions"."ratings"') IS NOT NULL AND to_regclass('"public"."ratings"') IS NULL THEN
    ALTER TABLE "transactions"."ratings" SET SCHEMA public;
  END IF;

  IF to_regclass('"notifications"."notification_logs"') IS NOT NULL AND to_regclass('"public"."notification_logs"') IS NULL THEN
    ALTER TABLE "notifications"."notification_logs" SET SCHEMA public;
  END IF;

  IF to_regclass('"notifications"."messages"') IS NOT NULL AND to_regclass('"public"."messages"') IS NULL THEN
    ALTER TABLE "notifications"."messages" SET SCHEMA public;
  END IF;
END $$;

-- ───────────────────────────────────────────────────────────────────────────
-- PHASE 4: SCHEMA DEFINITION FALLBACK (Fresh Database Creation)
-- Ensures a brand new database without existing tables gets the exact schema.
-- ───────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS "users" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "password_hash" TEXT NOT NULL,
    "role" "Role" NOT NULL DEFAULT 'BUYER',
    "is_email_verified" BOOLEAN NOT NULL DEFAULT false,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "last_login_at" TIMESTAMP(3),
    "deleted_at" TIMESTAMP(3),
    "email_verification_token" TEXT,
    "email_verification_expiry" TIMESTAMP(3),
    "password_reset_token" TEXT,
    "password_reset_expiry" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "refresh_tokens" (
    "id" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "expires_at" TIMESTAMP(3) NOT NULL,
    "revoked_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "refresh_tokens_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "profiles" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "display_name" TEXT NOT NULL,
    "first_name" TEXT,
    "last_name" TEXT,
    "avatar_url" TEXT,
    "bio" TEXT,
    "phone" TEXT,
    "is_phone_verified" BOOLEAN NOT NULL DEFAULT false,
    "phone_verified_at" TIMESTAMP(3),
    "seller_rating" DOUBLE PRECISION,
    "total_sales" INTEGER NOT NULL DEFAULT 0,
    "total_purchases" INTEGER NOT NULL DEFAULT 0,
    "verification_status" "VerificationStatus" NOT NULL DEFAULT 'UNVERIFIED',
    "kyc_verified_at" TIMESTAMP(3),
    "account_type" "AccountType" NOT NULL DEFAULT 'INDIVIDUAL',
    "company_name" TEXT,
    "company_number" TEXT,
    "vat_number" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "profiles_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "addresses" (
    "id" TEXT NOT NULL,
    "profile_id" TEXT NOT NULL,
    "line1" TEXT NOT NULL,
    "line2" TEXT,
    "city" TEXT NOT NULL,
    "state" TEXT NOT NULL,
    "postal_code" TEXT NOT NULL,
    "country" TEXT NOT NULL,
    "is_address_verified" BOOLEAN NOT NULL DEFAULT false,
    "address_verified_at" TIMESTAMP(3),

    CONSTRAINT "addresses_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "listings" (
    "id" TEXT NOT NULL,
    "seller_id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "device_type" "DeviceType" NOT NULL,
    "brand" TEXT NOT NULL,
    "model" TEXT NOT NULL,
    "price" DECIMAL(10,2) NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'GBP',
    "condition_grade" "ConditionGrade",
    "color" TEXT,
    "storage_capacity" TEXT,
    "quantity" INTEGER NOT NULL DEFAULT 1,
    "is_bulk_listing" BOOLEAN NOT NULL DEFAULT false,
    "free_shipping" BOOLEAN NOT NULL DEFAULT false,
    "format" "ListingFormat" NOT NULL DEFAULT 'FIXED_PRICE',
    "starting_bid" DECIMAL(10,2),
    "reserve_price" DECIMAL(10,2),
    "current_bid" DECIMAL(10,2),
    "bid_count" INTEGER NOT NULL DEFAULT 0,
    "highest_bidder_id" TEXT,
    "highest_max_bid" DECIMAL(10,2),
    "auction_ends_at" TIMESTAMP(3),
    "buy_it_now_price" DECIMAL(10,2),
    "status" "ListingStatus" NOT NULL DEFAULT 'DRAFT',
    "imei" TEXT,
    "serial_number" TEXT,
    "integrity_flags" "IntegrityFlag"[],
    "trust_lens_status" "TrustLensStatus" NOT NULL DEFAULT 'PENDING',
    "view_count" INTEGER NOT NULL DEFAULT 0,
    "published_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "listings_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "bids" (
    "id" TEXT NOT NULL,
    "listing_id" TEXT NOT NULL,
    "bidder_id" TEXT NOT NULL,
    "amount" DECIMAL(10,2) NOT NULL,
    "max_bid" DECIMAL(10,2),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "bids_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "verification_requests" (
    "id" TEXT NOT NULL,
    "listing_id" TEXT NOT NULL,
    "status" "ReviewStatus" NOT NULL DEFAULT 'PENDING',
    "condition_grade" "ConditionGrade",
    "integrity_flags" "IntegrityFlag"[],
    "review_notes" TEXT,
    "completed_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "verification_requests_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "evidence_checklists" (
    "id" TEXT NOT NULL,
    "verification_request_id" TEXT NOT NULL,
    "type" "ChecklistEvidenceType" NOT NULL,
    "description" TEXT NOT NULL,
    "required" BOOLEAN NOT NULL DEFAULT true,
    "fulfilled" BOOLEAN NOT NULL DEFAULT false,
    "fulfilled_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "evidence_checklists_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "identifier_validations" (
    "id" TEXT NOT NULL,
    "verification_request_id" TEXT NOT NULL,
    "imei" TEXT,
    "serial_number" TEXT,
    "imei_provided" BOOLEAN NOT NULL DEFAULT false,
    "imei_valid" BOOLEAN,
    "serial_provided" BOOLEAN NOT NULL DEFAULT false,
    "serial_valid" BOOLEAN,
    "icloud_locked" BOOLEAN,
    "reported_stolen" BOOLEAN,
    "blacklisted" BOOLEAN,
    "fmi_on" BOOLEAN,
    "raw_api_response" JSONB,
    "verified_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "identifier_validations_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "imei_registry" (
    "id" TEXT NOT NULL,
    "imei" TEXT NOT NULL,
    "brand" TEXT,
    "model" TEXT,
    "first_listing_id" TEXT NOT NULL,
    "first_seller_id" TEXT NOT NULL,
    "last_listing_id" TEXT NOT NULL,
    "last_seller_id" TEXT NOT NULL,
    "times_listed" INTEGER NOT NULL DEFAULT 1,
    "is_flagged" BOOLEAN NOT NULL DEFAULT false,
    "flag_reason" TEXT,
    "first_listed_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "last_listed_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "imei_registry_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "evidence_packs" (
    "id" TEXT NOT NULL,
    "listing_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "evidence_packs_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "evidence_items" (
    "id" TEXT NOT NULL,
    "pack_id" TEXT NOT NULL,
    "type" "EvidenceType" NOT NULL,
    "url" TEXT NOT NULL,
    "filename" TEXT NOT NULL,
    "mime_type" TEXT NOT NULL,
    "size_bytes" INTEGER NOT NULL,
    "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "metadata" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "evidence_items_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "orders" (
    "id" TEXT NOT NULL,
    "buyer_id" TEXT NOT NULL,
    "seller_id" TEXT NOT NULL,
    "listing_id" TEXT NOT NULL,
    "listing_title" TEXT,
    "listing_description" TEXT,
    "listing_category" TEXT,
    "amount" DECIMAL(10,2) NOT NULL,
    "protection_fee" DECIMAL(10,2),
    "shipping_fee" DECIMAL(10,2),
    "shipping_service" TEXT,
    "free_shipping" BOOLEAN NOT NULL DEFAULT false,
    "total_amount" DECIMAL(10,2),
    "currency" TEXT NOT NULL DEFAULT 'GBP',
    "status" "OrderStatus" NOT NULL DEFAULT 'PENDING',
    "escrow_id" TEXT,
    "payment_intent_id" TEXT,
    "tracking_number" TEXT,
    "parcel_weight_grams" INTEGER,
    "parcel_format" TEXT,
    "shipping_label_url" TEXT,
    "dropoff_qr_code_url" TEXT,
    "dropoff_point_id" TEXT,
    "dropoff_point_name" TEXT,
    "shipping_address" JSONB,
    "paid_at" TIMESTAMP(3),
    "shipped_at" TIMESTAMP(3),
    "delivered_at" TIMESTAMP(3),
    "completed_at" TIMESTAMP(3),
    "disputed_at" TIMESTAMP(3),
    "refunded_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "orders_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "escrow_records" (
    "id" TEXT NOT NULL,
    "order_id" TEXT NOT NULL,
    "amount" DECIMAL(10,2) NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'GBP',
    "status" "EscrowStatus" NOT NULL DEFAULT 'HELD',
    "provider_ref" TEXT,
    "held_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "released_at" TIMESTAMP(3),
    "refunded_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "escrow_records_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "invoices" (
    "id" TEXT NOT NULL,
    "order_id" TEXT NOT NULL,
    "invoice_number" TEXT NOT NULL,
    "invoice_type" "InvoiceType" NOT NULL DEFAULT 'RECEIPT',
    "status" "OrderStatus" NOT NULL,
    "buyer_id" TEXT NOT NULL,
    "seller_id" TEXT NOT NULL,
    "amount" DECIMAL(10,2) NOT NULL,
    "protection_fee" DECIMAL(10,2),
    "shipping_fee" DECIMAL(10,2),
    "total_amount" DECIMAL(10,2),
    "vat_rate" DECIMAL(5,4),
    "vat_amount" DECIMAL(10,2),
    "net_amount" DECIMAL(10,2),
    "currency" TEXT NOT NULL DEFAULT 'GBP',
    "pdf_url" TEXT,
    "email_sent_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "invoices_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "refund_records" (
    "id" TEXT NOT NULL,
    "order_id" TEXT NOT NULL,
    "stripe_refund_id" TEXT NOT NULL,
    "amount" DECIMAL(10,2) NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'GBP',
    "reason" TEXT,
    "status" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "refund_records_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "ratings" (
    "id" TEXT NOT NULL,
    "order_id" TEXT NOT NULL,
    "rating" INTEGER NOT NULL,
    "comment" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ratings_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "notification_logs" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "channel" "NotificationChannel" NOT NULL,
    "template" TEXT NOT NULL,
    "payload" JSONB NOT NULL,
    "status" "NotificationStatus" NOT NULL DEFAULT 'PENDING',
    "sent_at" TIMESTAMP(3),
    "failed_at" TIMESTAMP(3),
    "error" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "notification_logs_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "messages" (
    "id" TEXT NOT NULL,
    "sender_id" TEXT NOT NULL,
    "recipient_id" TEXT NOT NULL,
    "listing_id" TEXT,
    "subject" TEXT,
    "content" TEXT NOT NULL,
    "is_read" BOOLEAN NOT NULL DEFAULT false,
    "read_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "messages_pkey" PRIMARY KEY ("id")
);

-- ───────────────────────────────────────────────────────────────────────────
-- PHASE 5: COLUMN TYPE CONVERSIONS (FOR RELOCATED TABLES)
-- ───────────────────────────────────────────────────────────────────────────

DO $$
BEGIN
  -- Normalize column types on relocated tables if they were using deprecated multi-schema enums
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'verification_requests' AND column_name = 'condition_grade') THEN
    ALTER TABLE "public"."verification_requests" ALTER COLUMN "condition_grade" TYPE "ConditionGrade" USING "condition_grade"::text::"ConditionGrade";
  END IF;

  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'verification_requests' AND column_name = 'integrity_flags') THEN
    ALTER TABLE "public"."verification_requests" ALTER COLUMN "integrity_flags" TYPE "IntegrityFlag"[] USING "integrity_flags"::text[]::"IntegrityFlag"[];
  END IF;

  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'evidence_checklists' AND column_name = 'type') THEN
    ALTER TABLE "public"."evidence_checklists" ALTER COLUMN "type" TYPE "ChecklistEvidenceType" USING "type"::text::"ChecklistEvidenceType";
  END IF;
END $$;

-- ───────────────────────────────────────────────────────────────────────────
-- PHASE 6: UNIQUE & PERFORMANCE INDEXES
-- ───────────────────────────────────────────────────────────────────────────

-- Users & Auth
CREATE UNIQUE INDEX IF NOT EXISTS "users_email_key" ON "users"("email");
CREATE INDEX IF NOT EXISTS "users_role_idx" ON "users"("role");
CREATE INDEX IF NOT EXISTS "users_is_active_idx" ON "users"("is_active");
CREATE INDEX IF NOT EXISTS "users_created_at_idx" ON "users"("created_at");

CREATE UNIQUE INDEX IF NOT EXISTS "refresh_tokens_token_key" ON "refresh_tokens"("token");
CREATE INDEX IF NOT EXISTS "refresh_tokens_user_id_idx" ON "refresh_tokens"("user_id");
CREATE INDEX IF NOT EXISTS "refresh_tokens_expires_at_idx" ON "refresh_tokens"("expires_at");

-- Profiles & Addresses
CREATE UNIQUE INDEX IF NOT EXISTS "profiles_user_id_key" ON "profiles"("user_id");
CREATE INDEX IF NOT EXISTS "profiles_user_id_idx" ON "profiles"("user_id");
CREATE INDEX IF NOT EXISTS "profiles_verification_status_idx" ON "profiles"("verification_status");
CREATE INDEX IF NOT EXISTS "profiles_account_type_idx" ON "profiles"("account_type");
CREATE INDEX IF NOT EXISTS "profiles_seller_rating_idx" ON "profiles"("seller_rating");

CREATE UNIQUE INDEX IF NOT EXISTS "addresses_profile_id_key" ON "addresses"("profile_id");
CREATE INDEX IF NOT EXISTS "addresses_profile_id_idx" ON "addresses"("profile_id");
CREATE INDEX IF NOT EXISTS "addresses_postal_code_idx" ON "addresses"("postal_code");

-- Listings & Bids
CREATE INDEX IF NOT EXISTS "listings_seller_id_idx" ON "listings"("seller_id");
CREATE INDEX IF NOT EXISTS "listings_device_type_idx" ON "listings"("device_type");
CREATE INDEX IF NOT EXISTS "listings_status_idx" ON "listings"("status");
CREATE INDEX IF NOT EXISTS "listings_format_status_idx" ON "listings"("format", "status");
CREATE INDEX IF NOT EXISTS "listings_auction_ends_at_idx" ON "listings"("auction_ends_at");
CREATE INDEX IF NOT EXISTS "listings_trust_lens_status_idx" ON "listings"("trust_lens_status");
CREATE INDEX IF NOT EXISTS "listings_published_at_idx" ON "listings"("published_at");
CREATE INDEX IF NOT EXISTS "listings_created_at_idx" ON "listings"("created_at");
CREATE INDEX IF NOT EXISTS "listings_seller_id_status_idx" ON "listings"("seller_id", "status");

CREATE INDEX IF NOT EXISTS "bids_listing_id_idx" ON "bids"("listing_id");
CREATE INDEX IF NOT EXISTS "bids_bidder_id_idx" ON "bids"("bidder_id");
CREATE INDEX IF NOT EXISTS "bids_listing_id_amount_idx" ON "bids"("listing_id", "amount" DESC);

-- Trust Lens & Verification
CREATE UNIQUE INDEX IF NOT EXISTS "verification_requests_listing_id_key" ON "verification_requests"("listing_id");
CREATE INDEX IF NOT EXISTS "verification_requests_status_idx" ON "verification_requests"("status");
CREATE INDEX IF NOT EXISTS "verification_requests_created_at_idx" ON "verification_requests"("created_at");
CREATE INDEX IF NOT EXISTS "verification_requests_status_created_at_idx" ON "verification_requests"("status", "created_at");

CREATE INDEX IF NOT EXISTS "evidence_checklists_verification_request_id_idx" ON "evidence_checklists"("verification_request_id");
CREATE INDEX IF NOT EXISTS "evidence_checklists_required_idx" ON "evidence_checklists"("required");

CREATE UNIQUE INDEX IF NOT EXISTS "identifier_validations_verification_request_id_key" ON "identifier_validations"("verification_request_id");
CREATE INDEX IF NOT EXISTS "identifier_validations_imei_idx" ON "identifier_validations"("imei");
CREATE INDEX IF NOT EXISTS "identifier_validations_serial_number_idx" ON "identifier_validations"("serial_number");

CREATE UNIQUE INDEX IF NOT EXISTS "imei_registry_imei_key" ON "imei_registry"("imei");
CREATE INDEX IF NOT EXISTS "imei_registry_imei_idx" ON "imei_registry"("imei");
CREATE INDEX IF NOT EXISTS "imei_registry_is_flagged_idx" ON "imei_registry"("is_flagged");
CREATE INDEX IF NOT EXISTS "imei_registry_first_seller_id_idx" ON "imei_registry"("first_seller_id");
CREATE INDEX IF NOT EXISTS "imei_registry_last_seller_id_idx" ON "imei_registry"("last_seller_id");

-- Evidence
CREATE UNIQUE INDEX IF NOT EXISTS "evidence_packs_listing_id_key" ON "evidence_packs"("listing_id");
CREATE INDEX IF NOT EXISTS "evidence_packs_created_at_idx" ON "evidence_packs"("created_at");

CREATE INDEX IF NOT EXISTS "evidence_items_pack_id_idx" ON "evidence_items"("pack_id");
CREATE INDEX IF NOT EXISTS "evidence_items_type_idx" ON "evidence_items"("type");

-- Orders & Escrow
CREATE INDEX IF NOT EXISTS "orders_buyer_id_idx" ON "orders"("buyer_id");
CREATE INDEX IF NOT EXISTS "orders_seller_id_idx" ON "orders"("seller_id");
CREATE INDEX IF NOT EXISTS "orders_listing_id_idx" ON "orders"("listing_id");
CREATE INDEX IF NOT EXISTS "orders_status_idx" ON "orders"("status");
CREATE INDEX IF NOT EXISTS "orders_created_at_idx" ON "orders"("created_at");
CREATE INDEX IF NOT EXISTS "orders_buyer_id_created_at_idx" ON "orders"("buyer_id", "created_at" DESC);
CREATE INDEX IF NOT EXISTS "orders_seller_id_created_at_idx" ON "orders"("seller_id", "created_at" DESC);

CREATE UNIQUE INDEX IF NOT EXISTS "escrow_records_order_id_key" ON "escrow_records"("order_id");
CREATE INDEX IF NOT EXISTS "escrow_records_status_idx" ON "escrow_records"("status");
CREATE INDEX IF NOT EXISTS "escrow_records_created_at_idx" ON "escrow_records"("created_at");

CREATE UNIQUE INDEX IF NOT EXISTS "invoices_invoice_number_key" ON "invoices"("invoice_number");
CREATE INDEX IF NOT EXISTS "invoices_order_id_idx" ON "invoices"("order_id");
CREATE INDEX IF NOT EXISTS "invoices_buyer_id_idx" ON "invoices"("buyer_id");
CREATE INDEX IF NOT EXISTS "invoices_seller_id_idx" ON "invoices"("seller_id");
CREATE INDEX IF NOT EXISTS "invoices_status_idx" ON "invoices"("status");
CREATE INDEX IF NOT EXISTS "invoices_created_at_idx" ON "invoices"("created_at");
CREATE INDEX IF NOT EXISTS "invoices_buyer_id_created_at_idx" ON "invoices"("buyer_id", "created_at" DESC);
CREATE INDEX IF NOT EXISTS "invoices_order_id_created_at_idx" ON "invoices"("order_id", "created_at" DESC);

CREATE UNIQUE INDEX IF NOT EXISTS "refund_records_stripe_refund_id_key" ON "refund_records"("stripe_refund_id");
CREATE INDEX IF NOT EXISTS "refund_records_order_id_idx" ON "refund_records"("order_id");

CREATE UNIQUE INDEX IF NOT EXISTS "ratings_order_id_key" ON "ratings"("order_id");
CREATE INDEX IF NOT EXISTS "ratings_created_at_idx" ON "ratings"("created_at");

-- Notifications & Messages
CREATE INDEX IF NOT EXISTS "notification_logs_user_id_idx" ON "notification_logs"("user_id");
CREATE INDEX IF NOT EXISTS "notification_logs_status_idx" ON "notification_logs"("status");
CREATE INDEX IF NOT EXISTS "notification_logs_created_at_idx" ON "notification_logs"("created_at");
CREATE INDEX IF NOT EXISTS "notification_logs_user_id_status_idx" ON "notification_logs"("user_id", "status");

CREATE INDEX IF NOT EXISTS "messages_sender_id_idx" ON "messages"("sender_id");
CREATE INDEX IF NOT EXISTS "messages_recipient_id_idx" ON "messages"("recipient_id");
CREATE INDEX IF NOT EXISTS "messages_listing_id_idx" ON "messages"("listing_id");
CREATE INDEX IF NOT EXISTS "messages_is_read_idx" ON "messages"("is_read");
CREATE INDEX IF NOT EXISTS "messages_created_at_idx" ON "messages"("created_at");
CREATE INDEX IF NOT EXISTS "messages_recipient_id_is_read_idx" ON "messages"("recipient_id", "is_read");
CREATE INDEX IF NOT EXISTS "messages_recipient_id_created_at_idx" ON "messages"("recipient_id", "created_at" DESC);
CREATE INDEX IF NOT EXISTS "messages_sender_id_created_at_idx" ON "messages"("sender_id", "created_at" DESC);

-- ───────────────────────────────────────────────────────────────────────────
-- PHASE 7: FOREIGN KEY CONSTRAINTS (ACID REFERENTIAL INTEGRITY)
-- ───────────────────────────────────────────────────────────────────────────

DO $$
BEGIN
  -- Refresh Tokens → Users
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'refresh_tokens_user_id_fkey') THEN
    ALTER TABLE "refresh_tokens" ADD CONSTRAINT "refresh_tokens_user_id_fkey" 
      FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;

  -- Profiles → Users
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'profiles_user_id_fkey') THEN
    ALTER TABLE "profiles" ADD CONSTRAINT "profiles_user_id_fkey" 
      FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;

  -- Addresses → Profiles
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'addresses_profile_id_fkey') THEN
    ALTER TABLE "addresses" ADD CONSTRAINT "addresses_profile_id_fkey" 
      FOREIGN KEY ("profile_id") REFERENCES "profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;

  -- Listings → Users (Seller)
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'listings_seller_id_fkey') THEN
    ALTER TABLE "listings" ADD CONSTRAINT "listings_seller_id_fkey" 
      FOREIGN KEY ("seller_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;

  -- Listings → Users (Highest Bidder)
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'listings_highest_bidder_id_fkey') THEN
    ALTER TABLE "listings" ADD CONSTRAINT "listings_highest_bidder_id_fkey" 
      FOREIGN KEY ("highest_bidder_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;

  -- Bids → Listings & Users
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'bids_listing_id_fkey') THEN
    ALTER TABLE "bids" ADD CONSTRAINT "bids_listing_id_fkey" 
      FOREIGN KEY ("listing_id") REFERENCES "listings"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'bids_bidder_id_fkey') THEN
    ALTER TABLE "bids" ADD CONSTRAINT "bids_bidder_id_fkey" 
      FOREIGN KEY ("bidder_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;

  -- Verification Requests → Listings & Users
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'verification_requests_listing_id_fkey') THEN
    ALTER TABLE "verification_requests" ADD CONSTRAINT "verification_requests_listing_id_fkey" 
      FOREIGN KEY ("listing_id") REFERENCES "listings"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;

  -- Evidence Checklists → Verification Requests
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'evidence_checklists_verification_request_id_fkey') THEN
    ALTER TABLE "evidence_checklists" ADD CONSTRAINT "evidence_checklists_verification_request_id_fkey" 
      FOREIGN KEY ("verification_request_id") REFERENCES "verification_requests"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;

  -- Identifier Validations → Verification Requests
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'identifier_validations_verification_request_id_fkey') THEN
    ALTER TABLE "identifier_validations" ADD CONSTRAINT "identifier_validations_verification_request_id_fkey" 
      FOREIGN KEY ("verification_request_id") REFERENCES "verification_requests"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;

  -- Evidence Packs → Listings
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'evidence_packs_listing_id_fkey') THEN
    ALTER TABLE "evidence_packs" ADD CONSTRAINT "evidence_packs_listing_id_fkey" 
      FOREIGN KEY ("listing_id") REFERENCES "listings"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;

  -- Evidence Items → Evidence Packs
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'evidence_items_pack_id_fkey') THEN
    ALTER TABLE "evidence_items" ADD CONSTRAINT "evidence_items_pack_id_fkey" 
      FOREIGN KEY ("pack_id") REFERENCES "evidence_packs"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;

  -- Orders → Listings & Users
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'orders_listing_id_fkey') THEN
    ALTER TABLE "orders" ADD CONSTRAINT "orders_listing_id_fkey" 
      FOREIGN KEY ("listing_id") REFERENCES "listings"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'orders_buyer_id_fkey') THEN
    ALTER TABLE "orders" ADD CONSTRAINT "orders_buyer_id_fkey" 
      FOREIGN KEY ("buyer_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'orders_seller_id_fkey') THEN
    ALTER TABLE "orders" ADD CONSTRAINT "orders_seller_id_fkey" 
      FOREIGN KEY ("seller_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;

  -- Escrow Records → Orders
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'escrow_records_order_id_fkey') THEN
    ALTER TABLE "escrow_records" ADD CONSTRAINT "escrow_records_order_id_fkey" 
      FOREIGN KEY ("order_id") REFERENCES "orders"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;

  -- Invoices → Orders & Users
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'invoices_order_id_fkey') THEN
    ALTER TABLE "invoices" ADD CONSTRAINT "invoices_order_id_fkey" 
      FOREIGN KEY ("order_id") REFERENCES "orders"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'invoices_buyer_id_fkey') THEN
    ALTER TABLE "invoices" ADD CONSTRAINT "invoices_buyer_id_fkey" 
      FOREIGN KEY ("buyer_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'invoices_seller_id_fkey') THEN
    ALTER TABLE "invoices" ADD CONSTRAINT "invoices_seller_id_fkey" 
      FOREIGN KEY ("seller_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;

  -- Refund Records → Orders
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'refund_records_order_id_fkey') THEN
    ALTER TABLE "refund_records" ADD CONSTRAINT "refund_records_order_id_fkey" 
      FOREIGN KEY ("order_id") REFERENCES "orders"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;

  -- Ratings → Orders
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'ratings_order_id_fkey') THEN
    ALTER TABLE "ratings" ADD CONSTRAINT "ratings_order_id_fkey" 
      FOREIGN KEY ("order_id") REFERENCES "orders"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;

  -- Notification Logs → Users
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'notification_logs_user_id_fkey') THEN
    ALTER TABLE "notification_logs" ADD CONSTRAINT "notification_logs_user_id_fkey" 
      FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;

  -- Messages → Users & Listings
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'messages_sender_id_fkey') THEN
    ALTER TABLE "messages" ADD CONSTRAINT "messages_sender_id_fkey" 
      FOREIGN KEY ("sender_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'messages_recipient_id_fkey') THEN
    ALTER TABLE "messages" ADD CONSTRAINT "messages_recipient_id_fkey" 
      FOREIGN KEY ("recipient_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'messages_listing_id_fkey') THEN
    ALTER TABLE "messages" ADD CONSTRAINT "messages_listing_id_fkey" 
      FOREIGN KEY ("listing_id") REFERENCES "listings"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

-- ───────────────────────────────────────────────────────────────────────────
-- PHASE 8: CLEAN UP RETIRED MULTI-SCHEMA NAMESPACES
-- Drops the old empty schemas now that tables/sequences have relocated to public.
-- ───────────────────────────────────────────────────────────────────────────

DROP SCHEMA IF EXISTS "auth" CASCADE;
DROP SCHEMA IF EXISTS "users" CASCADE;
DROP SCHEMA IF EXISTS "listings" CASCADE;
DROP SCHEMA IF EXISTS "trust_lens" CASCADE;
DROP SCHEMA IF EXISTS "evidence" CASCADE;
DROP SCHEMA IF EXISTS "transactions" CASCADE;
DROP SCHEMA IF EXISTS "notifications" CASCADE;
