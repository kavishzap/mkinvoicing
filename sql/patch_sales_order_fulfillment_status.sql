-- Enum public.sales_order_fulfillment_status + column sales_orders.fulfillment_status
-- Must match: lib/sales-orders-service.ts → SALES_ORDER_FULFILLMENT_STATUSES

DO $migration$
BEGIN
  CREATE TYPE public.sales_order_fulfillment_status AS ENUM (
    'new',
    'delivery note created',
    'delivered to driver',
    'delivered to customer',
    'cancelled',
    'Rescheduled'
  );
EXCEPTION
  WHEN duplicate_object THEN NULL;
END
$migration$;

ALTER TABLE public.sales_orders
  ADD COLUMN IF NOT EXISTS fulfillment_status public.sales_order_fulfillment_status
  NOT NULL DEFAULT 'new';

-- If you already had an older enum, migrate data then drop/recreate the type in a
-- dedicated migration; do not run CREATE TYPE above twice with different labels.
