-- CreateIndex: Composite index on recipient_id + is_read for fast unread query performance
CREATE INDEX IF NOT EXISTS "messages_recipient_id_is_read_idx" ON "notifications"."messages"("recipient_id", "is_read");
