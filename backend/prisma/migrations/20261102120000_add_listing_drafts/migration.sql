-- CreateTable
CREATE TABLE "listing_drafts" (
    "user_id" TEXT NOT NULL,
    "data" JSONB NOT NULL,
    "step" INTEGER NOT NULL DEFAULT 1,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "listing_drafts_pkey" PRIMARY KEY ("user_id")
);

-- AddForeignKey
ALTER TABLE "listing_drafts" ADD CONSTRAINT "listing_drafts_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
