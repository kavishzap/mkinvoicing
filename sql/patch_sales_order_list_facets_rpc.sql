-- Optional: one round-trip for /app/sales-orders sidebar facet counts
-- (replaces N+M parallel head COUNT queries per fulfillment/payment status).
-- Run in Supabase SQL Editor once. The app falls back to legacy counts if the RPC is missing.

CREATE OR REPLACE FUNCTION public.get_sales_order_list_facets(p_company_id uuid)
RETURNS json
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = public
AS $$
  SELECT json_build_object(
    'total',
    (SELECT count(*)::bigint
     FROM public.sales_orders so
     WHERE so.company_id = p_company_id),
    'byFulfillment',
    COALESCE(
      (
        SELECT json_object_agg(f.fulfillment_status::text, f.cnt)
        FROM (
          SELECT so.fulfillment_status, count(*)::bigint AS cnt
          FROM public.sales_orders so
          WHERE so.company_id = p_company_id
          GROUP BY so.fulfillment_status
        ) f
      ),
      '{}'::json
    ),
    'byPayment',
    COALESCE(
      (
        SELECT json_object_agg(p.payment_status::text, p.cnt)
        FROM (
          SELECT so.payment_status, count(*)::bigint AS cnt
          FROM public.sales_orders so
          WHERE so.company_id = p_company_id
          GROUP BY so.payment_status
        ) p
      ),
      '{}'::json
    )
  );
$$;

GRANT EXECUTE ON FUNCTION public.get_sales_order_list_facets(uuid) TO authenticated;

COMMENT ON FUNCTION public.get_sales_order_list_facets(uuid) IS
  'Sales order list sidebar counts grouped by fulfillment_status and payment_status.';
