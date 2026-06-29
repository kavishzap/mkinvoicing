-- Allow deleting posted credit notes and restore linked invoice balance.
-- Run in Supabase SQL Editor after patch_credit_notes_erp_flow.sql.

CREATE OR REPLACE FUNCTION public.delete_credit_note(p_credit_note_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_cn public.credit_notes%ROWTYPE;
  v_inv public.invoices%ROWTYPE;
  v_other_credits numeric(14, 2);
  v_new_due numeric(14, 2);
BEGIN
  SELECT * INTO v_cn
  FROM public.credit_notes
  WHERE id = p_credit_note_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Credit note not found';
  END IF;

  IF v_cn.status = 'posted'::public.credit_note_status
     AND v_cn.related_invoice_id IS NOT NULL THEN
    SELECT * INTO v_inv
    FROM public.invoices
    WHERE id = v_cn.related_invoice_id
    FOR UPDATE;

    IF FOUND AND v_inv.status <> 'cancelled'::invoice_status THEN
      v_other_credits := GREATEST(
        0,
        public.invoice_posted_credit_total(v_cn.related_invoice_id) - v_cn.total
      );

      v_new_due := GREATEST(
        0,
        COALESCE(v_inv.total, 0)
          - COALESCE(v_inv.amount_paid, 0)
          - v_other_credits
      );

      UPDATE public.invoices
      SET
        amount_due = v_new_due,
        status = CASE
          WHEN v_new_due > 0.005 THEN 'unpaid'::invoice_status
          ELSE v_inv.status
        END,
        updated_at = now()
      WHERE id = v_inv.id;
    END IF;
  END IF;

  DELETE FROM public.credit_notes WHERE id = p_credit_note_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.delete_credit_note(uuid) TO authenticated;
