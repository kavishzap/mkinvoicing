-- Driver upselling commission per sales order on a delivery (recorded at settlement).
-- Run in Supabase SQL Editor after public.deliveries and public.sales_orders exist.

CREATE TABLE IF NOT EXISTS public.delivery_upselling_commissions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),

  company_id uuid NOT NULL
    REFERENCES public.companies (id) ON DELETE CASCADE,

  delivery_id uuid NOT NULL
    REFERENCES public.deliveries (id) ON DELETE CASCADE,

  sales_order_id uuid NOT NULL
    REFERENCES public.sales_orders (id) ON DELETE CASCADE,

  commission_amount numeric(14, 2) NOT NULL DEFAULT 0,

  currency text NOT NULL DEFAULT 'MUR',

  recorded_by uuid NOT NULL
    REFERENCES auth.users (id) ON DELETE RESTRICT,

  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT delivery_upselling_commissions_amount_ck
    CHECK (commission_amount >= 0)
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_delivery_upselling_commissions_delivery_so
  ON public.delivery_upselling_commissions (delivery_id, sales_order_id);

CREATE INDEX IF NOT EXISTS idx_delivery_upselling_commissions_delivery
  ON public.delivery_upselling_commissions (delivery_id);

COMMENT ON TABLE public.delivery_upselling_commissions IS
  'Commission paid to the driver for upselling sales orders on a delivery note.';

ALTER TABLE public.delivery_upselling_commissions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "delivery_upselling_commissions_select_member"
  ON public.delivery_upselling_commissions;
DROP POLICY IF EXISTS "delivery_upselling_commissions_insert_member"
  ON public.delivery_upselling_commissions;
DROP POLICY IF EXISTS "delivery_upselling_commissions_update_member"
  ON public.delivery_upselling_commissions;
DROP POLICY IF EXISTS "delivery_upselling_commissions_delete_member"
  ON public.delivery_upselling_commissions;

CREATE POLICY "delivery_upselling_commissions_select_member"
  ON public.delivery_upselling_commissions
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

CREATE POLICY "delivery_upselling_commissions_insert_member"
  ON public.delivery_upselling_commissions
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
    AND recorded_by = auth.uid()
    AND EXISTS (
      SELECT 1
      FROM public.deliveries d
      WHERE d.id = delivery_id
        AND d.company_id = company_id
    )
  );

CREATE POLICY "delivery_upselling_commissions_update_member"
  ON public.delivery_upselling_commissions
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

CREATE POLICY "delivery_upselling_commissions_delete_member"
  ON public.delivery_upselling_commissions
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

GRANT SELECT, INSERT, UPDATE, DELETE ON public.delivery_upselling_commissions TO authenticated;
GRANT ALL ON public.delivery_upselling_commissions TO service_role;
