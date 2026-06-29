-- ERP credit note flow: draft → posted, invoice link required, post reduces invoice balance.
-- Run in Supabase SQL Editor AFTER sql/create_credit_notes.sql (or on existing credit_notes install).
--
-- IMPORTANT (PostgreSQL enum rule): new enum values must be COMMITTED before use.
-- If the full script fails on the UPDATE below, run sql/patch_credit_notes_erp_flow_step1_enums.sql
-- first, then run THIS file again (enum blocks are idempotent).

-- ---------------------------------------------------------------------------
-- 1. Extend enum (draft / posted) — keep legacy issued/applied for old rows
-- ---------------------------------------------------------------------------
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_enum e
    JOIN pg_type t ON e.enumtypid = t.oid
    WHERE t.typname = 'credit_note_status' AND e.enumlabel = 'draft'
  ) THEN
    ALTER TYPE public.credit_note_status ADD VALUE 'draft';
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_enum e
    JOIN pg_type t ON e.enumtypid = t.oid
    WHERE t.typname = 'credit_note_status' AND e.enumlabel = 'posted'
  ) THEN
    ALTER TYPE public.credit_note_status ADD VALUE 'posted';
  END IF;
END $$;

-- Must commit before referencing new enum labels (55P04 otherwise).
COMMIT;

-- ---------------------------------------------------------------------------
-- 1b. Migrate legacy statuses (run after enum values are committed)
-- ---------------------------------------------------------------------------
UPDATE public.credit_notes SET status = 'draft'::public.credit_note_status
WHERE status::text = 'issued';

UPDATE public.credit_notes SET status = 'posted'::public.credit_note_status
WHERE status::text = 'applied';

-- ---------------------------------------------------------------------------
-- 2. New columns
-- ---------------------------------------------------------------------------
ALTER TABLE public.credit_notes
  ADD COLUMN IF NOT EXISTS credit_type text NOT NULL DEFAULT 'partial'
    CHECK (credit_type IN ('full', 'partial'));

ALTER TABLE public.credit_note_items
  ADD COLUMN IF NOT EXISTS invoice_item_id uuid NULL
    REFERENCES public.invoice_items (id) ON DELETE SET NULL;

COMMENT ON COLUMN public.credit_notes.credit_type IS 'full = credit entire invoice balance; partial = selected lines/qty.';
COMMENT ON COLUMN public.credit_note_items.invoice_item_id IS 'Source invoice line when crediting against an invoice.';

-- ---------------------------------------------------------------------------
-- 3. Posted credit total already credited against an invoice (for eligibility)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.invoice_posted_credit_total(p_invoice_id uuid)
RETURNS numeric
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = public
AS $$
  SELECT COALESCE(sum(cn.total), 0)::numeric
  FROM public.credit_notes cn
  WHERE cn.related_invoice_id = p_invoice_id
    AND cn.status = 'posted'::public.credit_note_status;
$$;

GRANT EXECUTE ON FUNCTION public.invoice_posted_credit_total(uuid) TO authenticated;

-- ---------------------------------------------------------------------------
-- 4. List invoices eligible for credit (customer, not cancelled, not fully credited)
-- Creditable = invoice total minus posted credits (includes paid invoices for returns).
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.list_creditable_invoices(
  p_company_id uuid,
  p_customer_id uuid
)
RETURNS json
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = public
AS $$
  SELECT COALESCE(
    json_agg(row_to_json(t) ORDER BY t.issue_date DESC, t.number DESC),
    '[]'::json
  )
  FROM (
    SELECT
      i.id,
      i.number,
      i.issue_date,
      i.currency,
      i.status,
      i.total AS original_amount,
      CASE
        WHEN i.status = 'paid'::invoice_status THEN 0::numeric
        ELSE GREATEST(
          0,
          COALESCE(
            NULLIF(i.amount_due, 0),
            GREATEST(0, i.total - COALESCE(i.amount_paid, 0))
          )
        )
      END AS outstanding_balance,
      public.invoice_posted_credit_total(i.id) AS already_credited,
      GREATEST(
        0,
        COALESCE(i.total, 0) - public.invoice_posted_credit_total(i.id)
      ) AS creditable_balance
    FROM public.invoices i
    WHERE i.company_id = p_company_id
      AND i.customer_id = p_customer_id
      AND i.status <> 'cancelled'::invoice_status
      AND COALESCE(i.total, 0) > 0.005
      AND GREATEST(
        0,
        COALESCE(i.total, 0) - public.invoice_posted_credit_total(i.id)
      ) > 0.005
  ) t;
