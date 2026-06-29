-- Credit notes module: tables, RPC, RLS, facets, feature row.
-- Run once in Supabase SQL Editor after public.companies and auth.users exist.
--
-- After running:
-- 1. Grant `credit_notes` feature to your plan/roles (see bottom).
-- 2. Regenerate src/types/supabase.ts if you use codegen.

-- ---------------------------------------------------------------------------
-- Enum
-- ---------------------------------------------------------------------------
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'credit_note_status') THEN
    CREATE TYPE public.credit_note_status AS ENUM ('issued', 'applied', 'cancelled');
  END IF;
END $$;

-- ---------------------------------------------------------------------------
-- user_settings numbering (optional columns)
-- ---------------------------------------------------------------------------
ALTER TABLE public.user_settings
  ADD COLUMN IF NOT EXISTS credit_note_prefix text NOT NULL DEFAULT 'CN',
  ADD COLUMN IF NOT EXISTS credit_note_number_padding integer NOT NULL DEFAULT 4,
  ADD COLUMN IF NOT EXISTS credit_note_next_number integer NOT NULL DEFAULT 1;

-- ---------------------------------------------------------------------------
-- credit_notes
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.credit_notes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  number text NOT NULL,
  company_id uuid NULL REFERENCES public.companies (id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  customer_id uuid NULL REFERENCES public.customers (id) ON DELETE SET NULL,
  related_invoice_id uuid NULL REFERENCES public.invoices (id) ON DELETE SET NULL,
  issue_date date NOT NULL DEFAULT CURRENT_DATE,
  status public.credit_note_status NOT NULL DEFAULT 'issued'::public.credit_note_status,
  currency text NOT NULL DEFAULT 'MUR',
  subtotal numeric(14, 2) NOT NULL DEFAULT 0,
  tax_total numeric(14, 2) NOT NULL DEFAULT 0,
  total numeric(14, 2) NOT NULL DEFAULT 0,
  discount_type text NOT NULL DEFAULT 'value' CHECK (discount_type IN ('value', 'percent')),
  discount_amount numeric(14, 2) NOT NULL DEFAULT 0,
  reason text NULL,
  notes text NULL,
  terms text NULL,
  from_snapshot jsonb NULL,
  bill_to_snapshot jsonb NULL,
  client_snapshot jsonb NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS credit_notes_company_number_uq
  ON public.credit_notes (company_id, number);

CREATE INDEX IF NOT EXISTS idx_credit_notes_company_issue
  ON public.credit_notes (company_id, issue_date DESC);

CREATE INDEX IF NOT EXISTS idx_credit_notes_customer
  ON public.credit_notes (company_id, customer_id);

-- ---------------------------------------------------------------------------
-- credit_note_items
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.credit_note_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  credit_note_id uuid NOT NULL REFERENCES public.credit_notes (id) ON DELETE CASCADE,
  company_id uuid NULL REFERENCES public.companies (id) ON DELETE CASCADE,
  product_id uuid NULL REFERENCES public.products (id) ON DELETE SET NULL,
  item text NOT NULL,
  description text NULL,
  quantity numeric(14, 4) NOT NULL DEFAULT 1,
  unit_price numeric(14, 2) NOT NULL DEFAULT 0,
  tax_percent numeric(8, 4) NOT NULL DEFAULT 0,
  line_subtotal numeric(14, 2) NOT NULL DEFAULT 0,
  line_tax numeric(14, 2) NOT NULL DEFAULT 0,
  line_total numeric(14, 2) NOT NULL DEFAULT 0,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_credit_note_items_credit_note
  ON public.credit_note_items (credit_note_id);

-- ---------------------------------------------------------------------------
-- create_credit_note RPC (mirrors create_invoice pattern)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.create_credit_note(
  p_credit_note jsonb,
  p_items jsonb
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_company_id uuid := (p_credit_note->>'company_id')::uuid;
  v_prefix text := 'CN';
  v_padding int := 4;
  v_next int := 1;
  v_number text;
  v_cn_id uuid;
  v_subtotal numeric(14, 2) := 0;
  v_tax_total numeric(14, 2) := 0;
  v_discount numeric(14, 2) := 0;
  v_total numeric(14, 2) := 0;
  v_item jsonb;
  v_line_sub numeric(14, 2);
  v_line_tax numeric(14, 2);
  v_line_total numeric(14, 2);
  v_sort int := 0;
  v_from jsonb;
  v_bill jsonb;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  SELECT
    COALESCE(us.credit_note_prefix, 'CN'),
    COALESCE(us.credit_note_number_padding, 4),
    COALESCE(us.credit_note_next_number, 1)
  INTO v_prefix, v_padding, v_next
  FROM public.user_settings us
  WHERE us.user_id = v_user_id
  LIMIT 1;

  v_number := v_prefix || '-' || lpad(v_next::text, v_padding, '0');

  -- Build from_snapshot from company profile when possible
  SELECT jsonb_build_object(
    'type', 'company',
    'company_name', c.name,
    'email', c.email,
    'phone', c.phone,
    'address_line_1', c.address_line_1,
    'address_line_2', c.address_line_2,
    'city', c.city,
    'country', c.country,
    'registration_id', c.brn,
    'vat_number', c.vat_number
  )
  INTO v_from
  FROM public.companies c
  WHERE c.id = v_company_id;

  IF p_credit_note->>'customer_id' IS NOT NULL THEN
    SELECT jsonb_build_object(
      'type', cu.type,
      'company_name', cu.company_name,
      'contact_name', cu.contact_name,
      'full_name', cu.full_name,
      'email', cu.email,
      'phone', cu.phone,
      'street', cu.street,
      'city', cu.city,
      'postal', cu.postal,
      'country', cu.country,
      'address_line_1', cu.address_line_1,
      'address_line_2', cu.address_line_2
    )
    INTO v_bill
    FROM public.customers cu
    WHERE cu.id = (p_credit_note->>'customer_id')::uuid;
  ELSE
    v_bill := p_credit_note->'client_snapshot';
  END IF;

  FOR v_item IN SELECT * FROM jsonb_array_elements(COALESCE(p_items, '[]'::jsonb))
  LOOP
    v_line_sub := COALESCE((v_item->>'quantity')::numeric, 0)
      * COALESCE((v_item->>'unit_price')::numeric, 0);
    v_line_tax := v_line_sub * COALESCE((v_item->>'tax_percent')::numeric, 0) / 100;
    v_line_total := v_line_sub + v_line_tax;
    v_subtotal := v_subtotal + v_line_sub;
    v_tax_total := v_tax_total + v_line_tax;
  END LOOP;

  IF COALESCE(p_credit_note->>'discount_type', 'value') = 'percent' THEN
    v_discount := v_subtotal * COALESCE((p_credit_note->>'discount_amount')::numeric, 0) / 100;
  ELSE
    v_discount := COALESCE((p_credit_note->>'discount_amount')::numeric, 0);
  END IF;

  v_total := GREATEST(0, v_subtotal + v_tax_total - v_discount);

  INSERT INTO public.credit_notes (
    number, company_id, user_id, customer_id, related_invoice_id,
    issue_date, status, currency,
    subtotal, tax_total, total,
    discount_type, discount_amount,
    reason, notes, terms,
    from_snapshot, bill_to_snapshot, client_snapshot
  )
  VALUES (
    v_number,
    v_company_id,
    v_user_id,
    NULLIF(p_credit_note->>'customer_id', '')::uuid,
    NULLIF(p_credit_note->>'related_invoice_id', '')::uuid,
    COALESCE((p_credit_note->>'issue_date')::date, CURRENT_DATE),
    COALESCE((p_credit_note->>'status')::public.credit_note_status, 'issued'::public.credit_note_status),
    COALESCE(p_credit_note->>'currency', 'MUR'),
    v_subtotal, v_tax_total, v_total,
    COALESCE(p_credit_note->>'discount_type', 'value'),
    COALESCE((p_credit_note->>'discount_amount')::numeric, 0),
    NULLIF(p_credit_note->>'reason', ''),
    NULLIF(p_credit_note->>'notes', ''),
    NULLIF(p_credit_note->>'terms', ''),
    v_from,
    v_bill,
    p_credit_note->'client_snapshot'
  )
  RETURNING id INTO v_cn_id;

  FOR v_item IN SELECT * FROM jsonb_array_elements(COALESCE(p_items, '[]'::jsonb))
  LOOP
    v_sort := v_sort + 1;
    v_line_sub := COALESCE((v_item->>'quantity')::numeric, 0)
      * COALESCE((v_item->>'unit_price')::numeric, 0);
    v_line_tax := v_line_sub * COALESCE((v_item->>'tax_percent')::numeric, 0) / 100;
    v_line_total := v_line_sub + v_line_tax;

    INSERT INTO public.credit_note_items (
      credit_note_id, company_id, product_id,
      item, description, quantity, unit_price, tax_percent,
      line_subtotal, line_tax, line_total, sort_order
    )
    VALUES (
      v_cn_id,
      v_company_id,
      NULLIF(v_item->>'product_id', '')::uuid,
      COALESCE(v_item->>'item', 'Item'),
      NULLIF(v_item->>'description', ''),
      COALESCE((v_item->>'quantity')::numeric, 1),
      COALESCE((v_item->>'unit_price')::numeric, 0),
      COALESCE((v_item->>'tax_percent')::numeric, 0),
      v_line_sub, v_line_tax, v_line_total, v_sort
    );
  END LOOP;

  UPDATE public.user_settings
  SET credit_note_next_number = v_next + 1,
      updated_at = now()
  WHERE user_id = v_user_id;

  RETURN v_cn_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.create_credit_note(jsonb, jsonb) TO authenticated;

-- ---------------------------------------------------------------------------
-- Facets RPC (sidebar counts)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.get_credit_note_nav_facets(
  p_company_id uuid,
  p_month_start date,
  p_quarter_start date,
  p_year_start date
)
RETURNS json
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = public
AS $$
  SELECT json_build_object(
    'companyTotal',
    (SELECT count(*)::bigint FROM public.credit_notes cn
     WHERE cn.company_id = p_company_id OR cn.company_id IS NULL),
    'issuedCount',
    (SELECT count(*)::bigint FROM public.credit_notes cn
     WHERE (cn.company_id = p_company_id OR cn.company_id IS NULL)
       AND cn.status = 'issued'::public.credit_note_status),
    'appliedCount',
    (SELECT count(*)::bigint FROM public.credit_notes cn
     WHERE (cn.company_id = p_company_id OR cn.company_id IS NULL)
       AND cn.status = 'applied'::public.credit_note_status),
    'cancelledCount',
    (SELECT count(*)::bigint FROM public.credit_notes cn
     WHERE (cn.company_id = p_company_id OR cn.company_id IS NULL)
       AND cn.status = 'cancelled'::public.credit_note_status),
    'thisMonthCount',
    (SELECT count(*)::bigint FROM public.credit_notes cn
     WHERE (cn.company_id = p_company_id OR cn.company_id IS NULL)
       AND cn.issue_date >= p_month_start),
    'thisQuarterCount',
    (SELECT count(*)::bigint FROM public.credit_notes cn
     WHERE (cn.company_id = p_company_id OR cn.company_id IS NULL)
       AND cn.issue_date >= p_quarter_start),
    'thisYearCount',
    (SELECT count(*)::bigint FROM public.credit_notes cn
     WHERE (cn.company_id = p_company_id OR cn.company_id IS NULL)
       AND cn.issue_date >= p_year_start)
  );
$$;

GRANT EXECUTE ON FUNCTION public.get_credit_note_nav_facets(uuid, date, date, date) TO authenticated;

-- ---------------------------------------------------------------------------
-- RLS (mirrors invoices)
-- ---------------------------------------------------------------------------
ALTER TABLE public.credit_notes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.credit_note_items ENABLE ROW LEVEL SECURITY;

DO $$
DECLARE pol RECORD;
BEGIN
  FOR pol IN
    SELECT policyname FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'credit_notes'
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.credit_notes', pol.policyname);
  END LOOP;
  FOR pol IN
    SELECT policyname FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'credit_note_items'
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.credit_note_items', pol.policyname);
  END LOOP;
END $$;

CREATE POLICY "credit_notes_select_member"
  ON public.credit_notes FOR SELECT TO authenticated
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

CREATE POLICY "credit_notes_insert_member"
  ON public.credit_notes FOR INSERT TO authenticated
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

CREATE POLICY "credit_notes_update_member"
  ON public.credit_notes FOR UPDATE TO authenticated
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

CREATE POLICY "credit_notes_delete_member"
  ON public.credit_notes FOR DELETE TO authenticated
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

CREATE POLICY "credit_note_items_select_member"
  ON public.credit_note_items FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.credit_notes cn
      WHERE cn.id = credit_note_items.credit_note_id
        AND (
          cn.company_id IN (
            SELECT c.id FROM public.companies c
            WHERE c.owner_user_id = auth.uid() AND c.is_active = true
          )
          OR cn.company_id IN (
            SELECT cu.company_id FROM public.company_users cu
            WHERE cu.user_id = auth.uid() AND cu.is_active = true
          )
        )
    )
  );

