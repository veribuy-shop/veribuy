-- CreateIndex
CREATE INDEX "profiles_verification_status_idx" ON "profiles"("verification_status");

-- CreateIndex
CREATE INDEX "profiles_seller_rating_idx" ON "profiles"("seller_rating");

-- CreateIndex
CREATE INDEX "profiles_created_at_idx" ON "profiles"("created_at");
