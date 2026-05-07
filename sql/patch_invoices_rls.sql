-- Row Level Security: invoices + invoice_items
-- Fix: all active company members (not only the invoice creator) can list/view/edit invoices for that company_id.
-- Mirrors: sql/patch_sales_orders_rls.sql and sql/patch_deliveries_rls.sql.
--
-- Run in Supabase SQL after tables exist. If you still get 42501, list policies with:
--   SELECT * FROM pg_policies WHERE tablename IN ('invoices', 'invoice_items');

-- ---------------------------------------------------------------------------
-- invoices
-- ---------------------------------------------------------------------------
ALTER TABLE public.invoices ENABLE ROW LEVEL SECURITY;

DO $$
DECLARE pol RECORD;
BEGIN
  FOR pol IN
    SELECT policyname
    FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'invoices'
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.invoices', pol.policyname);
  END LOOP;
END $$;

CREATE POLICY "invoices_select_member"
  ON public.invoices
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

CREATE POLICY "invoices_insert_member"
  ON public.invoices
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

CREATE POLICY "invoices_update_member"
  ON public.invoices
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

CREATE POLICY "invoices_delete_member"
  ON public.invoices
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
-- invoice_items (access via parent invoice’s company)
-- ---------------------------------------------------------------------------
ALTER TABLE public.invoice_items ENABLE ROW LEVEL SECURITY;

DO $$
DECLARE pol RECORD;
BEGIN
  FOR pol IN
    SELECT policyname
    FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'invoice_items'
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.invoice_items', pol.policyname);
  END LOOP;
END $$;

CREATE POLICY "invoice_items_select_member"
  ON public.invoice_items
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.invoices inv
      WHERE inv.id = invoice_items.invoice_id
        AND (
          inv.company_id IN (
            SELECT c.id
            FROM public.companies c
            WHERE c.owner_user_id = auth.uid()
              AND c.is_active = true
          )
          OR inv.company_id IN (
            SELECT cu.company_id
            FROM public.company_users cu
            WHERE cu.user_id = auth.uid()
              AND cu.is_active = true
          )
        )
    )
  );

CREATE POLICY "invoice_items_insert_member"
  ON public.invoice_items
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.invoices inv
      WHERE inv.id = invoice_items.invoice_id
        AND (
          inv.company_id IN (
            SELECT c.id
            FROM public.companies c
            WHERE c.owner_user_id = auth.uid()
              AND c.is_active = true
          )
          OR inv.company_id IN (
            SELECT cu.company_id
            FROM public.company_users cu
            WHERE cu.user_id = auth.uid()
              AND cu.is_active = true
          )
        )
    )
  );

CREATE POLICY "invoice_items_update_member"
  ON public.invoice_items
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.invoices inv
      WHERE inv.id = invoice_items.invoice_id
        AND (
          inv.company_id IN (
            SELECT c.id
            FROM public.companies c
            WHERE c.owner_user_id = auth.uid()
              AND c.is_active = true
          )
          OR inv.company_id IN (
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
      FROM public.invoices inv
      WHERE inv.id = invoice_items.invoice_id
        AND (
          inv.company_id IN (
            SELECT c.id
            FROM public.companies c
            WHERE c.owner_user_id = auth.uid()
              AND c.is_active = true
          )
          OR inv.company_id IN (
            SELECT cu.company_id
            FROM public.company_users cu
            WHERE cu.user_id = auth.uid()
              AND cu.is_active = true
          )
        )
    )
  );

CREATE POLICY "invoice_items_delete_member"
  ON public.invoice_items
  FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.invoices inv
      WHERE inv.id = invoice_items.invoice_id
        AND (
          inv.company_id IN (
            SELECT c.id
            FROM public.companies c
            WHERE c.owner_user_id = auth.uid()
              AND c.is_active = true
          )
          OR inv.company_id IN (
            SELECT cu.company_id
            FROM public.company_users cu
            WHERE cu.user_id = auth.uid()
              AND cu.is_active = true
          )
        )
    )
  );
