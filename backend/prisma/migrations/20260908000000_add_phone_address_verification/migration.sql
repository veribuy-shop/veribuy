-- AlterTable
ALTER TABLE "users"."profiles" ADD COLUMN IF NOT EXISTS "is_phone_verified" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "users"."profiles" ADD COLUMN IF NOT EXISTS "phone_verified_at" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "users"."addresses" ADD COLUMN IF NOT EXISTS "is_address_verified" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "users"."addresses" ADD COLUMN IF NOT EXISTS "address_verified_at" TIMESTAMP(3);
