-- Seed script for VeriBuy database
-- Run with: docker exec -i veribuy-postgres psql -U veribuy -d veribuy < scripts/seed.sql

-- Clean existing data (optional)
TRUNCATE TABLE listings.listings CASCADE;
TRUNCATE TABLE users.addresses CASCADE;
TRUNCATE TABLE users.profiles CASCADE;
TRUNCATE TABLE auth.refresh_tokens CASCADE;
TRUNCATE TABLE auth.users CASCADE;

-- Create sample users
-- Passwords: password123 (regular users), Admin123! (admin)
-- Note: auth.Role has only USER and ADMIN - seller/buyer distinction is handled at profile level
INSERT INTO auth.users (id, name, email, password_hash, role, is_email_verified, created_at, updated_at)
VALUES
  ('d9f8e7d6-c5b4-4a3b-9281-1f0e9d8c7b6a', 'Admin User', 'admin@veribuy.com', '$2a$12$..T4OSzC6At/iL4JDPrvYOGCNwFKpBCNgNoj7MMUNnrE1Vy2qZYya', 'ADMIN', true, NOW(), NOW()),
  ('772e1203-53ba-49ae-ab7e-61ef09b779ec', 'John Seller', 'john.seller@veribuy.com', '$2a$12$0kH/wcF2VjsC3uIA7DeDZe.X5KIfr75KT/NKigpWwWT2D/8Qxc8OO', 'USER', true, NOW(), NOW()),
  ('a1b2c3d4-e5f6-4a7b-8c9d-0e1f2a3b4c5d', 'Jane Tech', 'jane.tech@veribuy.com', '$2a$12$0kH/wcF2VjsC3uIA7DeDZe.X5KIfr75KT/NKigpWwWT2D/8Qxc8OO', 'USER', true, NOW(), NOW()),
  ('b2c3d4e5-f6a7-4b8c-9d0e-1f2a3b4c5d6e', 'Mike Buyer', 'mike.buyer@veribuy.com', '$2a$12$0kH/wcF2VjsC3uIA7DeDZe.X5KIfr75KT/NKigpWwWT2D/8Qxc8OO', 'USER', true, NOW(), NOW());

-- Create user profiles
INSERT INTO users.profiles (id, user_id, display_name, first_name, last_name, phone, created_at, updated_at)
VALUES
  (gen_random_uuid(), '772e1203-53ba-49ae-ab7e-61ef09b779ec', 'John S.', 'John', 'Seller', '+1-555-0101', NOW(), NOW()),
  (gen_random_uuid(), 'a1b2c3d4-e5f6-4a7b-8c9d-0e1f2a3b4c5d', 'Jane T.', 'Jane', 'Tech', '+1-555-0102', NOW(), NOW()),
  (gen_random_uuid(), 'b2c3d4e5-f6a7-4b8c-9d0e-1f2a3b4c5d6e', 'Mike B.', 'Mike', 'Buyer', '+1-555-0103', NOW(), NOW());

