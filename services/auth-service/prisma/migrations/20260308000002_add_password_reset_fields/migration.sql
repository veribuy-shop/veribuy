-- AlterTable: Add password reset token and expiry fields
ALTER TABLE "auth"."users"
  ADD COLUMN IF NOT EXISTS "password_reset_token"  TEXT,
  ADD COLUMN IF NOT EXISTS "password_reset_expiry" TIMESTAMP(3);

-- CreateIndex: fast lookup by token
CREATE INDEX IF NOT EXISTS "users_password_reset_token_idx" ON "auth"."users"("password_reset_token");
