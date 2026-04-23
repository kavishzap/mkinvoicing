-- Delivery note lifecycle on public.deliveries (independent of sales_orders rows).
-- Values: new → delivered_to_driver → completed
-- Run after create_deliveries_tables.sql / existing deliveries table.

DO $migration$
BEGIN
  CREATE TYPE public.delivery_note_status AS ENUM (
    'new',
    'delivered_to_driver',
    'completed'
  );
EXCEPTION
  WHEN duplicate_object THEN NULL;
END
$migration$;

ALTER TABLE public.deliveries
  ADD COLUMN IF NOT EXISTS status public.delivery_note_status NOT NULL DEFAULT 'new';

COMMENT ON COLUMN public.deliveries.status IS
  'Delivery note state: New, then handed to driver (delivered_to_driver), then completed.';
