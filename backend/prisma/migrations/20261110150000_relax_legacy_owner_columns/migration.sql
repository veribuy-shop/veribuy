-- Databases created before the single-schema consolidation still carry owner
-- columns the application no longer writes (the owner is reached through the
-- listing or the order). They were NOT NULL, so every insert into these tables
-- failed. Databases created afterwards never had them, hence the existence check.
DO $$
DECLARE
  legacy RECORD;
BEGIN
  FOR legacy IN
    SELECT * FROM (VALUES
      ('evidence_packs', 'seller_id'),
      ('verification_requests', 'seller_id'),
      ('ratings', 'buyer_id'),
      ('ratings', 'seller_id')
    ) AS t(table_name, column_name)
  LOOP
    IF EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name = legacy.table_name
        AND column_name = legacy.column_name
    ) THEN
      EXECUTE format('ALTER TABLE %I ALTER COLUMN %I DROP NOT NULL', legacy.table_name, legacy.column_name);
    END IF;
  END LOOP;
END $$;
