-- Create invoices table to track per-status-change invoice documents
CREATE TABLE IF NOT EXISTS transactions.invoices (
  id             TEXT        NOT NULL DEFAULT gen_random_uuid()::text,
  order_id       TEXT        NOT NULL,
  invoice_number TEXT        NOT NULL,
  status         TEXT        NOT NULL,
  buyer_id       TEXT        NOT NULL,
  seller_id      TEXT        NOT NULL,
  amount         NUMERIC(10,2) NOT NULL,
  currency       TEXT        NOT NULL DEFAULT 'GBP',
  pdf_url        TEXT,
  email_sent_at  TIMESTAMP(3),
  created_at     TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at     TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT invoices_pkey PRIMARY KEY (id),
  CONSTRAINT invoices_invoice_number_key UNIQUE (invoice_number)
);

CREATE INDEX IF NOT EXISTS invoices_order_id_idx    ON transactions.invoices (order_id);
CREATE INDEX IF NOT EXISTS invoices_buyer_id_idx    ON transactions.invoices (buyer_id);
CREATE INDEX IF NOT EXISTS invoices_seller_id_idx   ON transactions.invoices (seller_id);
CREATE INDEX IF NOT EXISTS invoices_created_at_idx  ON transactions.invoices (created_at);