CREATE POLICY "credit_note_items_insert_member"
  ON public.credit_note_items FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.credit_notes cn
      WHERE cn.id = credit_note_items.credit_note_id
        AND (
          cn.company_id IN (
            SELECT c.id FROM public.companies c
            WHERE c.owner_user_id = auth.uid() AND c.is_active = true
          )
          OR cn.company_id IN (
            SELECT cu.company_id FROM public.company_users cu
            WHERE cu.user_id = auth.uid() AND cu.is_active = true
          )
        )
    )
  );

CREATE POLICY "credit_note_items_update_member"
  ON public.credit_note_items FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.credit_notes cn
      WHERE cn.id = credit_note_items.credit_note_id
        AND (
          cn.company_id IN (
            SELECT c.id FROM public.companies c
            WHERE c.owner_user_id = auth.uid() AND c.is_active = true
          )
          OR cn.company_id IN (
            SELECT cu.company_id FROM public.company_users cu
            WHERE cu.user_id = auth.uid() AND cu.is_active = true
          )
        )
    )
  );

CREATE POLICY "credit_note_items_delete_member"
  ON public.credit_note_items FOR DELETE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.credit_notes cn
      WHERE cn.id = credit_note_items.credit_note_id
        AND (
          cn.company_id IN (
            SELECT c.id FROM public.companies c
            WHERE c.owner_user_id = auth.uid() AND c.is_active = true
          )
          OR cn.company_id IN (
            SELECT cu.company_id FROM public.company_users cu
            WHERE cu.user_id = auth.uid() AND cu.is_active = true
          )
        )
    )
  );

