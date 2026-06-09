-- One round-trip for Invoice Pivot Table (product qty/amount totals by issue date range).
-- Run in Supabase SQL Editor once. The app falls back to legacy batched queries if the RPC is missing.

CREATE OR REPLACE FUNCTION public.get_invoice_pivot_data(
  p_company_id uuid,
  p_start_date date,
  p_end_date date
)
RETURNS json
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = public
AS $$
  WITH inv AS (
    SELECT i.id, i.currency
    FROM public.invoices i
    WHERE (i.company_id = p_company_id OR i.company_id IS NULL)
      AND i.status <> 'cancelled'::invoice_status
      AND i.issue_date >= p_start_date
      AND i.issue_date <= p_end_date
  ),
  aggregated AS (
    SELECT
      coalesce(nullif(trim(ii.item), ''), 'Unknown') AS product,
      sum(coalesce(ii.quantity, 0)) AS total_qty,
      sum(coalesce(ii.quantity, 0) * coalesce(ii.unit_price, 0)) AS total_amount
    FROM inv
    INNER JOIN public.invoice_items ii ON ii.invoice_id = inv.id
    GROUP BY 1
  )
  SELECT json_build_object(
    'currency',
    coalesce(
      (
        SELECT i.currency
        FROM inv i
        WHERE i.currency IS NOT NULL
        ORDER BY i.id
        LIMIT 1
      ),
      'MUR'
    ),
    'invoiceCount',
    (SELECT count(*)::bigint FROM inv),
    'rows',
    coalesce(
      (
        SELECT json_agg(
          json_build_object(
            'product', a.product,
            'totalQty', a.total_qty,
            'totalAmount', a.total_amount
          )
          ORDER BY a.product
        )
        FROM aggregated a
      ),
      '[]'::json
    ),
    'grandTotalQty',
    coalesce((SELECT sum(total_qty) FROM aggregated), 0),
    'grandTotalAmount',
    coalesce((SELECT sum(total_amount) FROM aggregated), 0)
  );
$$;

GRANT EXECUTE ON FUNCTION public.get_invoice_pivot_data(uuid, date, date) TO authenticated;

COMMENT ON FUNCTION public.get_invoice_pivot_data(uuid, date, date) IS
  'Invoice pivot aggregates; matches app filters (company_id = p or null, non-cancelled, issue_date range).';
