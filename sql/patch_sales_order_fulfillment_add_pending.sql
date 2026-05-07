-- Optional: add early pipeline fulfillment status (must match app + src/types/supabase.ts).
-- Safe to run once per database; IF NOT EXISTS avoids errors on re-run.

ALTER TYPE public.sales_order_fulfillment_status
  ADD VALUE IF NOT EXISTS 'pending';
