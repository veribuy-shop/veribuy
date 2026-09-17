-- CreateEnum
CREATE TYPE "listings"."ListingFormat" AS ENUM ('FIXED_PRICE', 'AUCTION');

-- AlterEnum
ALTER TYPE "listings"."ListingStatus" ADD VALUE 'AUCTION_ENDED';

-- AlterTable
ALTER TABLE "listings"."listings" 
ADD COLUMN     "format" "listings"."ListingFormat" NOT NULL DEFAULT 'FIXED_PRICE',
ADD COLUMN     "starting_bid" DECIMAL(10,2),
ADD COLUMN     "reserve_price" DECIMAL(10,2),
ADD COLUMN     "current_bid" DECIMAL(10,2),
ADD COLUMN     "bid_count" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "highest_bidder_id" TEXT,
ADD COLUMN     "highest_max_bid" DECIMAL(10,2),
ADD COLUMN     "auction_ends_at" TIMESTAMP(3),
ADD COLUMN     "buy_it_now_price" DECIMAL(10,2);

-- CreateTable
CREATE TABLE "listings"."bids" (
    "id" TEXT NOT NULL,
    "listing_id" TEXT NOT NULL,
    "bidder_id" TEXT NOT NULL,
    "amount" DECIMAL(10,2) NOT NULL,
    "max_bid" DECIMAL(10,2),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "bids_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "listings_format_status_idx" ON "listings"."listings"("format", "status");
CREATE INDEX "listings_auction_ends_at_idx" ON "listings"."listings"("auction_ends_at");

-- CreateIndex
CREATE INDEX "bids_listing_id_idx" ON "listings"."bids"("listing_id");
CREATE INDEX "bids_bidder_id_idx" ON "listings"."bids"("bidder_id");
CREATE INDEX "bids_listing_id_amount_idx" ON "listings"."bids"("listing_id", "amount" DESC);

-- AddForeignKey
ALTER TABLE "listings"."bids" ADD CONSTRAINT "bids_listing_id_fkey" FOREIGN KEY ("listing_id") REFERENCES "listings"."listings"("id") ON DELETE CASCADE ON UPDATE CASCADE;
