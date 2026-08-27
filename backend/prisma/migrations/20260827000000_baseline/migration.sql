-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "auth";

-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "evidence";

-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "listings";

-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "notifications";

-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "transactions";

-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "trust_lens";

-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "users";

-- CreateEnum
CREATE TYPE "auth"."Role" AS ENUM ('BUYER', 'SELLER', 'ADMIN');

-- CreateEnum
CREATE TYPE "users"."VerificationStatus" AS ENUM ('UNVERIFIED', 'PENDING', 'VERIFIED', 'REJECTED', 'SUSPENDED');

-- CreateEnum
CREATE TYPE "listings"."ConditionGrade" AS ENUM ('A', 'B', 'C');

-- CreateEnum
CREATE TYPE "listings"."DeviceType" AS ENUM ('SMARTPHONE', 'TABLET', 'LAPTOP', 'SMARTWATCH', 'DESKTOP', 'GAMING_CONSOLE', 'OTHER');

-- CreateEnum
CREATE TYPE "listings"."IntegrityFlag" AS ENUM ('CLEAN', 'IMEI_MISMATCH', 'ICLOUD_LOCKED', 'REPORTED_STOLEN', 'BLACKLISTED', 'SERIAL_MISMATCH');

-- CreateEnum
CREATE TYPE "listings"."ListingStatus" AS ENUM ('DRAFT', 'SUBMITTED', 'UNDER_REVIEW', 'APPROVED', 'REJECTED', 'ACTIVE', 'SOLD', 'DELISTED');

-- CreateEnum
CREATE TYPE "listings"."TrustLensStatus" AS ENUM ('PENDING', 'IN_PROGRESS', 'PASSED', 'FAILED', 'REQUIRES_REVIEW');

-- CreateEnum
CREATE TYPE "trust_lens"."ReviewStatus" AS ENUM ('PENDING', 'IN_PROGRESS', 'PASSED', 'FAILED', 'REQUIRES_REVIEW');

-- CreateEnum
CREATE TYPE "trust_lens"."ConditionGrade" AS ENUM ('A', 'B', 'C');

-- CreateEnum
CREATE TYPE "trust_lens"."IntegrityFlag" AS ENUM ('CLEAN', 'IMEI_MISMATCH', 'ICLOUD_LOCKED', 'REPORTED_STOLEN', 'BLACKLISTED', 'SERIAL_MISMATCH');

-- CreateEnum
CREATE TYPE "trust_lens"."EvidenceType" AS ENUM ('IMAGE', 'VIDEO', 'SCREENSHOT', 'DOCUMENT');

-- CreateEnum
CREATE TYPE "evidence"."EvidenceType" AS ENUM ('DEVICE_IMAGE', 'SCREEN_IMAGE', 'BODY_IMAGE', 'SETTINGS_SCREENSHOT', 'IMEI_SCREENSHOT', 'PACKAGING_IMAGE', 'ACCESSORIES_IMAGE', 'OTHER');

