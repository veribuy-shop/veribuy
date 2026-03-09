-- Add listing snapshot fields to orders for invoice generation
ALTER TABLE transactions.orders
  ADD COLUMN IF NOT EXISTS listing_title       TEXT,
  ADD COLUMN IF NOT EXISTS listing_description TEXT,
  ADD COLUMN IF NOT EXISTS listing_category    TEXT;
