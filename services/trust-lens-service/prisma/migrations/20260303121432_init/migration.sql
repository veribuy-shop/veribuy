-- CreateEnum
CREATE TYPE "ReviewStatus" AS ENUM ('PENDING', 'IN_PROGRESS', 'PASSED', 'FAILED', 'REQUIRES_REVIEW');

-- CreateEnum
CREATE TYPE "ConditionGrade" AS ENUM ('A', 'B', 'C');

-- CreateEnum
CREATE TYPE "IntegrityFlag" AS ENUM ('CLEAN', 'IMEI_MISMATCH', 'ICLOUD_LOCKED', 'REPORTED_STOLEN', 'BLACKLISTED', 'SERIAL_MISMATCH');

-- CreateEnum
CREATE TYPE "EvidenceType" AS ENUM ('IMAGE', 'VIDEO', 'SCREENSHOT', 'DOCUMENT');

-- CreateTable
CREATE TABLE "verification_requests" (
    "id" TEXT NOT NULL,
    "listing_id" TEXT NOT NULL,
    "seller_id" TEXT NOT NULL,
    "status" "ReviewStatus" NOT NULL DEFAULT 'PENDING',
    "condition_grade" "ConditionGrade",
    "integrity_flags" "IntegrityFlag"[],
    "review_notes" TEXT,
    "completed_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "verification_requests_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "evidence_checklists" (
    "id" TEXT NOT NULL,
    "verification_request_id" TEXT NOT NULL,
    "type" "EvidenceType" NOT NULL,
    "description" TEXT NOT NULL,
    "required" BOOLEAN NOT NULL DEFAULT true,
    "fulfilled" BOOLEAN NOT NULL DEFAULT false,
    "fulfilled_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "evidence_checklists_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "identifier_validations" (
    "id" TEXT NOT NULL,
    "verification_request_id" TEXT NOT NULL,
    "imei_provided" BOOLEAN NOT NULL DEFAULT false,
    "imei_valid" BOOLEAN,
    "serial_provided" BOOLEAN NOT NULL DEFAULT false,
    "serial_valid" BOOLEAN,
    "icloud_locked" BOOLEAN,
    "reported_stolen" BOOLEAN,
    "blacklisted" BOOLEAN,
    "verified_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "identifier_validations_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "verification_requests_listing_id_key" ON "verification_requests"("listing_id");

-- CreateIndex
CREATE UNIQUE INDEX "identifier_validations_verification_request_id_key" ON "identifier_validations"("verification_request_id");

-- AddForeignKey
ALTER TABLE "evidence_checklists" ADD CONSTRAINT "evidence_checklists_verification_request_id_fkey" FOREIGN KEY ("verification_request_id") REFERENCES "verification_requests"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "identifier_validations" ADD CONSTRAINT "identifier_validations_verification_request_id_fkey" FOREIGN KEY ("verification_request_id") REFERENCES "verification_requests"("id") ON DELETE CASCADE ON UPDATE CASCADE;
