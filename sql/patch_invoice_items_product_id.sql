-- =============================================================================
-- Invoice line items: optional catalog product (same pattern as sales_order_items)
-- =============================================================================
-- Run in Supabase SQL editor or via migration.
-- After this, regenerate types (e.g. supabase gen types) and extend create_invoice /
-- app payloads to pass product_id per line when saving.

ALTER TABLE public.invoice_items
  ADD COLUMN IF NOT EXISTS product_id uuid NULL;

ALTER TABLE public.invoice_items
  DROP CONSTRAINT IF EXISTS invoice_items_product_id_fkey;

ALTER TABLE public.invoice_items
  ADD CONSTRAINT invoice_items_product_id_fkey
  FOREIGN KEY (product_id)
  REFERENCES public.products (id)
  ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS invoice_items_product_id_idx
  ON public.invoice_items USING btree (product_id)
  WHERE product_id IS NOT NULL;

-- =============================================================================
-- Invoices: payment_method CHECK — align with app (Cash, Card, Bank Transfer)
-- =============================================================================
-- Your current check only allows Cash / Card Payment / Credit Facilities.
-- 1) Normalize legacy values so the new CHECK can be applied.
-- 2) Replace the constraint.

UPDATE public.invoices
SET payment_method = NULL
WHERE payment_method IS NOT NULL
  AND payment_method NOT IN ('Cash', 'Card Payment', 'Bank Transfer');

ALTER TABLE public.invoices
  DROP CONSTRAINT IF EXISTS invoices_payment_method_check;

ALTER TABLE public.invoices
  ADD CONSTRAINT invoices_payment_method_check
  CHECK (
    payment_method IS NULL
    OR payment_method = ANY (
      ARRAY[
        'Cash'::text,
        'Card Payment'::text,
        'Bank Transfer'::text
      ]
    )
  );
