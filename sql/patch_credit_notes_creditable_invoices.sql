-- Fix creditable invoice list: include paid invoices (returns/refunds), not only open balance.
-- Run in Supabase SQL Editor after patch_credit_notes_erp_flow.sql.

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