-- Create sample listings (using correct enum values: A, B, C for condition)
INSERT INTO listings.listings (
  id, seller_id, title, description, device_type, brand, model, price, currency,
  condition_grade, status, imei, serial_number, integrity_flags, trust_lens_status, view_count,
  published_at, created_at, updated_at
)
VALUES
  (
    gen_random_uuid(),
    '772e1203-53ba-49ae-ab7e-61ef09b779ec',
    'iPhone 15 Pro Max - 256GB - Natural Titanium',
    'Like new iPhone 15 Pro Max with all original accessories. Perfect condition, no scratches. Includes original box, charger, and case.',
    'SMARTPHONE',
    'Apple',
    'iPhone 15 Pro Max',
    1099.99,
    'USD',
    'A',
    'ACTIVE',
    '359211234567890',
    'F17ABC123456',
    ARRAY['CLEAN']::listings."IntegrityFlag"[],
    'PASSED',
    42,
    NOW(),
    NOW(),
    NOW()
  ),
  (
    gen_random_uuid(),
    '772e1203-53ba-49ae-ab7e-61ef09b779ec',
    'MacBook Pro 14" M3 - 16GB RAM - 512GB SSD',
    'Barely used MacBook Pro 14" with M3 chip. Perfect for developers and creators. Battery health at 100%. Comes with original charger.',
    'LAPTOP',
    'Apple',
    'MacBook Pro 14"',
    1899.00,
    'USD',
    'A',
    'ACTIVE',
    NULL,
    'C02ABC123456',
    ARRAY['CLEAN']::listings."IntegrityFlag"[],
    'PASSED',
    28,
    NOW(),
    NOW(),
    NOW()
  ),
  (
    gen_random_uuid(),
    'a1b2c3d4-e5f6-4a7b-8c9d-0e1f2a3b4c5d',
    'Samsung Galaxy S24 Ultra - 512GB - Titanium Black',
    'Flagship Samsung Galaxy S24 Ultra. Unlocked for all carriers. Includes S Pen and protective case. Minor wear on edges.',
    'SMARTPHONE',
    'Samsung',
    'Galaxy S24 Ultra',
    949.99,
    'USD',
    'B',
    'ACTIVE',
    '359212345678901',
    'R58DEF789012',
    ARRAY['CLEAN']::listings."IntegrityFlag"[],
    'PASSED',
    35,
    NOW(),
    NOW(),
    NOW()
  ),
  (
    gen_random_uuid(),
    'a1b2c3d4-e5f6-4a7b-8c9d-0e1f2a3b4c5d',
    'iPad Pro 12.9" M2 - 256GB - Space Gray',
    'Professional tablet with Magic Keyboard and Apple Pencil (2nd gen) included. Screen is pristine, no scratches.',
    'TABLET',
    'Apple',
    'iPad Pro 12.9"',
    899.00,
    'USD',
    'A',
    'ACTIVE',
    NULL,
    'DMPABC456789',
    ARRAY['CLEAN']::listings."IntegrityFlag"[],
    'PASSED',
    19,
    NOW(),
    NOW(),
    NOW()
  ),
  (
    gen_random_uuid(),
    '772e1203-53ba-49ae-ab7e-61ef09b779ec',
    'Google Pixel 8 Pro - 256GB - Obsidian',
    'Unlocked Google Pixel 8 Pro with amazing camera. Android updates guaranteed. Mint condition with original packaging.',
    'SMARTPHONE',
    'Google',
    'Pixel 8 Pro',
    749.99,
    'USD',
    'A',
    'ACTIVE',
    '359213456789012',
    'G9S4GHI345678',
    ARRAY['CLEAN']::listings."IntegrityFlag"[],
    'PASSED',
    15,
    NOW(),
    NOW(),
    NOW()
  ),
  (
    gen_random_uuid(),
    'a1b2c3d4-e5f6-4a7b-8c9d-0e1f2a3b4c5d',
    'Dell XPS 15 - i7-13700H - 32GB RAM - 1TB SSD',
    'Powerful laptop for professionals. OLED 4K display, NVIDIA RTX 4050. Used for light work, excellent condition.',
    'LAPTOP',
    'Dell',
    'XPS 15',
    1599.00,
    'USD',
    'B',
    'ACTIVE',
    NULL,
    'JKL7890MNO12',
    ARRAY['CLEAN']::listings."IntegrityFlag"[],
    'PASSED',
    22,
    NOW(),
    NOW(),
    NOW()
  ),
  (
    gen_random_uuid(),
    '772e1203-53ba-49ae-ab7e-61ef09b779ec',
    'AirPods Pro (2nd Generation) - USB-C',
    'Latest AirPods Pro with USB-C charging case. Perfect noise cancellation. All ear tips included.',
    'OTHER',
    'Apple',
    'AirPods Pro',
    199.99,
    'USD',
    'A',
    'ACTIVE',
    NULL,
    'APPABC123XYZ',
    ARRAY['CLEAN']::listings."IntegrityFlag"[],
    'PASSED',
    48,
    NOW(),
    NOW(),
    NOW()
  ),
  (
    gen_random_uuid(),
    'a1b2c3d4-e5f6-4a7b-8c9d-0e1f2a3b4c5d',
    'Sony PlayStation 5 - Disc Edition',
    'PS5 console with two DualSense controllers and 3 AAA games. Barely used, like new condition.',
    'GAMING_CONSOLE',
    'Sony',
    'PlayStation 5',
    449.99,
    'USD',
    'A',
    'ACTIVE',
    NULL,
    'PS5XYZ789ABC',
    ARRAY['CLEAN']::listings."IntegrityFlag"[],
    'PASSED',
    67,
    NOW(),
    NOW(),
    NOW()
  );

-- Show results
\echo ''
\echo '✅ Database seeded successfully!'
\echo ''
\echo '📊 Summary:'
SELECT 'Users created:' as metric, COUNT(*)::text as value FROM auth.users
UNION ALL
SELECT 'Profiles created:' as metric, COUNT(*)::text as value FROM users.profiles
UNION ALL
SELECT 'Listings created:' as metric, COUNT(*)::text as value FROM listings.listings;

\echo ''
\echo '👥 Test Credentials (all passwords: password123):'
SELECT email, role FROM auth.users ORDER BY role, email;

\echo ''
\echo '📱 Sample Listings:'
SELECT LEFT(title, 50) as title, brand, price FROM listings.listings ORDER BY created_at LIMIT 5;
