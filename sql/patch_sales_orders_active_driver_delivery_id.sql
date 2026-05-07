-- Tracks which delivery run currently holds driver-side stock for a sales order.
-- Survives Rescheduled (and missing delivery_sales_orders rows) so the order still
-- appears on that delivery for reconciliation / driver balance. Cleared when the
-- order is delivered to customer, completed, or cancelled (see app updates).

ALTER TABLE public.sales_orders
  ADD COLUMN IF NOT EXISTS active_driver_delivery_id uuid NULL
    REFERENCES public.deliveries (id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_sales_orders_active_driver_delivery
  ON public.sales_orders (company_id, active_driver_delivery_id)
  WHERE active_driver_delivery_id IS NOT NULL;

COMMENT ON COLUMN public.sales_orders.active_driver_delivery_id IS
  'Delivery note that handed stock to the driver for this order; set when status moves to Delivered to driver, cleared on Delivered to customer / completed / cancelled.';

-- Optional backfill after adding the column (run once if you already have driver trips in flight):
-- UPDATE public.sales_orders so
-- SET active_driver_delivery_id = dso.delivery_id
-- FROM public.delivery_sales_orders dso
-- WHERE dso.sales_order_id = so.id
--   AND so.active_driver_delivery_id IS NULL
--   AND so.fulfillment_status IN (
--     'delivered to driver',
--     'delivery note created',
--     'rescheduled',
--     'pending'
--   );