$$;

GRANT EXECUTE ON FUNCTION public.list_creditable_invoices(uuid, uuid) TO authenticated;

-- ---------------------------------------------------------------------------
-- 5. Post credit note → reduce invoice amount_due (accounting effect)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.post_credit_note(p_credit_note_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_cn public.credit_notes%ROWTYPE;
  v_inv public.invoices%ROWTYPE;
  v_outstanding numeric(14, 2);
  v_already numeric(14, 2);
  v_new_due numeric(14, 2);
BEGIN
  SELECT * INTO v_cn
  FROM public.credit_notes
  WHERE id = p_credit_note_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Credit note not found';
  END IF;

  IF v_cn.status <> 'draft'::public.credit_note_status THEN
    RAISE EXCEPTION 'Only draft credit notes can be posted';
  END IF;

  IF v_cn.related_invoice_id IS NULL THEN
    RAISE EXCEPTION 'Credit note must be linked to an invoice';
  END IF;

  SELECT * INTO v_inv
  FROM public.invoices
  WHERE id = v_cn.related_invoice_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Related invoice not found';
  END IF;

  IF v_inv.status = 'cancelled'::invoice_status THEN
    RAISE EXCEPTION 'Cannot post credit against a cancelled invoice';
  END IF;

  v_already := public.invoice_posted_credit_total(v_cn.related_invoice_id);

  IF v_cn.total > GREATEST(0, v_inv.total - v_already) + 0.005 THEN
    RAISE EXCEPTION 'Credit total (%) exceeds remaining creditable amount on invoice (%)',
      v_cn.total, GREATEST(0, v_inv.total - v_already);
  END IF;

  v_outstanding := CASE
    WHEN v_inv.status = 'paid'::invoice_status THEN 0::numeric
    ELSE GREATEST(
      0,
      COALESCE(
        NULLIF(v_inv.amount_due, 0),
        GREATEST(0, v_inv.total - COALESCE(v_inv.amount_paid, 0))
      )
    )
  END;

  v_new_due := GREATEST(0, v_outstanding - v_cn.total);

  UPDATE public.invoices
  SET
    amount_due = v_new_due,
    status = CASE
      WHEN v_new_due <= 0.005 THEN 'paid'::invoice_status
      ELSE v_inv.status
    END,
    updated_at = now()
  WHERE id = v_inv.id;

  UPDATE public.credit_notes
  SET status = 'posted'::public.credit_note_status, updated_at = now()
  WHERE id = p_credit_note_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.post_credit_note(uuid) TO authenticated;

-- ---------------------------------------------------------------------------
-- 6. Update create_credit_note — default draft, accept credit_type
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
  v_status public.credit_note_status;
  v_insert_status public.credit_note_status;
  v_wants_post boolean := false;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  IF NULLIF(p_credit_note->>'related_invoice_id', '') IS NULL THEN
    RAISE EXCEPTION 'related_invoice_id is required';
  END IF;

  IF NULLIF(p_credit_note->>'customer_id', '') IS NULL THEN
    RAISE EXCEPTION 'customer_id is required';
  END IF;

  v_status := COALESCE(
    (p_credit_note->>'status')::public.credit_note_status,
    'draft'::public.credit_note_status
  );

  IF v_status NOT IN ('draft'::public.credit_note_status, 'posted'::public.credit_note_status) THEN
    v_status := 'draft'::public.credit_note_status;
  END IF;

  v_wants_post := v_status = 'posted'::public.credit_note_status;
  v_insert_status := CASE
    WHEN v_wants_post THEN 'draft'::public.credit_note_status
    ELSE v_status
  END;

  SELECT
    COALESCE(us.credit_note_prefix, 'CN'),
    COALESCE(us.credit_note_number_padding, 4),
    COALESCE(us.credit_note_next_number, 1)
  INTO v_prefix, v_padding, v_next
  FROM public.user_settings us
  WHERE us.user_id = v_user_id
  LIMIT 1;

  v_number := v_prefix || '-' || lpad(v_next::text, v_padding, '0');

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

  FOR v_item IN SELECT * FROM jsonb_array_elements(COALESCE(p_items, '[]'::jsonb))
  LOOP
    v_line_sub := COALESCE((v_item->>'quantity')::numeric, 0)
      * COALESCE((v_item->>'unit_price')::numeric, 0);
    v_line_tax := v_line_sub * COALESCE((v_item->>'tax_percent')::numeric, 0) / 100;
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
    issue_date, status, currency, credit_type,
    subtotal, tax_total, total,
    discount_type, discount_amount,
    reason, notes, terms,
    from_snapshot, bill_to_snapshot, client_snapshot
  )
  VALUES (
    v_number,
    v_company_id,
    v_user_id,
    (p_credit_note->>'customer_id')::uuid,
    (p_credit_note->>'related_invoice_id')::uuid,
    COALESCE((p_credit_note->>'issue_date')::date, CURRENT_DATE),
    v_insert_status,
    COALESCE(p_credit_note->>'currency', 'MUR'),
    COALESCE(p_credit_note->>'credit_type', 'partial'),
    v_subtotal, v_tax_total, v_total,
    COALESCE(p_credit_note->>'discount_type', 'value'),
    COALESCE((p_credit_note->>'discount_amount')::numeric, 0),
    NULLIF(p_credit_note->>'reason', ''),
    NULLIF(p_credit_note->>'notes', ''),
    NULLIF(p_credit_note->>'terms', ''),
    v_from,
    v_bill,
    NULL
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
      credit_note_id, company_id, product_id, invoice_item_id,
      item, description, quantity, unit_price, tax_percent,
      line_subtotal, line_tax, line_total, sort_order
    )
    VALUES (
      v_cn_id,
      v_company_id,
      NULLIF(v_item->>'product_id', '')::uuid,
      NULLIF(v_item->>'invoice_item_id', '')::uuid,
      COALESCE(v_item->>'item', 'Item'),
      NULLIF(v_item->>'description', ''),
      COALESCE((v_item->>'quantity')::numeric, 1),
      COALESCE((v_item->>'unit_price')::numeric, 0),
      COALESCE((v_item->>'tax_percent')::numeric, 0),
      v_line_sub, v_line_tax, v_line_total, v_sort
    );
  END LOOP;

  UPDATE public.user_settings
  SET credit_note_next_number = v_next + 1, updated_at = now()
  WHERE user_id = v_user_id;

  IF v_wants_post THEN
    PERFORM public.post_credit_note(v_cn_id);
  END IF;

  RETURN v_cn_id;
END;
$$;

-- ---------------------------------------------------------------------------
-- 7. Facets RPC — draft / posted / cancelled
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
    'draftCount',
    (SELECT count(*)::bigint FROM public.credit_notes cn
     WHERE (cn.company_id = p_company_id OR cn.company_id IS NULL)
       AND cn.status = 'draft'::public.credit_note_status),
    'postedCount',
    (SELECT count(*)::bigint FROM public.credit_notes cn
     WHERE (cn.company_id = p_company_id OR cn.company_id IS NULL)
       AND cn.status = 'posted'::public.credit_note_status),
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
