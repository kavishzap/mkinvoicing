-- RLS for core tenant tables (customers, products, suppliers, expenses).
-- Mirrors sql/patch_invoices_rls.sql membership pattern.
-- Run in Supabase SQL Editor once per environment.

CREATE OR REPLACE FUNCTION public.company_member_company_ids()
RETURNS SETOF uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT c.id
  FROM public.companies c
  WHERE c.owner_user_id = auth.uid()
    AND c.is_active = true
  UNION
  SELECT cu.company_id
  FROM public.company_users cu
  WHERE cu.user_id = auth.uid()
    AND cu.is_active = true;
$$;

REVOKE ALL ON FUNCTION public.company_member_company_ids() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.company_member_company_ids() TO authenticated;

DO $$
DECLARE
  tbl text;
BEGIN
  FOREACH tbl IN ARRAY ARRAY['customers', 'products', 'suppliers', 'expenses']
  LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', tbl);

    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', tbl || '_select_member', tbl);
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', tbl || '_insert_member', tbl);
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', tbl || '_update_member', tbl);
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', tbl || '_delete_member', tbl);

    EXECUTE format(
      'CREATE POLICY %I ON public.%I FOR SELECT TO authenticated USING (company_id IN (SELECT public.company_member_company_ids()))',
      tbl || '_select_member', tbl
    );
    EXECUTE format(
      'CREATE POLICY %I ON public.%I FOR INSERT TO authenticated WITH CHECK (company_id IN (SELECT public.company_member_company_ids()))',
      tbl || '_insert_member', tbl
    );
    EXECUTE format(
      'CREATE POLICY %I ON public.%I FOR UPDATE TO authenticated USING (company_id IN (SELECT public.company_member_company_ids())) WITH CHECK (company_id IN (SELECT public.company_member_company_ids()))',
      tbl || '_update_member', tbl
    );
    EXECUTE format(
      'CREATE POLICY %I ON public.%I FOR DELETE TO authenticated USING (company_id IN (SELECT public.company_member_company_ids()))',
      tbl || '_delete_member', tbl
    );
  END LOOP;
END $$;
