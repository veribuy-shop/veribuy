#!/bin/bash
set -e

echo "🚀 Initializing VeriBuy Database..."

# Wait for PostgreSQL to be ready
until pg_isready -U "$POSTGRES_USER" -d "$POSTGRES_DB"; do
  echo "⏳ Waiting for PostgreSQL to be ready..."
  sleep 2
done

echo "✅ PostgreSQL is ready!"

# Run SQL initialization
psql -v ON_ERROR_STOP=1 --username "$POSTGRES_USER" --dbname "$POSTGRES_DB" <<-EOSQL
  -- =====================================================
  -- VERIBUY DATABASE INITIALIZATION
  -- =====================================================

  -- ─── Create Schemas ─────────────────────────────────
  CREATE SCHEMA IF NOT EXISTS auth;
  CREATE SCHEMA IF NOT EXISTS users;
  CREATE SCHEMA IF NOT EXISTS listings;
  CREATE SCHEMA IF NOT EXISTS trust_lens;
  CREATE SCHEMA IF NOT EXISTS evidence;
  CREATE SCHEMA IF NOT EXISTS transactions;
  CREATE SCHEMA IF NOT EXISTS notifications;

  -- ─── AUTH SCHEMA ────────────────────────────────────
  
  -- Create Role enum
  CREATE TYPE auth."Role" AS ENUM ('USER', 'ADMIN');

  -- Users table
  CREATE TABLE IF NOT EXISTS auth.users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL,
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    role auth."Role" NOT NULL DEFAULT 'USER',
    is_email_verified BOOLEAN NOT NULL DEFAULT false,
    is_active BOOLEAN NOT NULL DEFAULT true,
    last_login_at TIMESTAMP,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
  );

  -- Refresh tokens table
  CREATE TABLE IF NOT EXISTS auth.refresh_tokens (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    token VARCHAR(500) UNIQUE NOT NULL,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    expires_at TIMESTAMP NOT NULL,
    revoked_at TIMESTAMP,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
  );

  CREATE INDEX IF NOT EXISTS idx_refresh_tokens_user_id ON auth.refresh_tokens(user_id);
  CREATE INDEX IF NOT EXISTS idx_refresh_tokens_token ON auth.refresh_tokens(token);

  -- ─── USERS SCHEMA ───────────────────────────────────
  
  CREATE TABLE IF NOT EXISTS users.profiles (
    id UUID PRIMARY KEY,
    auth_user_id UUID NOT NULL UNIQUE,
    bio TEXT,
    phone_number VARCHAR(20),
    address TEXT,
    city VARCHAR(100),
    state VARCHAR(100),
    country VARCHAR(100),
    postal_code VARCHAR(20),
    avatar_url VARCHAR(500),
    is_verified_seller BOOLEAN NOT NULL DEFAULT false,
    rating DECIMAL(3, 2) DEFAULT 0,
    total_sales INTEGER DEFAULT 0,
    total_purchases INTEGER DEFAULT 0,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
  );

  CREATE INDEX IF NOT EXISTS idx_profiles_auth_user_id ON users.profiles(auth_user_id);

  -- ─── LISTINGS SCHEMA ────────────────────────────────
  
  CREATE TYPE listings."ListingStatus" AS ENUM ('DRAFT', 'PENDING_VERIFICATION', 'ACTIVE', 'SOLD', 'REMOVED');
  CREATE TYPE listings."TrustLensStatus" AS ENUM ('NOT_SUBMITTED', 'PENDING', 'IN_PROGRESS', 'PASSED', 'FAILED', 'REQUIRES_RESUBMISSION');
  CREATE TYPE listings."DeviceCondition" AS ENUM ('NEW', 'LIKE_NEW', 'EXCELLENT', 'GOOD', 'FAIR', 'POOR');

  CREATE TABLE IF NOT EXISTS listings.listings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    seller_id UUID NOT NULL,
    title VARCHAR(255) NOT NULL,
    description TEXT,
    price DECIMAL(10, 2) NOT NULL,
    currency VARCHAR(3) NOT NULL DEFAULT 'USD',
    device_type VARCHAR(100),
    brand VARCHAR(100),
    model VARCHAR(100),
    storage_capacity VARCHAR(50),
    color VARCHAR(50),
    condition listings."DeviceCondition" NOT NULL,
    images TEXT[],
    status listings."ListingStatus" NOT NULL DEFAULT 'DRAFT',
    trust_lens_status listings."TrustLensStatus" NOT NULL DEFAULT 'NOT_SUBMITTED',
    trust_lens_score INTEGER,
    is_featured BOOLEAN NOT NULL DEFAULT false,
    view_count INTEGER DEFAULT 0,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
  );

  CREATE INDEX IF NOT EXISTS idx_listings_seller_id ON listings.listings(seller_id);
  CREATE INDEX IF NOT EXISTS idx_listings_status ON listings.listings(status);
  CREATE INDEX IF NOT EXISTS idx_listings_trust_lens_status ON listings.listings(trust_lens_status);

  -- ─── TRUST LENS SCHEMA ──────────────────────────────
  
  CREATE TYPE trust_lens."VerificationStatus" AS ENUM ('PENDING', 'IN_PROGRESS', 'PASSED', 'FAILED', 'REQUIRES_RESUBMISSION');

  CREATE TABLE IF NOT EXISTS trust_lens.verification_requests (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    listing_id UUID NOT NULL,
    seller_id UUID NOT NULL,
    status trust_lens."VerificationStatus" NOT NULL DEFAULT 'PENDING',
    trust_score INTEGER,
    ai_analysis_result JSONB,
    manual_review_notes TEXT,
    reviewed_by UUID,
    reviewed_at TIMESTAMP,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
  );

  CREATE INDEX IF NOT EXISTS idx_verification_requests_listing_id ON trust_lens.verification_requests(listing_id);
  CREATE INDEX IF NOT EXISTS idx_verification_requests_seller_id ON trust_lens.verification_requests(seller_id);
  CREATE INDEX IF NOT EXISTS idx_verification_requests_status ON trust_lens.verification_requests(status);

  -- ─── EVIDENCE SCHEMA ────────────────────────────────
  
  CREATE TYPE evidence."EvidenceType" AS ENUM ('PHOTO', 'VIDEO', 'DOCUMENT', 'RECEIPT');
  CREATE TYPE evidence."EvidencePackStatus" AS ENUM ('DRAFT', 'SUBMITTED', 'APPROVED', 'REJECTED');

  CREATE TABLE IF NOT EXISTS evidence.evidence_packs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    verification_request_id UUID NOT NULL,
    listing_id UUID NOT NULL,
    seller_id UUID NOT NULL,
    status evidence."EvidencePackStatus" NOT NULL DEFAULT 'DRAFT',
    submitted_at TIMESTAMP,
    reviewed_at TIMESTAMP,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS evidence.evidence_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    evidence_pack_id UUID NOT NULL REFERENCES evidence.evidence_packs(id) ON DELETE CASCADE,
    type evidence."EvidenceType" NOT NULL,
    file_url VARCHAR(500) NOT NULL,
    file_name VARCHAR(255),
    file_size INTEGER,
    mime_type VARCHAR(100),
    metadata JSONB,
    ai_verification_result JSONB,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
  );

  CREATE INDEX IF NOT EXISTS idx_evidence_packs_verification_request_id ON evidence.evidence_packs(verification_request_id);
  CREATE INDEX IF NOT EXISTS idx_evidence_packs_listing_id ON evidence.evidence_packs(listing_id);
  CREATE INDEX IF NOT EXISTS idx_evidence_items_evidence_pack_id ON evidence.evidence_items(evidence_pack_id);

  -- ─── TRANSACTIONS SCHEMA ────────────────────────────
  
  CREATE TYPE transactions."OrderStatus" AS ENUM ('PENDING', 'PAYMENT_CONFIRMED', 'SHIPPED', 'DELIVERED', 'COMPLETED', 'CANCELLED', 'REFUNDED');
  CREATE TYPE transactions."EscrowStatus" AS ENUM ('PENDING', 'HELD', 'RELEASED', 'REFUNDED');
  CREATE TYPE transactions."PaymentStatus" AS ENUM ('PENDING', 'PROCESSING', 'COMPLETED', 'FAILED', 'REFUNDED');

  CREATE TABLE IF NOT EXISTS transactions.orders (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    listing_id UUID NOT NULL,
    buyer_id UUID NOT NULL,
    seller_id UUID NOT NULL,
    amount DECIMAL(10, 2) NOT NULL,
    currency VARCHAR(3) NOT NULL DEFAULT 'USD',
    status transactions."OrderStatus" NOT NULL DEFAULT 'PENDING',
    payment_intent_id VARCHAR(255),
    payment_status transactions."PaymentStatus" NOT NULL DEFAULT 'PENDING',
    shipping_address JSONB,
    tracking_number VARCHAR(255),
    shipped_at TIMESTAMP,
    delivered_at TIMESTAMP,
    completed_at TIMESTAMP,
    cancelled_at TIMESTAMP,
    cancellation_reason TEXT,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS transactions.escrow_accounts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    order_id UUID NOT NULL UNIQUE REFERENCES transactions.orders(id) ON DELETE CASCADE,
    amount DECIMAL(10, 2) NOT NULL,
    currency VARCHAR(3) NOT NULL DEFAULT 'USD',
    status transactions."EscrowStatus" NOT NULL DEFAULT 'PENDING',
    held_at TIMESTAMP,
    released_at TIMESTAMP,
    refunded_at TIMESTAMP,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
  );

  CREATE INDEX IF NOT EXISTS idx_orders_buyer_id ON transactions.orders(buyer_id);
  CREATE INDEX IF NOT EXISTS idx_orders_seller_id ON transactions.orders(seller_id);
  CREATE INDEX IF NOT EXISTS idx_orders_listing_id ON transactions.orders(listing_id);
  CREATE INDEX IF NOT EXISTS idx_escrow_accounts_order_id ON transactions.escrow_accounts(order_id);

  -- ─── NOTIFICATIONS SCHEMA ───────────────────────────
  
  CREATE TYPE notifications."NotificationType" AS ENUM ('ORDER', 'MESSAGE', 'VERIFICATION', 'SYSTEM');

  CREATE TABLE IF NOT EXISTS notifications.notifications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL,
    type notifications."NotificationType" NOT NULL,
    title VARCHAR(255) NOT NULL,
    message TEXT NOT NULL,
    data JSONB,
    is_read BOOLEAN NOT NULL DEFAULT false,
    read_at TIMESTAMP,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS notifications.messages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    sender_id UUID NOT NULL,
    recipient_id UUID NOT NULL,
    listing_id UUID,
    subject VARCHAR(255),
    content TEXT NOT NULL,
    is_read BOOLEAN NOT NULL DEFAULT false,
    read_at TIMESTAMP,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
  );

  CREATE INDEX IF NOT EXISTS idx_notifications_user_id ON notifications.notifications(user_id);
  CREATE INDEX IF NOT EXISTS idx_notifications_is_read ON notifications.notifications(is_read);
  CREATE INDEX IF NOT EXISTS idx_messages_sender_id ON notifications.messages(sender_id);
  CREATE INDEX IF NOT EXISTS idx_messages_recipient_id ON notifications.messages(recipient_id);
  CREATE INDEX IF NOT EXISTS idx_messages_listing_id ON notifications.messages(listing_id);

  -- ─── SEED DATA ──────────────────────────────────────
  
  -- Insert Admin User (password: Admin123!)
  INSERT INTO auth.users (id, name, email, password_hash, role, is_email_verified, created_at, updated_at)
  VALUES (
    '1be6603f-3a32-4062-88d0-6a59dd43a5e1',
    'Admin User',
    'admin@veribuy.com',
    '\$2a\$12\$NPdVl2GhKz8tmSUxwCV44.vvL7ORsk7HiDiwGpd4RT4A2K5YOEmIq',
    'ADMIN',
    true,
    CURRENT_TIMESTAMP,
    CURRENT_TIMESTAMP
  ) ON CONFLICT (email) DO NOTHING;

  -- Insert Regular User (password: Test123!)
  INSERT INTO auth.users (id, name, email, password_hash, role, is_email_verified, created_at, updated_at)
  VALUES (
    '772e1203-53ba-49ae-ab7e-61ef09b779ec',
    'Test User',
    'frontend-test@veribuy.com',
    '\$2a\$12\$vsPEnC42OH3KLfb/bKFjMuTBx0siSFuFZHPpxxCf2DFnjZ4zE.UjW',
    'USER',
    true,
    CURRENT_TIMESTAMP,
    CURRENT_TIMESTAMP
  ) ON CONFLICT (email) DO NOTHING;

  -- Insert user profile for test user
  INSERT INTO users.profiles (id, auth_user_id, bio, is_verified_seller, rating, created_at, updated_at)
  VALUES (
    '772e1203-53ba-49ae-ab7e-61ef09b779ec',
    '772e1203-53ba-49ae-ab7e-61ef09b779ec',
    'Trusted seller on VeriBuy',
    true,
    4.8,
    CURRENT_TIMESTAMP,
    CURRENT_TIMESTAMP
  ) ON CONFLICT (auth_user_id) DO NOTHING;

  -- Insert sample listing
  INSERT INTO listings.listings (
    id,
    seller_id,
    title,
    description,
    price,
    device_type,
    brand,
    model,
    storage_capacity,
    color,
    condition,
    status,
    trust_lens_status,
    trust_lens_score,
    created_at,
    updated_at
  ) VALUES (
    'fc9159b7-b008-4273-9a96-84a71cb93f9a',
    '772e1203-53ba-49ae-ab7e-61ef09b779ec',
    'iPhone 15 Pro Max - 256GB Natural Titanium',
    'Brand new iPhone 15 Pro Max in Natural Titanium. Fully verified through Trust Lens. Comes with original box and accessories.',
    1099.00,
    'Smartphone',
    'Apple',
    'iPhone 15 Pro Max',
    '256GB',
    'Natural Titanium',
    'NEW',
    'ACTIVE',
    'PASSED',
    95,
    CURRENT_TIMESTAMP,
    CURRENT_TIMESTAMP
  ) ON CONFLICT (id) DO NOTHING;

  -- Insert verification request for the listing
  INSERT INTO trust_lens.verification_requests (
    id,
    listing_id,
    seller_id,
    status,
    trust_score,
    created_at,
    updated_at
  ) VALUES (
    '48a2b5d2-e283-46e9-b124-6dcbae2cb134',
    'fc9159b7-b008-4273-9a96-84a71cb93f9a',
    '772e1203-53ba-49ae-ab7e-61ef09b779ec',
    'PASSED',
    95,
    CURRENT_TIMESTAMP,
    CURRENT_TIMESTAMP
  ) ON CONFLICT (id) DO NOTHING;

  -- =====================================================
  EOSQL

echo "✅ Database initialization complete!"
echo "📊 Created schemas: auth, users, listings, trust_lens, evidence, transactions, notifications"
echo "👤 Created users: admin@veribuy.com (ADMIN), frontend-test@veribuy.com (USER)"
echo "📱 Created sample listing: iPhone 15 Pro Max"
