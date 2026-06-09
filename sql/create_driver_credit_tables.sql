-- Driver credit balances and manual settlements (mirrors customer credit for delivery drivers).
-- Run in Supabase SQL Editor after public.companies and auth.users exist.

CREATE TABLE IF NOT EXISTS public.driver_credit_balances (
  user_id uuid NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  driver_user_id uuid NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  company_id uuid NULL REFERENCES public.companies (id) ON DELETE CASCADE,
  balance numeric(14, 2) NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (company_id, driver_user_id)
);

CREATE INDEX IF NOT EXISTS idx_driver_credit_balances_company_balance
  ON public.driver_credit_balances (company_id, balance DESC);

COMMENT ON TABLE public.driver_credit_balances IS
  'Running credit balance per driver within a company (e.g. over-collection on delivery).';

CREATE TABLE IF NOT EXISTS public.driver_credit_settlements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  company_id uuid NULL REFERENCES public.companies (id) ON DELETE CASCADE,
  driver_user_id uuid NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  delivery_id uuid NULL REFERENCES public.deliveries (id) ON DELETE SET NULL,
  amount numeric(14, 2) NOT NULL,
  notes text NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_driver_credit_settlements_company_driver
  ON public.driver_credit_settlements (company_id, driver_user_id, created_at DESC);

COMMENT ON TABLE public.driver_credit_settlements IS
  'Settlement history when driver credit is applied or manually reduced.';

ALTER TABLE public.driver_credit_balances ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.driver_credit_settlements ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "driver_credit_balances_select_member" ON public.driver_credit_balances;
DROP POLICY IF EXISTS "driver_credit_balances_insert_member" ON public.driver_credit_balances;
DROP POLICY IF EXISTS "driver_credit_balances_update_member" ON public.driver_credit_balances;

CREATE POLICY "driver_credit_balances_select_member"
  ON public.driver_credit_balances
  FOR SELECT
  TO authenticated
  USING (
    company_id IN (
      SELECT c.id FROM public.companies c
      WHERE c.owner_user_id = auth.uid() AND c.is_active = true
    )
    OR company_id IN (
      SELECT cu.company_id FROM public.company_users cu
      WHERE cu.user_id = auth.uid() AND cu.is_active = true
    )
  );

CREATE POLICY "driver_credit_balances_insert_member"
  ON public.driver_credit_balances
  FOR INSERT
  TO authenticated
  WITH CHECK (
    user_id = auth.uid()
    AND (
      company_id IN (
        SELECT c.id FROM public.companies c
        WHERE c.owner_user_id = auth.uid() AND c.is_active = true
      )
      OR company_id IN (
        SELECT cu.company_id FROM public.company_users cu
        WHERE cu.user_id = auth.uid() AND cu.is_active = true
      )
    )
  );

CREATE POLICY "driver_credit_balances_update_member"
  ON public.driver_credit_balances
  FOR UPDATE
  TO authenticated
  USING (
    company_id IN (
      SELECT c.id FROM public.companies c
      WHERE c.owner_user_id = auth.uid() AND c.is_active = true
    )
    OR company_id IN (
      SELECT cu.company_id FROM public.company_users cu
      WHERE cu.user_id = auth.uid() AND cu.is_active = true
    )
  )
  WITH CHECK (
    company_id IN (
      SELECT c.id FROM public.companies c
      WHERE c.owner_user_id = auth.uid() AND c.is_active = true
    )
    OR company_id IN (
      SELECT cu.company_id FROM public.company_users cu
      WHERE cu.user_id = auth.uid() AND cu.is_active = true
    )
  );

DROP POLICY IF EXISTS "driver_credit_settlements_select_member" ON public.driver_credit_settlements;
DROP POLICY IF EXISTS "driver_credit_settlements_insert_member" ON public.driver_credit_settlements;

CREATE POLICY "driver_credit_settlements_select_member"
  ON public.driver_credit_settlements
  FOR SELECT
  TO authenticated
  USING (
    company_id IN (
      SELECT c.id FROM public.companies c
      WHERE c.owner_user_id = auth.uid() AND c.is_active = true
    )
    OR company_id IN (
      SELECT cu.company_id FROM public.company_users cu
      WHERE cu.user_id = auth.uid() AND cu.is_active = true
    )
  );

CREATE POLICY "driver_credit_settlements_insert_member"
  ON public.driver_credit_settlements
  FOR INSERT
  TO authenticated
  WITH CHECK (
    user_id = auth.uid()
    AND (
      company_id IN (
        SELECT c.id FROM public.companies c
        WHERE c.owner_user_id = auth.uid() AND c.is_active = true
      )
      OR company_id IN (
        SELECT cu.company_id FROM public.company_users cu
        WHERE cu.user_id = auth.uid() AND cu.is_active = true
      )
    )
  );
