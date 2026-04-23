-- Deliveries: batch assign sales orders (fulfillment = new) to a driver (company team user).
-- After insert, your app should in one transaction:
--   UPDATE sales_orders SET fulfillment_status = 'delivery note created', updated_at = now()
--   WHERE id IN (SELECT sales_order_id FROM delivery_sales_orders WHERE delivery_id = :id)
--     AND company_id = :company_id AND fulfillment_status = 'new';
--
-- Driver picker: filter company_users for this company where company_roles.name ILIKE '%driver%'.

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

-- ---------------------------------------------------------------------------
-- 1) Header: one delivery run, assigned driver, audit
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.deliveries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),

  company_id uuid NOT NULL
    REFERENCES public.companies (id) ON DELETE CASCADE,

  -- Assigned driver = auth user id of the team member (company_users.user_id)
  driver_user_id uuid NOT NULL
    REFERENCES auth.users (id) ON DELETE RESTRICT,

  -- User who created the delivery record (auth.uid() at save time)
  created_by uuid NOT NULL
    REFERENCES auth.users (id) ON DELETE RESTRICT,

  notes text NULL,

  status public.delivery_note_status NOT NULL DEFAULT 'new',

  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_deliveries_company_created
  ON public.deliveries (company_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_deliveries_driver
  ON public.deliveries (driver_user_id);

COMMENT ON TABLE public.deliveries IS
  'Outbound delivery batch; lines in delivery_sales_orders. Set sales_orders.fulfillment_status to delivered to driver on save.';

COMMENT ON COLUMN public.deliveries.driver_user_id IS
  'auth.users.id of the driver (member with Driver role on company team).';

COMMENT ON COLUMN public.deliveries.created_by IS
  'auth.users.id of the user who saved this delivery.';

-- ---------------------------------------------------------------------------
-- 2) Lines: which sales orders are on this delivery
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.delivery_sales_orders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),

  delivery_id uuid NOT NULL
    REFERENCES public.deliveries (id) ON DELETE CASCADE,

  sales_order_id uuid NOT NULL
    REFERENCES public.sales_orders (id) ON DELETE RESTRICT,

  created_at timestamptz NOT NULL DEFAULT now(),

  UNIQUE (delivery_id, sales_order_id)
);

CREATE INDEX IF NOT EXISTS idx_delivery_sales_orders_delivery
  ON public.delivery_sales_orders (delivery_id);

CREATE INDEX IF NOT EXISTS idx_delivery_sales_orders_sales_order
  ON public.delivery_sales_orders (sales_order_id);

COMMENT ON TABLE public.delivery_sales_orders IS
  'Sales orders included in a delivery. Enforce “only new SOs” and “one active delivery per SO” in application logic or add a partial unique index when you add a delivery status column.';

COMMENT ON COLUMN public.delivery_sales_orders.sales_order_id IS
  'Only rows with fulfillment_status = new should be inserted; app updates to delivery note created after commit.';

-- Keep deliveries.updated_at in sync when lines change (optional)
CREATE OR REPLACE FUNCTION public.touch_deliveries_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  UPDATE public.deliveries
  SET updated_at = now()
  WHERE id = COALESCE(NEW.delivery_id, OLD.delivery_id);
  RETURN COALESCE(NEW, OLD);
END;
$$;

DROP TRIGGER IF EXISTS trg_delivery_sales_orders_touch_delivery ON public.delivery_sales_orders;
CREATE TRIGGER trg_delivery_sales_orders_touch_delivery
  AFTER INSERT OR UPDATE OR DELETE ON public.delivery_sales_orders
  FOR EACH ROW
  EXECUTE PROCEDURE public.touch_deliveries_updated_at();

-- ---------------------------------------------------------------------------
-- Row Level Security: run sql/patch_deliveries_rls.sql in Supabase (required for
-- browser/anon key inserts; otherwise POST /rest/v1/deliveries returns 403).
-- ---------------------------------------------------------------------------
