-- Harden get_dashboard_stats: enforce tenant membership and drop legacy NULL company rows.
-- Requires: sql/patch_tenant_membership_helpers.sql

CREATE OR REPLACE FUNCTION public.get_dashboard_stats(
  p_company_id uuid,
  p_year int
)
RETURNS json
LANGUAGE plpgsql
STABLE
SECURITY INVOKER
SET search_path = public
AS $$
BEGIN
  PERFORM public.assert_company_member(p_company_id);

  RETURN (
    WITH inv AS (
      SELECT i.status, i.issue_date, i.due_date, i.currency, i.total
      FROM public.invoices i
      WHERE i.company_id = p_company_id
    ),
    inv_active AS (
      SELECT *
      FROM inv
      WHERE status <> 'cancelled'::invoice_status
    ),
    inv_paid_year AS (
      SELECT total, coalesce(issue_date, due_date) AS invoice_date
      FROM inv
      WHERE status = 'paid'::invoice_status
        AND coalesce(issue_date, due_date) IS NOT NULL
        AND extract(year FROM coalesce(issue_date, due_date))::int = p_year
    )
    SELECT json_build_object(
      'netSales',
      coalesce((SELECT sum(total) FROM inv_active), 0),
      'totalPaid',
      coalesce(
        (SELECT sum(total) FROM inv WHERE status = 'paid'::invoice_status),
        0
      ),
      'totalExpense',
      coalesce(
        (SELECT sum(amount) FROM public.expenses e WHERE e.company_id = p_company_id),
        0
      ),
      'totalPurchases',
      coalesce(
        (
          SELECT sum(total)
          FROM public.purchase_invoices pi
          WHERE pi.company_id = p_company_id
            AND pi.status <> 'cancelled'::purchase_invoice_status
        ),
        0
      ),
      'salesInvoiceCount',
      (SELECT count(*)::bigint FROM inv_active),
      'salesInvoicesByYear',
      coalesce(
        (
          SELECT json_agg(
            json_build_object(
              'year', y.issue_year,
              'count', y.cnt
            )
            ORDER BY y.issue_year DESC
          )
          FROM (
            SELECT
              extract(year FROM coalesce(issue_date, due_date))::int AS issue_year,
              count(*)::bigint AS cnt
            FROM inv_active
            WHERE coalesce(issue_date, due_date) IS NOT NULL
            GROUP BY 1
          ) y
        ),
        '[]'::json
      ),
      'incomeByMonth',
      coalesce(
        (
          SELECT json_agg(
            json_build_object(
              'month', m.month_key,
              'income', m.income
            )
            ORDER BY m.month_key
          )
          FROM (
            SELECT
              to_char(invoice_date, 'YYYY-MM') AS month_key,
              sum(total) AS income
            FROM inv_paid_year
            GROUP BY 1
          ) m
        ),
        '[]'::json
      ),
      'customerCount',
      (
        SELECT count(*)::bigint
        FROM public.customers c
        WHERE c.company_id = p_company_id
      ),
      'productCount',
      (
        SELECT count(*)::bigint
        FROM public.products p
        WHERE p.company_id = p_company_id
      ),
      'driverSettlementCount',
      (
        SELECT count(*)::bigint
        FROM public.delivery_driver_settlements dds
        WHERE dds.company_id = p_company_id
      ),
      'driverSettlementsCashTotal',
      coalesce(
        (
          SELECT sum(cash_amount)
          FROM public.delivery_driver_settlements dds
          WHERE dds.company_id = p_company_id
        ),
        0
      ),
      'driverSettlementsBankTotal',
      coalesce(
        (
          SELECT sum(bank_transfer_amount)
          FROM public.delivery_driver_settlements dds
          WHERE dds.company_id = p_company_id
        ),
        0
      ),
      'driverSettlementsDueOpenTotal',
      coalesce(
        (
          SELECT sum(due_amount)
          FROM public.delivery_driver_settlements dds
          WHERE dds.company_id = p_company_id
            AND coalesce(due_amount, 0) > 0
        ),
        0
      ),
      'driverSettlementsOpenDueCount',
      (
        SELECT count(*)::bigint
        FROM public.delivery_driver_settlements dds
        WHERE dds.company_id = p_company_id
          AND coalesce(due_amount, 0) > 0
      ),
      'driverSettlementsDuePaidTotal',
      coalesce(
        (
          SELECT sum(amount)
          FROM public.driver_credit_settlements dcs
          WHERE dcs.company_id = p_company_id
            AND dcs.delivery_id IS NULL
            AND coalesce(dcs.amount, 0) > 0
        ),
        0
      ),
      'currency',
      coalesce(
        (
          SELECT currency
          FROM inv
          WHERE currency IS NOT NULL
          ORDER BY issue_date DESC NULLS LAST, due_date DESC NULLS LAST
          LIMIT 1
        ),
        (
          SELECT currency
          FROM public.expenses e
          WHERE e.company_id = p_company_id AND e.currency IS NOT NULL
          ORDER BY e.expense_date DESC NULLS LAST
          LIMIT 1
        ),
        (
          SELECT currency
          FROM public.purchase_invoices pi
          WHERE pi.company_id = p_company_id AND pi.currency IS NOT NULL
          LIMIT 1
        ),
        'MUR'
      )
    )
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_dashboard_stats(uuid, int) TO authenticated;

COMMENT ON FUNCTION public.get_dashboard_stats(uuid, int) IS
  'Dashboard aggregates for /app; scoped strictly to p_company_id with membership check.';
