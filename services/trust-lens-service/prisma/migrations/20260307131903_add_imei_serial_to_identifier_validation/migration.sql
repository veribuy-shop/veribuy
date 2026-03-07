-- AlterTable
ALTER TABLE "identifier_validations" ADD COLUMN     "imei" TEXT,
ADD COLUMN     "raw_api_response" JSONB,
ADD COLUMN     "serial_number" TEXT;