-- CreateEnum
CREATE TYPE "transactions"."OrderStatus" AS ENUM ('PENDING', 'PAYMENT_RECEIVED', 'ESCROW_HELD', 'SHIPPED', 'DELIVERED', 'COMPLETED', 'DISPUTED', 'REFUNDED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "transactions"."EscrowStatus" AS ENUM ('HELD', 'RELEASED', 'REFUNDED', 'DISPUTED');

-- CreateEnum
CREATE TYPE "transactions"."InvoiceType" AS ENUM ('RECEIPT', 'CREDIT_NOTE');

-- CreateEnum
CREATE TYPE "notifications"."NotificationChannel" AS ENUM ('EMAIL', 'PUSH', 'SMS');

-- CreateEnum
CREATE TYPE "notifications"."NotificationStatus" AS ENUM ('PENDING', 'SENT', 'FAILED');

-- CreateTable
CREATE TABLE "auth"."users" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "password_hash" TEXT NOT NULL,
    "role" "auth"."Role" NOT NULL DEFAULT 'BUYER',
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

-- CreateTable
CREATE TABLE "auth"."refresh_tokens" (
    "id" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "expires_at" TIMESTAMP(3) NOT NULL,
    "revoked_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "refresh_tokens_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "users"."profiles" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "display_name" TEXT NOT NULL,
    "first_name" TEXT,
    "last_name" TEXT,
    "avatar_url" TEXT,
    "bio" TEXT,
    "phone" TEXT,
    "seller_rating" DOUBLE PRECISION,
    "total_sales" INTEGER NOT NULL DEFAULT 0,
    "total_purchases" INTEGER NOT NULL DEFAULT 0,
    "verification_status" "users"."VerificationStatus" NOT NULL DEFAULT 'UNVERIFIED',
    "kyc_verified_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "profiles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "users"."addresses" (
    "id" TEXT NOT NULL,
    "profile_id" TEXT NOT NULL,
    "line1" TEXT NOT NULL,
    "line2" TEXT,
    "city" TEXT NOT NULL,
    "state" TEXT NOT NULL,
    "postal_code" TEXT NOT NULL,
    "country" TEXT NOT NULL,

    CONSTRAINT "addresses_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "listings"."listings" (
    "id" TEXT NOT NULL,
    "seller_id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "device_type" "listings"."DeviceType" NOT NULL,
    "brand" TEXT NOT NULL,
    "model" TEXT NOT NULL,
    "price" DECIMAL(10,2) NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'GBP',
    "condition_grade" "listings"."ConditionGrade",
    "status" "listings"."ListingStatus" NOT NULL DEFAULT 'DRAFT',
    "imei" TEXT,
    "serial_number" TEXT,
    "integrity_flags" "listings"."IntegrityFlag"[],
    "trust_lens_status" "listings"."TrustLensStatus" NOT NULL DEFAULT 'PENDING',
    "view_count" INTEGER NOT NULL DEFAULT 0,
    "published_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "listings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "trust_lens"."verification_requests" (
    "id" TEXT NOT NULL,
    "listing_id" TEXT NOT NULL,
    "seller_id" TEXT NOT NULL,
    "status" "trust_lens"."ReviewStatus" NOT NULL DEFAULT 'PENDING',
    "condition_grade" "trust_lens"."ConditionGrade",
    "integrity_flags" "trust_lens"."IntegrityFlag"[],
    "review_notes" TEXT,
    "completed_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "verification_requests_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "trust_lens"."evidence_checklists" (
    "id" TEXT NOT NULL,
    "verification_request_id" TEXT NOT NULL,
    "type" "trust_lens"."EvidenceType" NOT NULL,
    "description" TEXT NOT NULL,
    "required" BOOLEAN NOT NULL DEFAULT true,
    "fulfilled" BOOLEAN NOT NULL DEFAULT false,
    "fulfilled_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "evidence_checklists_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "trust_lens"."identifier_validations" (
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

-- CreateTable
CREATE TABLE "evidence"."evidence_packs" (
    "id" TEXT NOT NULL,
    "listing_id" TEXT NOT NULL,
    "seller_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "evidence_packs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "evidence"."evidence_items" (
    "id" TEXT NOT NULL,
    "pack_id" TEXT NOT NULL,
    "type" "evidence"."EvidenceType" NOT NULL,
    "url" TEXT NOT NULL,
    "filename" TEXT NOT NULL,
    "mime_type" TEXT NOT NULL,
    "size_bytes" INTEGER NOT NULL,
    "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "metadata" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "evidence_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "transactions"."orders" (
    "id" TEXT NOT NULL,
    "buyer_id" TEXT NOT NULL,
    "seller_id" TEXT NOT NULL,
    "listing_id" TEXT NOT NULL,
    "listing_title" TEXT,
    "listing_description" TEXT,
    "listing_category" TEXT,
    "amount" DECIMAL(10,2) NOT NULL,
    "shipping_fee" DECIMAL(10,2),
    "shipping_service" TEXT,
    "total_amount" DECIMAL(10,2),
    "currency" TEXT NOT NULL DEFAULT 'GBP',
    "status" "transactions"."OrderStatus" NOT NULL DEFAULT 'PENDING',
    "escrow_id" TEXT,
    "payment_intent_id" TEXT,
    "tracking_number" TEXT,
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

-- CreateTable
CREATE TABLE "transactions"."escrow_records" (
    "id" TEXT NOT NULL,
    "order_id" TEXT NOT NULL,
    "amount" DECIMAL(10,2) NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'GBP',
    "status" "transactions"."EscrowStatus" NOT NULL DEFAULT 'HELD',
    "provider_ref" TEXT,
    "held_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "released_at" TIMESTAMP(3),
    "refunded_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "escrow_records_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "transactions"."invoices" (
    "id" TEXT NOT NULL,
    "order_id" TEXT NOT NULL,
    "invoice_number" TEXT NOT NULL,
    "invoice_type" "transactions"."InvoiceType" NOT NULL DEFAULT 'RECEIPT',
    "status" "transactions"."OrderStatus" NOT NULL,
    "buyer_id" TEXT NOT NULL,
    "seller_id" TEXT NOT NULL,
    "amount" DECIMAL(10,2) NOT NULL,
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

-- CreateTable
CREATE TABLE "transactions"."refund_records" (
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

-- CreateTable
CREATE TABLE "transactions"."ratings" (
    "id" TEXT NOT NULL,
    "order_id" TEXT NOT NULL,
    "buyer_id" TEXT NOT NULL,
    "seller_id" TEXT NOT NULL,
    "rating" INTEGER NOT NULL,
    "comment" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ratings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "notifications"."notification_logs" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "channel" "notifications"."NotificationChannel" NOT NULL,
    "template" TEXT NOT NULL,
    "payload" JSONB NOT NULL,
    "status" "notifications"."NotificationStatus" NOT NULL DEFAULT 'PENDING',
    "sent_at" TIMESTAMP(3),
    "failed_at" TIMESTAMP(3),
    "error" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "notification_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "notifications"."messages" (
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

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "auth"."users"("email");

-- CreateIndex
CREATE INDEX "users_role_idx" ON "auth"."users"("role");

-- CreateIndex
CREATE INDEX "users_is_active_idx" ON "auth"."users"("is_active");

-- CreateIndex
CREATE INDEX "users_created_at_idx" ON "auth"."users"("created_at");

-- CreateIndex
CREATE INDEX "users_deleted_at_idx" ON "auth"."users"("deleted_at");

-- CreateIndex
CREATE INDEX "users_email_verification_token_idx" ON "auth"."users"("email_verification_token");

-- CreateIndex
CREATE INDEX "users_password_reset_token_idx" ON "auth"."users"("password_reset_token");

-- CreateIndex
CREATE UNIQUE INDEX "refresh_tokens_token_key" ON "auth"."refresh_tokens"("token");

-- CreateIndex
CREATE INDEX "refresh_tokens_user_id_idx" ON "auth"."refresh_tokens"("user_id");

-- CreateIndex
CREATE INDEX "refresh_tokens_expires_at_idx" ON "auth"."refresh_tokens"("expires_at");

-- CreateIndex
CREATE INDEX "refresh_tokens_revoked_at_idx" ON "auth"."refresh_tokens"("revoked_at");

-- CreateIndex
CREATE INDEX "refresh_tokens_user_id_revoked_at_idx" ON "auth"."refresh_tokens"("user_id", "revoked_at");

-- CreateIndex
CREATE UNIQUE INDEX "profiles_user_id_key" ON "users"."profiles"("user_id");

-- CreateIndex
CREATE INDEX "profiles_verification_status_idx" ON "users"."profiles"("verification_status");

-- CreateIndex
CREATE INDEX "profiles_seller_rating_idx" ON "users"."profiles"("seller_rating");

-- CreateIndex
CREATE INDEX "profiles_created_at_idx" ON "users"."profiles"("created_at");

-- CreateIndex
CREATE UNIQUE INDEX "addresses_profile_id_key" ON "users"."addresses"("profile_id");

-- CreateIndex
CREATE INDEX "listings_seller_id_idx" ON "listings"."listings"("seller_id");

-- CreateIndex
CREATE INDEX "listings_status_idx" ON "listings"."listings"("status");

-- CreateIndex
CREATE INDEX "listings_device_type_idx" ON "listings"."listings"("device_type");

-- CreateIndex
CREATE INDEX "listings_trust_lens_status_idx" ON "listings"."listings"("trust_lens_status");

-- CreateIndex
CREATE INDEX "listings_published_at_idx" ON "listings"."listings"("published_at");

-- CreateIndex
CREATE INDEX "listings_created_at_idx" ON "listings"."listings"("created_at");

-- CreateIndex
CREATE INDEX "listings_seller_id_status_idx" ON "listings"."listings"("seller_id", "status");

-- CreateIndex
CREATE INDEX "listings_device_type_status_idx" ON "listings"."listings"("device_type", "status");

-- CreateIndex
CREATE INDEX "listings_status_created_at_idx" ON "listings"."listings"("status", "created_at" DESC);

-- CreateIndex
CREATE INDEX "listings_seller_id_created_at_idx" ON "listings"."listings"("seller_id", "created_at" DESC);

-- CreateIndex
CREATE UNIQUE INDEX "verification_requests_listing_id_key" ON "trust_lens"."verification_requests"("listing_id");

-- CreateIndex
CREATE INDEX "verification_requests_seller_id_idx" ON "trust_lens"."verification_requests"("seller_id");

-- CreateIndex
CREATE INDEX "verification_requests_status_idx" ON "trust_lens"."verification_requests"("status");

-- CreateIndex
CREATE INDEX "verification_requests_created_at_idx" ON "trust_lens"."verification_requests"("created_at");

-- CreateIndex
CREATE INDEX "verification_requests_status_created_at_idx" ON "trust_lens"."verification_requests"("status", "created_at");

-- CreateIndex
CREATE INDEX "verification_requests_seller_id_status_idx" ON "trust_lens"."verification_requests"("seller_id", "status");

-- CreateIndex
CREATE INDEX "evidence_checklists_verification_request_id_idx" ON "trust_lens"."evidence_checklists"("verification_request_id");

-- CreateIndex
CREATE INDEX "evidence_checklists_fulfilled_idx" ON "trust_lens"."evidence_checklists"("fulfilled");

-- CreateIndex
CREATE INDEX "evidence_checklists_verification_request_id_type_fulfilled_idx" ON "trust_lens"."evidence_checklists"("verification_request_id", "type", "fulfilled");

-- CreateIndex
CREATE UNIQUE INDEX "identifier_validations_verification_request_id_key" ON "trust_lens"."identifier_validations"("verification_request_id");

-- CreateIndex
CREATE UNIQUE INDEX "evidence_packs_listing_id_key" ON "evidence"."evidence_packs"("listing_id");

-- CreateIndex
CREATE INDEX "evidence_packs_seller_id_idx" ON "evidence"."evidence_packs"("seller_id");

-- CreateIndex
CREATE INDEX "evidence_packs_created_at_idx" ON "evidence"."evidence_packs"("created_at");

-- CreateIndex
CREATE INDEX "evidence_packs_seller_id_created_at_idx" ON "evidence"."evidence_packs"("seller_id", "created_at" DESC);

-- CreateIndex
CREATE INDEX "evidence_items_pack_id_idx" ON "evidence"."evidence_items"("pack_id");

-- CreateIndex
CREATE INDEX "evidence_items_type_idx" ON "evidence"."evidence_items"("type");

-- CreateIndex
CREATE INDEX "evidence_items_created_at_idx" ON "evidence"."evidence_items"("created_at");

-- CreateIndex
CREATE INDEX "evidence_items_pack_id_created_at_idx" ON "evidence"."evidence_items"("pack_id", "created_at" ASC);

-- CreateIndex
CREATE INDEX "orders_buyer_id_idx" ON "transactions"."orders"("buyer_id");

-- CreateIndex
CREATE INDEX "orders_seller_id_idx" ON "transactions"."orders"("seller_id");

-- CreateIndex
CREATE INDEX "orders_listing_id_idx" ON "transactions"."orders"("listing_id");

-- CreateIndex
CREATE INDEX "orders_status_idx" ON "transactions"."orders"("status");

-- CreateIndex
CREATE INDEX "orders_payment_intent_id_idx" ON "transactions"."orders"("payment_intent_id");

-- CreateIndex
CREATE INDEX "orders_created_at_idx" ON "transactions"."orders"("created_at");

-- CreateIndex
CREATE INDEX "orders_buyer_id_status_idx" ON "transactions"."orders"("buyer_id", "status");

-- CreateIndex
CREATE INDEX "orders_seller_id_status_idx" ON "transactions"."orders"("seller_id", "status");

-- CreateIndex
CREATE INDEX "orders_buyer_id_created_at_idx" ON "transactions"."orders"("buyer_id", "created_at" DESC);

-- CreateIndex
CREATE INDEX "orders_seller_id_created_at_idx" ON "transactions"."orders"("seller_id", "created_at" DESC);

-- CreateIndex
CREATE UNIQUE INDEX "escrow_records_order_id_key" ON "transactions"."escrow_records"("order_id");

-- CreateIndex
CREATE INDEX "escrow_records_status_idx" ON "transactions"."escrow_records"("status");

-- CreateIndex
CREATE INDEX "escrow_records_created_at_idx" ON "transactions"."escrow_records"("created_at");

-- CreateIndex
CREATE UNIQUE INDEX "invoices_invoice_number_key" ON "transactions"."invoices"("invoice_number");

-- CreateIndex
CREATE INDEX "invoices_order_id_idx" ON "transactions"."invoices"("order_id");

-- CreateIndex
CREATE INDEX "invoices_buyer_id_idx" ON "transactions"."invoices"("buyer_id");

-- CreateIndex
CREATE INDEX "invoices_seller_id_idx" ON "transactions"."invoices"("seller_id");

-- CreateIndex
CREATE INDEX "invoices_created_at_idx" ON "transactions"."invoices"("created_at");

-- CreateIndex
CREATE INDEX "invoices_buyer_id_created_at_idx" ON "transactions"."invoices"("buyer_id", "created_at" DESC);

-- CreateIndex
CREATE INDEX "invoices_order_id_created_at_idx" ON "transactions"."invoices"("order_id", "created_at" DESC);

-- CreateIndex
CREATE UNIQUE INDEX "invoices_order_id_invoice_type_key" ON "transactions"."invoices"("order_id", "invoice_type");

-- CreateIndex
CREATE UNIQUE INDEX "refund_records_stripe_refund_id_key" ON "transactions"."refund_records"("stripe_refund_id");

-- CreateIndex
CREATE INDEX "refund_records_order_id_idx" ON "transactions"."refund_records"("order_id");

-- CreateIndex
CREATE UNIQUE INDEX "ratings_order_id_key" ON "transactions"."ratings"("order_id");

-- CreateIndex
CREATE INDEX "ratings_seller_id_idx" ON "transactions"."ratings"("seller_id");

-- CreateIndex
CREATE INDEX "ratings_buyer_id_idx" ON "transactions"."ratings"("buyer_id");

-- CreateIndex
CREATE INDEX "ratings_created_at_idx" ON "transactions"."ratings"("created_at");

-- CreateIndex
CREATE INDEX "ratings_seller_id_created_at_idx" ON "transactions"."ratings"("seller_id", "created_at" DESC);

-- CreateIndex
CREATE INDEX "notification_logs_user_id_idx" ON "notifications"."notification_logs"("user_id");

-- CreateIndex
CREATE INDEX "notification_logs_status_idx" ON "notifications"."notification_logs"("status");

-- CreateIndex
CREATE INDEX "notification_logs_created_at_idx" ON "notifications"."notification_logs"("created_at");

-- CreateIndex
CREATE INDEX "notification_logs_user_id_status_idx" ON "notifications"."notification_logs"("user_id", "status");

-- CreateIndex
CREATE INDEX "messages_recipient_id_idx" ON "notifications"."messages"("recipient_id");

-- CreateIndex
CREATE INDEX "messages_sender_id_idx" ON "notifications"."messages"("sender_id");

-- CreateIndex
CREATE INDEX "messages_listing_id_idx" ON "notifications"."messages"("listing_id");

-- CreateIndex
CREATE INDEX "messages_recipient_id_is_read_idx" ON "notifications"."messages"("recipient_id", "is_read");

-- CreateIndex
CREATE INDEX "messages_recipient_id_created_at_idx" ON "notifications"."messages"("recipient_id", "created_at" DESC);

-- CreateIndex
CREATE INDEX "messages_sender_id_created_at_idx" ON "notifications"."messages"("sender_id", "created_at" DESC);

-- AddForeignKey
ALTER TABLE "auth"."refresh_tokens" ADD CONSTRAINT "refresh_tokens_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "users"."addresses" ADD CONSTRAINT "addresses_profile_id_fkey" FOREIGN KEY ("profile_id") REFERENCES "users"."profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "trust_lens"."evidence_checklists" ADD CONSTRAINT "evidence_checklists_verification_request_id_fkey" FOREIGN KEY ("verification_request_id") REFERENCES "trust_lens"."verification_requests"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "trust_lens"."identifier_validations" ADD CONSTRAINT "identifier_validations_verification_request_id_fkey" FOREIGN KEY ("verification_request_id") REFERENCES "trust_lens"."verification_requests"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "evidence"."evidence_items" ADD CONSTRAINT "evidence_items_pack_id_fkey" FOREIGN KEY ("pack_id") REFERENCES "evidence"."evidence_packs"("id") ON DELETE CASCADE ON UPDATE CASCADE;
