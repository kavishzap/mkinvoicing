-- Row Level Security for deliveries + delivery_sales_orders
-- Run in Supabase SQL Editor after tables exist.
-- Fixes: 42501 "new row violates row-level security policy for table deliveries"

-- ---------------------------------------------------------------------------
-- deliveries
-- ---------------------------------------------------------------------------
ALTER TABLE public.deliveries ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "deliveries_select_member" ON public.deliveries;
DROP POLICY IF EXISTS "deliveries_insert_member" ON public.deliveries;
DROP POLICY IF EXISTS "deliveries_update_member" ON public.deliveries;
DROP POLICY IF EXISTS "deliveries_delete_member" ON public.deliveries;

-- Companies the signed-in user may act for (owner or active company member)
CREATE POLICY "deliveries_select_member"
  ON public.deliveries
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

CREATE POLICY "deliveries_insert_member"
  ON public.deliveries
  FOR INSERT
  TO authenticated
  WITH CHECK (
    (
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
    AND created_by = auth.uid()
    AND (
      EXISTS (
        SELECT 1
        FROM public.company_users d
        WHERE d.company_id = company_id
          AND d.user_id = driver_user_id
          AND d.is_active = true
      )
      OR EXISTS (
        SELECT 1
        FROM public.companies o
        WHERE o.id = company_id
          AND o.owner_user_id = driver_user_id
          AND o.is_active = true
      )
    )
  );

CREATE POLICY "deliveries_update_member"
  ON public.deliveries
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

CREATE POLICY "deliveries_delete_member"
  ON public.deliveries
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
-- delivery_sales_orders (lines + trigger that updates parent.updated_at)
-- ---------------------------------------------------------------------------
ALTER TABLE public.delivery_sales_orders ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "delivery_sales_orders_select_member" ON public.delivery_sales_orders;
DROP POLICY IF EXISTS "delivery_sales_orders_insert_member" ON public.delivery_sales_orders;
DROP POLICY IF EXISTS "delivery_sales_orders_update_member" ON public.delivery_sales_orders;
DROP POLICY IF EXISTS "delivery_sales_orders_delete_member" ON public.delivery_sales_orders;

CREATE POLICY "delivery_sales_orders_select_member"
  ON public.delivery_sales_orders
  FOR SELECT
  TO authenticated
  USING (
    delivery_id IN (
      SELECT d.id
      FROM public.deliveries d
      WHERE d.company_id IN (
          SELECT c.id
          FROM public.companies c
          WHERE c.owner_user_id = auth.uid()
            AND c.is_active = true
        )
        OR d.company_id IN (
          SELECT cu.company_id
          FROM public.company_users cu
          WHERE cu.user_id = auth.uid()
            AND cu.is_active = true
        )
    )
  );

CREATE POLICY "delivery_sales_orders_insert_member"
  ON public.delivery_sales_orders
  FOR INSERT
  TO authenticated
  WITH CHECK (
    delivery_id IN (
      SELECT d.id
      FROM public.deliveries d
      WHERE d.company_id IN (
          SELECT c.id
          FROM public.companies c
          WHERE c.owner_user_id = auth.uid()
            AND c.is_active = true
        )
        OR d.company_id IN (
          SELECT cu.company_id
          FROM public.company_users cu
          WHERE cu.user_id = auth.uid()
            AND cu.is_active = true
        )
    )
  );

CREATE POLICY "delivery_sales_orders_update_member"
  ON public.delivery_sales_orders
  FOR UPDATE
  TO authenticated
  USING (
    delivery_id IN (
      SELECT d.id
      FROM public.deliveries d
      WHERE d.company_id IN (
          SELECT c.id
          FROM public.companies c
          WHERE c.owner_user_id = auth.uid()
            AND c.is_active = true
        )
        OR d.company_id IN (
          SELECT cu.company_id
          FROM public.company_users cu
          WHERE cu.user_id = auth.uid()
            AND cu.is_active = true
        )
    )
  )
  WITH CHECK (
    delivery_id IN (
      SELECT d.id
      FROM public.deliveries d
      WHERE d.company_id IN (
          SELECT c.id
          FROM public.companies c
          WHERE c.owner_user_id = auth.uid()
            AND c.is_active = true
        )
        OR d.company_id IN (
          SELECT cu.company_id
          FROM public.company_users cu
          WHERE cu.user_id = auth.uid()
            AND cu.is_active = true
        )
    )
  );

CREATE POLICY "delivery_sales_orders_delete_member"
  ON public.delivery_sales_orders
  FOR DELETE
  TO authenticated
  USING (
    delivery_id IN (
      SELECT d.id
      FROM public.deliveries d
      WHERE d.company_id IN (
          SELECT c.id
          FROM public.companies c
          WHERE c.owner_user_id = auth.uid()
            AND c.is_active = true
        )
        OR d.company_id IN (
          SELECT cu.company_id
          FROM public.company_users cu
          WHERE cu.user_id = auth.uid()
            AND cu.is_active = true
        )
    )
  );
