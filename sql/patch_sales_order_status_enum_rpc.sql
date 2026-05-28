-- Expose sales order status enum labels to the app via Supabase RPC (no hardcoded lists in clients).
-- Requires enums public.sales_order_fulfillment_status and public.sales_order_payment_status.

create or replace function public.sales_order_fulfillment_status_enum_values()
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
    and t.typname = 'sales_order_fulfillment_status';
$$;

comment on function public.sales_order_fulfillment_status_enum_values() is
  'Returns ordered labels for enum public.sales_order_fulfillment_status (for UI filters).';

grant execute on function public.sales_order_fulfillment_status_enum_values() to authenticated;

create or replace function public.sales_order_payment_status_enum_values()
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
    and t.typname = 'sales_order_payment_status';
$$;

comment on function public.sales_order_payment_status_enum_values() is
  'Returns ordered labels for enum public.sales_order_payment_status (for UI filters).';

grant execute on function public.sales_order_payment_status_enum_values() to authenticated;