-- ---------------------------------------------------------------------------
-- Feature row (enable in roles / plans)
-- ---------------------------------------------------------------------------
INSERT INTO public.features (code, name, description)
VALUES (
  'credit_notes',
  'Credit Notes',
  'Issue and manage customer credit notes'
)
ON CONFLICT (code) DO UPDATE
SET name = EXCLUDED.name,
    description = EXCLUDED.description;

-- Optional: attach to all existing plans
INSERT INTO public.plan_features (plan_id, feature_id, is_enabled)
SELECT p.id, f.id, true
FROM public.plans p
CROSS JOIN public.features f
WHERE f.code = 'credit_notes'
ON CONFLICT DO NOTHING;

-- Grant to every role that already has Invoices (includes locked Owner role)
INSERT INTO public.role_features (role_id, feature_id)
SELECT rf.role_id, cn.id
FROM public.features inv
JOIN public.role_features rf ON rf.feature_id = inv.id
CROSS JOIN public.features cn
WHERE inv.code = 'invoices'
  AND cn.code = 'credit_notes'
  AND NOT EXISTS (
    SELECT 1
    FROM public.role_features existing
    WHERE existing.role_id = rf.role_id
      AND existing.feature_id = cn.id
  );

COMMENT ON TABLE public.credit_notes IS 'Customer credit notes (returns, corrections).';
COMMENT ON TABLE public.credit_note_items IS 'Line items for credit notes.';
