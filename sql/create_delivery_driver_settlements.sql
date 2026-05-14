-- Driver balance settlement: how money was returned to the owner when admin completes settlement.
-- Split: cash_amount + bank_transfer_amount = amount_to_owner (when amount_to_owner > 0).
--
-- Run in Supabase SQL Editor after `public.deliveries` and `public.companies` exist.
-- If you already created the legacy version with `payment_type` enum, run instead:
--   sql/patch_delivery_driver_settlements_split_payment.sql

-- ---------------------------------------------------------------------------
-- Table: one row per completed driver balance settlement for a delivery
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.delivery_driver_settlements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),

  company_id uuid NOT NULL
    REFERENCES public.companies (id) ON DELETE CASCADE,

  delivery_id uuid NOT NULL
    REFERENCES public.deliveries (id) ON DELETE CASCADE,

  driver_user_id uuid NOT NULL
    REFERENCES auth.users (id) ON DELETE RESTRICT,

  recorded_by uuid NOT NULL
    REFERENCES auth.users (id) ON DELETE RESTRICT,

  amount_to_owner numeric(14, 2) NOT NULL,
  currency text NOT NULL DEFAULT 'MUR',

  settlement_cash_total numeric(14, 2) NULL,
  driver_daily_rate numeric(14, 2) NULL,
  linked_orders_total numeric(14, 2) NULL,

  cash_amount numeric(14, 2) NOT NULL DEFAULT 0,
  bank_transfer_amount numeric(14, 2) NOT NULL DEFAULT 0,

  bank_reference text NULL,

  expense_id uuid NULL,

  created_at timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT delivery_driver_settlements_split_ck
  CHECK (
    (
      amount_to_owner <= 0
      AND cash_amount = 0
      AND bank_transfer_amount = 0
    )
    OR (
      amount_to_owner > 0
      AND cash_amount >= 0
      AND bank_transfer_amount >= 0
      AND round((cash_amount + bank_transfer_amount)::numeric, 2)
        = round(amount_to_owner::numeric, 2)
      AND (cash_amount > 0 OR bank_transfer_amount > 0)
    )
  )
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_delivery_driver_settlements_delivery_id
  ON public.delivery_driver_settlements (delivery_id);

CREATE INDEX IF NOT EXISTS idx_delivery_driver_settlements_company_created
  ON public.delivery_driver_settlements (company_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_delivery_driver_settlements_driver
  ON public.delivery_driver_settlements (driver_user_id);

COMMENT ON TABLE public.delivery_driver_settlements IS
  'Admin record of how the driver returned money to the owner when settling a delivery driver balance.';

COMMENT ON COLUMN public.delivery_driver_settlements.amount_to_owner IS
  'Net amount returned to owner from the driver for this delivery (preview "amount to return to owner").';

COMMENT ON COLUMN public.delivery_driver_settlements.cash_amount IS
  'Portion of amount_to_owner received as cash.';

COMMENT ON COLUMN public.delivery_driver_settlements.bank_transfer_amount IS
  'Portion of amount_to_owner received by bank transfer.';

COMMENT ON COLUMN public.delivery_driver_settlements.bank_reference IS
  'Optional note (e.g. transfer ref) when any amount was paid by bank transfer.';

-- Optional FK to expenses (uncomment if public.expenses exists)
-- ALTER TABLE public.delivery_driver_settlements
--   ADD CONSTRAINT delivery_driver_settlements_expense_id_fkey
--   FOREIGN KEY (expense_id) REFERENCES public.expenses (id) ON DELETE SET NULL;

ALTER TABLE public.delivery_driver_settlements ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "delivery_driver_settlements_select_member"
  ON public.delivery_driver_settlements;
DROP POLICY IF EXISTS "delivery_driver_settlements_insert_member"
  ON public.delivery_driver_settlements;
DROP POLICY IF EXISTS "delivery_driver_settlements_update_member"
  ON public.delivery_driver_settlements;
DROP POLICY IF EXISTS "delivery_driver_settlements_delete_member"
  ON public.delivery_driver_settlements;

CREATE POLICY "delivery_driver_settlements_select_member"
  ON public.delivery_driver_settlements
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

CREATE POLICY "delivery_driver_settlements_insert_member"
  ON public.delivery_driver_settlements
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
        AND d.driver_user_id = driver_user_id
    )
  );

CREATE POLICY "delivery_driver_settlements_update_member"
  ON public.delivery_driver_settlements
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

CREATE POLICY "delivery_driver_settlements_delete_member"
  ON public.delivery_driver_settlements
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

GRANT SELECT, INSERT, UPDATE, DELETE ON public.delivery_driver_settlements TO authenticated;
GRANT ALL ON public.delivery_driver_settlements TO service_role;
