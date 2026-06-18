-- Reusable tenant membership checks for RPCs and RLS.
-- Run in Supabase SQL Editor after company_users / companies exist.

CREATE OR REPLACE FUNCTION public.user_is_company_member(p_company_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    p_company_id IS NOT NULL
    AND (
      EXISTS (
        SELECT 1
        FROM public.companies c
        WHERE c.id = p_company_id
          AND c.is_active = true
          AND c.owner_user_id = auth.uid()
      )
      OR EXISTS (
        SELECT 1
        FROM public.company_users cu
        WHERE cu.company_id = p_company_id
          AND cu.user_id = auth.uid()
          AND cu.is_active = true
      )
    );
$$;

REVOKE ALL ON FUNCTION public.user_is_company_member(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.user_is_company_member(uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.assert_company_member(p_company_id uuid)
RETURNS void
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.user_is_company_member(p_company_id) THEN
    RAISE EXCEPTION 'forbidden: not a member of this company'
      USING ERRCODE = '42501';
  END IF;
END;
$$;

REVOKE ALL ON FUNCTION public.assert_company_member(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.assert_company_member(uuid) TO authenticated;
