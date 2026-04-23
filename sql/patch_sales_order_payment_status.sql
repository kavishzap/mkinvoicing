-- Payment tracking on sales orders (default unpaid on new rows).
ALTER TABLE public.sales_orders
  ADD COLUMN IF NOT EXISTS payment_status text NOT NULL DEFAULT 'unpaid';

ALTER TABLE public.sales_orders
  DROP CONSTRAINT IF EXISTS sales_orders_payment_status_check;

ALTER TABLE public.sales_orders
  ADD CONSTRAINT sales_orders_payment_status_check
  CHECK (payment_status IN ('unpaid', 'paid', 'partial'));

COMMENT ON COLUMN public.sales_orders.payment_status IS 'unpaid | paid | partial';
