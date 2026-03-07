-- CreateIndex
CREATE INDEX "evidence_items_pack_id_idx" ON "evidence_items"("pack_id");

-- CreateIndex
CREATE INDEX "evidence_items_type_idx" ON "evidence_items"("type");

-- CreateIndex
CREATE INDEX "evidence_items_created_at_idx" ON "evidence_items"("created_at");

-- CreateIndex
CREATE INDEX "evidence_packs_seller_id_idx" ON "evidence_packs"("seller_id");

-- CreateIndex
CREATE INDEX "evidence_packs_created_at_idx" ON "evidence_packs"("created_at");
