-- Terminal fulfillment label stored on some rows (see lib/sales-orders-service.ts).
-- Safe to run once.

ALTER TYPE public.sales_order_fulfillment_status
  ADD VALUE IF NOT EXISTS 'completed';
