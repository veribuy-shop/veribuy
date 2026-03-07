-- CreateEnum
CREATE TYPE "ConditionGrade" AS ENUM ('A', 'B', 'C');

-- CreateEnum
CREATE TYPE "DeviceType" AS ENUM ('SMARTPHONE', 'TABLET', 'LAPTOP', 'SMARTWATCH', 'DESKTOP', 'GAMING_CONSOLE', 'OTHER');

-- CreateEnum
CREATE TYPE "IntegrityFlag" AS ENUM ('CLEAN', 'IMEI_MISMATCH', 'ICLOUD_LOCKED', 'REPORTED_STOLEN', 'BLACKLISTED', 'SERIAL_MISMATCH');

-- CreateEnum
CREATE TYPE "ListingStatus" AS ENUM ('DRAFT', 'SUBMITTED', 'UNDER_REVIEW', 'APPROVED', 'REJECTED', 'ACTIVE', 'SOLD', 'DELISTED');

-- CreateEnum
CREATE TYPE "TrustLensStatus" AS ENUM ('PENDING', 'IN_PROGRESS', 'PASSED', 'FAILED', 'REQUIRES_REVIEW');

-- CreateTable
CREATE TABLE "listings" (
    "id" TEXT NOT NULL,
    "seller_id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "device_type" "DeviceType" NOT NULL,
    "brand" TEXT NOT NULL,
    "model" TEXT NOT NULL,
    "price" DECIMAL(10,2) NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'USD',
    "condition_grade" "ConditionGrade",
    "status" "ListingStatus" NOT NULL DEFAULT 'DRAFT',
    "imei" TEXT,
    "serial_number" TEXT,
    "integrity_flags" "IntegrityFlag"[],
    "trust_lens_status" "TrustLensStatus" NOT NULL DEFAULT 'PENDING',
    "view_count" INTEGER NOT NULL DEFAULT 0,
    "published_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "listings_pkey" PRIMARY KEY ("id")
);
