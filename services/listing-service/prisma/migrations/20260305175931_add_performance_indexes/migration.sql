-- CreateIndex
CREATE INDEX "listings_seller_id_idx" ON "listings"("seller_id");

-- CreateIndex
CREATE INDEX "listings_status_idx" ON "listings"("status");

-- CreateIndex
CREATE INDEX "listings_device_type_idx" ON "listings"("device_type");

-- CreateIndex
CREATE INDEX "listings_trust_lens_status_idx" ON "listings"("trust_lens_status");

-- CreateIndex
CREATE INDEX "listings_published_at_idx" ON "listings"("published_at");

-- CreateIndex
CREATE INDEX "listings_created_at_idx" ON "listings"("created_at");

-- CreateIndex
CREATE INDEX "listings_seller_id_status_idx" ON "listings"("seller_id", "status");

-- CreateIndex
CREATE INDEX "listings_device_type_status_idx" ON "listings"("device_type", "status");
