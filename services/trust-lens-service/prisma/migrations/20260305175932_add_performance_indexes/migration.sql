-- CreateIndex
CREATE INDEX "evidence_checklists_verification_request_id_idx" ON "evidence_checklists"("verification_request_id");

-- CreateIndex
CREATE INDEX "evidence_checklists_fulfilled_idx" ON "evidence_checklists"("fulfilled");

-- CreateIndex
CREATE INDEX "verification_requests_seller_id_idx" ON "verification_requests"("seller_id");

-- CreateIndex
CREATE INDEX "verification_requests_status_idx" ON "verification_requests"("status");

-- CreateIndex
CREATE INDEX "verification_requests_created_at_idx" ON "verification_requests"("created_at");

-- CreateIndex
CREATE INDEX "verification_requests_status_created_at_idx" ON "verification_requests"("status", "created_at");
