-- Expose public.location_type enum labels to the app via Supabase RPC (no hardcoded lists in clients).
-- Requires enum type public.location_type to exist.
-- Grant so logged-in users can populate location forms.

create or replace function public.location_type_enum_values()
returns text[]
language sql
stable
security invoker
set search_path = public
as $$
  select coalesce(
    array_agg(e.enumlabel::text order by e.enumsortorder),
    '{}'::text[]
  )
  from pg_catalog.pg_enum e
  join pg_catalog.pg_type t on e.enumtypid = t.oid
  join pg_catalog.pg_namespace n on n.oid = t.typnamespace
  where n.nspname = 'public'
    and t.typname = 'location_type';
$$;

comment on function public.location_type_enum_values() is
  'Returns ordered labels for enum public.location_type (for UI selects).';

grant execute on function public.location_type_enum_values() to authenticated;
