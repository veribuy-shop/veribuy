-- AlterTable: Add email verification token and expiry fields
ALTER TABLE "auth"."users"
  ADD COLUMN IF NOT EXISTS "email_verification_token"  TEXT,
  ADD COLUMN IF NOT EXISTS "email_verification_expiry" TIMESTAMP(3);

-- CreateIndex: fast lookup by token
CREATE INDEX IF NOT EXISTS "users_email_verification_token_idx" ON "auth"."users"("email_verification_token");
