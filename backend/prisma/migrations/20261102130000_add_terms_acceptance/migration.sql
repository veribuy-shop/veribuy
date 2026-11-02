-- Records when each person accepted the Terms and Privacy Policy, and which version.
ALTER TABLE "users" ADD COLUMN "terms_accepted_at" TIMESTAMP(3),
ADD COLUMN "terms_version" TEXT;
