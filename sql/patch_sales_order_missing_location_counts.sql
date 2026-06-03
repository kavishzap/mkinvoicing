-- Sidebar counts + list filter for "Missing city" / "Missing address" on /app/sales-orders.
-- Run in Supabase SQL Editor once. The app falls back if RPCs are missing.

CREATE OR REPLACE FUNCTION public.count_sales_orders_missing_city(p_company_id uuid)
RETURNS bigint
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = public
AS $$
  SELECT count(*)::bigint
  FROM public.sales_orders so
  WHERE so.company_id = p_company_id
    AND so.city_id IS NULL
    AND coalesce(nullif(trim(so.bill_to_snapshot->>'city'), ''), '') = '';
$$;

CREATE OR REPLACE FUNCTION public.count_sales_orders_missing_address(p_company_id uuid)
RETURNS bigint
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = public
AS $$
  SELECT count(*)::bigint
  FROM public.sales_orders so
  LEFT JOIN public.customers c ON c.id = so.customer_id
  WHERE so.company_id = p_company_id
    AND coalesce(nullif(trim(so.bill_to_snapshot->>'address_line_1'), ''), '') = ''
    AND coalesce(nullif(trim(so.bill_to_snapshot->>'street'), ''), '') = ''
    AND (
      so.customer_id IS NULL
      OR (
        coalesce(nullif(trim(c.address_line_1), ''), '') = ''
        AND coalesce(nullif(trim(c.street), ''), '') = ''
      )
    );
$$;

CREATE OR REPLACE FUNCTION public.count_sales_orders_missing_both(p_company_id uuid)
RETURNS bigint
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = public
AS $$
  SELECT count(*)::bigint
  FROM public.sales_orders so
  LEFT JOIN public.customers c ON c.id = so.customer_id
  WHERE so.company_id = p_company_id
    AND so.city_id IS NULL
    AND coalesce(nullif(trim(so.bill_to_snapshot->>'city'), ''), '') = ''
    AND coalesce(nullif(trim(so.bill_to_snapshot->>'address_line_1'), ''), '') = ''
    AND coalesce(nullif(trim(so.bill_to_snapshot->>'street'), ''), '') = ''
    AND (
      so.customer_id IS NULL
      OR (
        coalesce(nullif(trim(c.address_line_1), ''), '') = ''
        AND coalesce(nullif(trim(c.street), ''), '') = ''
      )
    );
$$;

CREATE OR REPLACE FUNCTION public.sales_order_ids_missing_address(p_company_id uuid)
RETURNS uuid[]
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = public
AS $$
  SELECT coalesce(array_agg(so.id), '{}'::uuid[])
  FROM public.sales_orders so
  LEFT JOIN public.customers c ON c.id = so.customer_id
  WHERE so.company_id = p_company_id
    AND coalesce(nullif(trim(so.bill_to_snapshot->>'address_line_1'), ''), '') = ''
    AND coalesce(nullif(trim(so.bill_to_snapshot->>'street'), ''), '') = ''
    AND (
      so.customer_id IS NULL
      OR (
        coalesce(nullif(trim(c.address_line_1), ''), '') = ''
        AND coalesce(nullif(trim(c.street), ''), '') = ''
      )
    );
$$;

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
    ),
    'missingCity',
    public.count_sales_orders_missing_city(p_company_id),
    'missingAddress',
    public.count_sales_orders_missing_address(p_company_id),
    'missingBoth',
    public.count_sales_orders_missing_both(p_company_id)
  );
$$;

GRANT EXECUTE ON FUNCTION public.count_sales_orders_missing_city(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.count_sales_orders_missing_address(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.count_sales_orders_missing_both(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.sales_order_ids_missing_address(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_sales_order_list_facets(uuid) TO authenticated;

COMMENT ON FUNCTION public.count_sales_orders_missing_city(uuid) IS
  'Orders with no city_id and no bill-to city (sales orders list filter).';
COMMENT ON FUNCTION public.count_sales_orders_missing_address(uuid) IS
  'Orders with no bill-to or linked customer address (sales orders list filter).';
COMMENT ON FUNCTION public.sales_order_ids_missing_address(uuid) IS
  'IDs of orders with missing address for PostgREST .in() list filtering.';
COMMENT ON FUNCTION public.count_sales_orders_missing_both(uuid) IS
  'Orders with no city and no bill-to/customer address (sales orders list filter).';
