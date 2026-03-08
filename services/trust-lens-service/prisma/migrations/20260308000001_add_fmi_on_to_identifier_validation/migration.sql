-- AlterTable: Add fmi_on field to identifier_validations
ALTER TABLE "trust_lens"."identifier_validations"
  ADD COLUMN IF NOT EXISTS "fmi_on" BOOLEAN;
