-- Update existing BUYER and SELLER roles to USER
-- This migration simplifies the role system to just USER and ADMIN

-- First, add the new USER enum value
ALTER TYPE auth."Role" ADD VALUE IF NOT EXISTS 'USER';

-- Update all BUYER users to USER
UPDATE auth.users SET role = 'USER' WHERE role = 'BUYER';

-- Update all SELLER users to USER  
UPDATE auth.users SET role = 'USER' WHERE role = 'SELLER';

-- Note: We cannot remove enum values in PostgreSQL without recreating the type
-- The old BUYER and SELLER values will remain in the enum but won't be used
-- To fully remove them, we would need to:
-- 1. Create a new enum type
-- 2. Alter the column to use the new type
-- 3. Drop the old type
-- This is optional and can be done later if needed

-- Verify the migration
SELECT role, COUNT(*) FROM auth.users GROUP BY role;
