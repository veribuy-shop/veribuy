-- AlterEnum: Replace USER with BUYER/SELLER
BEGIN;
CREATE TYPE "auth"."Role_new" AS ENUM ('BUYER', 'SELLER', 'ADMIN');
ALTER TABLE "auth"."users" ALTER COLUMN "role" DROP DEFAULT;
ALTER TABLE "auth"."users" ALTER COLUMN "role" TYPE "auth"."Role_new" USING (
  CASE "role"::text
    WHEN 'USER' THEN 'BUYER'
    ELSE "role"::text
  END::"auth"."Role_new"
);
ALTER TYPE "auth"."Role" RENAME TO "Role_old";
ALTER TYPE "auth"."Role_new" RENAME TO "Role";
DROP TYPE "auth"."Role_old";
ALTER TABLE "auth"."users" ALTER COLUMN "role" SET DEFAULT 'BUYER';
COMMIT;

-- AlterTable: Add deleted_at column
ALTER TABLE "auth"."users" ADD COLUMN IF NOT EXISTS "deleted_at" TIMESTAMP(3);

-- CreateIndex: Index on deleted_at
CREATE INDEX IF NOT EXISTS "users_deleted_at_idx" ON "auth"."users"("deleted_at");
