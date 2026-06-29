-- Fix: Post credit note on create failed because row was inserted as "posted"
-- but post_credit_note() only accepts draft rows.
-- Run in Supabase SQL Editor (safe to re-run).

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

GRANT EXECUTE ON FUNCTION public.create_credit_note(jsonb, jsonb) TO authenticated;
