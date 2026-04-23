-- Add fulfillment step after a delivery note is saved (see lib/deliveries-service.ts).
-- Safe to run once; skip if the label already exists.

-- If `BEFORE` fails (e.g. enum order differs), use:
--   ALTER TYPE public.sales_order_fulfillment_status ADD VALUE IF NOT EXISTS 'delivery note created';

ALTER TYPE public.sales_order_fulfillment_status
  ADD VALUE IF NOT EXISTS 'delivery note created' BEFORE 'delivered to driver';
