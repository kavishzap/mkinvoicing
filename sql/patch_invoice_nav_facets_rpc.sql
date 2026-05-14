-- Optional: one round-trip for /app/invoices sidebar facet counts (replaces 7 parallel head counts).
-- Run in Supabase SQL Editor once. The app falls back to the legacy 7 queries if the RPC is missing.

CREATE OR REPLACE FUNCTION public.get_invoice_nav_facets(
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
    (SELECT count(*)::bigint
     FROM public.invoices i
     WHERE i.company_id = p_company_id OR i.company_id IS NULL),
    'unpaidCount',
    (SELECT count(*)::bigint
     FROM public.invoices i
     WHERE (i.company_id = p_company_id OR i.company_id IS NULL)
       AND i.status = 'unpaid'::invoice_status),
    'paidCount',
    (SELECT count(*)::bigint
     FROM public.invoices i
     WHERE (i.company_id = p_company_id OR i.company_id IS NULL)
       AND i.status = 'paid'::invoice_status),
    'cancelledCount',
    (SELECT count(*)::bigint
     FROM public.invoices i
     WHERE (i.company_id = p_company_id OR i.company_id IS NULL)
       AND i.status = 'cancelled'::invoice_status),
    'thisMonthCount',
    (SELECT count(*)::bigint
     FROM public.invoices i
     WHERE (i.company_id = p_company_id OR i.company_id IS NULL)
       AND i.issue_date >= p_month_start),
    'thisQuarterCount',
    (SELECT count(*)::bigint
     FROM public.invoices i
     WHERE (i.company_id = p_company_id OR i.company_id IS NULL)
       AND i.issue_date >= p_quarter_start),
    'thisYearCount',
    (SELECT count(*)::bigint
     FROM public.invoices i
     WHERE (i.company_id = p_company_id OR i.company_id IS NULL)
       AND i.issue_date >= p_year_start)
  );
$$;

GRANT EXECUTE ON FUNCTION public.get_invoice_nav_facets(uuid, date, date, date) TO authenticated;

COMMENT ON FUNCTION public.get_invoice_nav_facets(uuid, date, date, date) IS
  'Invoice list sidebar counts; matches app filters (company_id = p or null).';
