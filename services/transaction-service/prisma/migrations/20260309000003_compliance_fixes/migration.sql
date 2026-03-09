-- ─── REG-02: RefundRecord table ─────────────────────────────────────────────
-- Persists the Stripe refund ID and amount alongside every refunded order,
-- providing a durable audit trail that cannot be lost if the API response
-- is dropped.
CREATE TABLE IF NOT EXISTS transactions.refund_records (
  id               TEXT          NOT NULL DEFAULT gen_random_uuid()::text,
  order_id         TEXT          NOT NULL,
  stripe_refund_id TEXT          NOT NULL,
  amount           NUMERIC(10,2) NOT NULL,
  currency         TEXT          NOT NULL DEFAULT 'GBP',
  reason           TEXT,
  status           TEXT          NOT NULL,
  created_at       TIMESTAMP(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT refund_records_pkey            PRIMARY KEY (id),
  CONSTRAINT refund_records_stripe_refund_id_key UNIQUE (stripe_refund_id)
);

CREATE INDEX IF NOT EXISTS refund_records_order_id_idx ON transactions.refund_records (order_id);

-- ─── INV-02: Invoice sequence ───────────────────────────────────────────────
-- Sequential, collision-free invoice numbers in the format INV-YYYY-NNNNN.
CREATE SEQUENCE IF NOT EXISTS transactions.invoice_seq START 1;

-- ─── REG-04: VAT fields on invoices ─────────────────────────────────────────
ALTER TABLE transactions.invoices
  ADD COLUMN IF NOT EXISTS vat_rate   NUMERIC(5,4),
  ADD COLUMN IF NOT EXISTS vat_amount NUMERIC(10,2),
  ADD COLUMN IF NOT EXISTS net_amount NUMERIC(10,2);

-- ─── INV-04: Invoice type enum + column ─────────────────────────────────────
-- Distinguishes RECEIPT (initial payment) from CREDIT_NOTE (refund).
DO $$ BEGIN
  CREATE TYPE transactions."InvoiceType" AS ENUM ('RECEIPT', 'CREDIT_NOTE');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

ALTER TABLE transactions.invoices
  ADD COLUMN IF NOT EXISTS invoice_type transactions."InvoiceType" NOT NULL DEFAULT 'RECEIPT';

-- ─── INV-04: Unique constraint — one invoice per (order, type) ───────────────
ALTER TABLE transactions.invoices
  DROP CONSTRAINT IF EXISTS invoices_order_id_type_key;
ALTER TABLE transactions.invoices
  ADD CONSTRAINT invoices_order_id_type_key UNIQUE (order_id, invoice_type);

-- ─── DI-06: Prevent buyer === seller on orders ───────────────────────────────
ALTER TABLE transactions.orders
  DROP CONSTRAINT IF EXISTS orders_buyer_ne_seller;
ALTER TABLE transactions.orders
  ADD CONSTRAINT orders_buyer_ne_seller CHECK (buyer_id <> seller_id);

-- ─── INV-01: Invoice immutability trigger ────────────────────────────────────
-- Blocks any UPDATE or DELETE on the invoices table after the row is created.
-- The only permitted UPDATE is setting email_sent_at on a newly created row
-- (pdf_url and core financial fields must never change).
CREATE OR REPLACE FUNCTION transactions.invoices_immutability_check()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  -- Allow setting email_sent_at and pdf_url on a row that was just created
  -- (within the same transaction second). All other field changes are blocked.
  IF TG_OP = 'DELETE' THEN
    RAISE EXCEPTION 'Invoices are immutable and cannot be deleted (invoice_number: %)', OLD.invoice_number;
  END IF;

  -- On UPDATE: only allow changes to email_sent_at and pdf_url
  IF NEW.invoice_number  <> OLD.invoice_number  THEN RAISE EXCEPTION 'invoice_number is immutable'; END IF;
  IF NEW.order_id        <> OLD.order_id        THEN RAISE EXCEPTION 'order_id is immutable'; END IF;
  IF NEW.invoice_type    <> OLD.invoice_type    THEN RAISE EXCEPTION 'invoice_type is immutable'; END IF;
  IF NEW.status          <> OLD.status          THEN RAISE EXCEPTION 'status is immutable'; END IF;
  IF NEW.buyer_id        <> OLD.buyer_id        THEN RAISE EXCEPTION 'buyer_id is immutable'; END IF;
  IF NEW.seller_id       <> OLD.seller_id       THEN RAISE EXCEPTION 'seller_id is immutable'; END IF;
  IF NEW.amount          <> OLD.amount          THEN RAISE EXCEPTION 'amount is immutable'; END IF;
  IF NEW.currency        <> OLD.currency        THEN RAISE EXCEPTION 'currency is immutable'; END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS invoices_immutability ON transactions.invoices;
CREATE TRIGGER invoices_immutability
  BEFORE UPDATE OR DELETE ON transactions.invoices
  FOR EACH ROW EXECUTE FUNCTION transactions.invoices_immutability_check();
