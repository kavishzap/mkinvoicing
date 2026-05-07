-- Row Level Security: sales_orders + sales_order_items
-- Fix: other company members (not only the row creator) can list/view/edit company sales orders.
-- Mirrors: sql/patch_deliveries_rls.sql (owner OR public.company_users).
--
-- Run in Supabase SQL after tables exist. If you still get 42501, list policies with:
--   SELECT * FROM pg_policies WHERE tablename IN ('sales_orders', 'sales_order_items');

-- ---------------------------------------------------------------------------
-- sales_orders
-- ---------------------------------------------------------------------------
ALTER TABLE public.sales_orders ENABLE ROW LEVEL SECURITY;

DO $$
DECLARE pol RECORD;
BEGIN
  FOR pol IN
    SELECT policyname
    FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'sales_orders'
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.sales_orders', pol.policyname);
  END LOOP;
END $$;

CREATE POLICY "sales_orders_select_member"
  ON public.sales_orders
  FOR SELECT
  TO authenticated
  USING (
    company_id IN (
      SELECT c.id
      FROM public.companies c
      WHERE c.owner_user_id = auth.uid()
        AND c.is_active = true
    )
    OR company_id IN (
      SELECT cu.company_id
      FROM public.company_users cu
      WHERE cu.user_id = auth.uid()
        AND cu.is_active = true
    )
  );

CREATE POLICY "sales_orders_insert_member"
  ON public.sales_orders
  FOR INSERT
  TO authenticated
  WITH CHECK (
    company_id IN (
      SELECT c.id
      FROM public.companies c
      WHERE c.owner_user_id = auth.uid()
        AND c.is_active = true
    )
    OR company_id IN (
      SELECT cu.company_id
      FROM public.company_users cu
      WHERE cu.user_id = auth.uid()
        AND cu.is_active = true
    )
  );

CREATE POLICY "sales_orders_update_member"
  ON public.sales_orders
  FOR UPDATE
  TO authenticated
  USING (
    company_id IN (
      SELECT c.id
      FROM public.companies c
      WHERE c.owner_user_id = auth.uid()
        AND c.is_active = true
    )
    OR company_id IN (
      SELECT cu.company_id
      FROM public.company_users cu
      WHERE cu.user_id = auth.uid()
        AND cu.is_active = true
    )
  )
  WITH CHECK (
    company_id IN (
      SELECT c.id
      FROM public.companies c
      WHERE c.owner_user_id = auth.uid()
        AND c.is_active = true
    )
    OR company_id IN (
      SELECT cu.company_id
      FROM public.company_users cu
      WHERE cu.user_id = auth.uid()
        AND cu.is_active = true
    )
  );

CREATE POLICY "sales_orders_delete_member"
  ON public.sales_orders
  FOR DELETE
  TO authenticated
  USING (
    company_id IN (
      SELECT c.id
      FROM public.companies c
      WHERE c.owner_user_id = auth.uid()
        AND c.is_active = true
    )
    OR company_id IN (
      SELECT cu.company_id
      FROM public.company_users cu
      WHERE cu.user_id = auth.uid()
        AND cu.is_active = true
    )
  );

-- ---------------------------------------------------------------------------
-- sales_order_items (access via parent order’s company)
-- ---------------------------------------------------------------------------
ALTER TABLE public.sales_order_items ENABLE ROW LEVEL SECURITY;

DO $$
DECLARE pol RECORD;
BEGIN
  FOR pol IN
    SELECT policyname
    FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'sales_order_items'
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.sales_order_items', pol.policyname);
  END LOOP;
END $$;

CREATE POLICY "sales_order_items_select_member"
  ON public.sales_order_items
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.sales_orders so
      WHERE so.id = sales_order_items.sales_order_id
        AND (
          so.company_id IN (
            SELECT c.id
            FROM public.companies c
            WHERE c.owner_user_id = auth.uid()
              AND c.is_active = true
          )
          OR so.company_id IN (
            SELECT cu.company_id
            FROM public.company_users cu
            WHERE cu.user_id = auth.uid()
              AND cu.is_active = true
          )
        )
    )
  );

CREATE POLICY "sales_order_items_insert_member"
  ON public.sales_order_items
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.sales_orders so
      WHERE so.id = sales_order_items.sales_order_id
        AND (
          so.company_id IN (
            SELECT c.id
            FROM public.companies c
            WHERE c.owner_user_id = auth.uid()
              AND c.is_active = true
          )
          OR so.company_id IN (
            SELECT cu.company_id
            FROM public.company_users cu
            WHERE cu.user_id = auth.uid()
              AND cu.is_active = true
          )
        )
    )
  );

CREATE POLICY "sales_order_items_update_member"
  ON public.sales_order_items
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.sales_orders so
      WHERE so.id = sales_order_items.sales_order_id
        AND (
          so.company_id IN (
            SELECT c.id
            FROM public.companies c
            WHERE c.owner_user_id = auth.uid()
              AND c.is_active = true
          )
          OR so.company_id IN (
            SELECT cu.company_id
            FROM public.company_users cu
            WHERE cu.user_id = auth.uid()
              AND cu.is_active = true
          )
        )
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.sales_orders so
      WHERE so.id = sales_order_items.sales_order_id
        AND (
          so.company_id IN (
            SELECT c.id
            FROM public.companies c
            WHERE c.owner_user_id = auth.uid()
              AND c.is_active = true
          )
          OR so.company_id IN (
            SELECT cu.company_id
            FROM public.company_users cu
            WHERE cu.user_id = auth.uid()
              AND cu.is_active = true
          )
        )
    )
  );

CREATE POLICY "sales_order_items_delete_member"
  ON public.sales_order_items
  FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.sales_orders so
      WHERE so.id = sales_order_items.sales_order_id
        AND (
          so.company_id IN (
            SELECT c.id
            FROM public.companies c
            WHERE c.owner_user_id = auth.uid()
              AND c.is_active = true
          )
          OR so.company_id IN (
            SELECT cu.company_id
            FROM public.company_users cu
            WHERE cu.user_id = auth.uid()
              AND cu.is_active = true
          )
        )
    )
  );
