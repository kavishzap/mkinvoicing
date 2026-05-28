-- Run in Supabase SQL editor: stock errors name products instead of raw product_id.
-- Matches client fallback in lib/deliveries-service.ts (humanizePrimaryWarehouseStockError).

create or replace function public.mark_delivery_delivered_to_driver(
  p_delivery_id uuid,
  p_user_id uuid
)
returns void
language plpgsql
security definer
as $$
declare
  v_delivery public.deliveries%rowtype;
  v_primary_warehouse_id uuid;
  v_driver_location_id uuid;
  v_existing_transfer_count integer;
  v_item record;
  v_available_stock numeric;
  v_product_name text;
begin
  select *
  into v_delivery
  from public.deliveries
  where id = p_delivery_id
  for update;

  if not found then
    raise exception 'Delivery not found.';
  end if;

  select count(*)
  into v_existing_transfer_count
  from public.inventory_movements
  where delivery_id = p_delivery_id
    and reference_type = 'delivery_to_driver';

  if v_existing_transfer_count > 0 then
    raise exception 'This delivery has already been transferred to the driver location.';
  end if;

  select id
  into v_primary_warehouse_id
  from public.locations
  where company_id = v_delivery.company_id
    and location_type = 'warehouse'
    and is_primary_warehouse = true
    and is_active = true
  limit 1;

  if v_primary_warehouse_id is null then
    raise exception 'No active primary warehouse defined for this company.';
  end if;

  select ld.location_id
  into v_driver_location_id
  from public.location_drivers ld
  join public.locations l
    on l.id = ld.location_id
  where ld.company_id = v_delivery.company_id
    and ld.driver_user_id = v_delivery.driver_user_id
    and ld.is_active = true
    and l.is_active = true
    and l.location_type = 'driver_location'
  limit 1;

  if v_driver_location_id is null then
    raise exception 'This driver has no active driver location.';
  end if;

  if not exists (
    select 1
    from public.delivery_sales_orders
    where delivery_id = p_delivery_id
  ) then
    raise exception 'Delivery has no linked sales orders.';
  end if;

  for v_item in
    select
      soi.product_id,
      sum(soi.quantity) as quantity
    from public.delivery_sales_orders dso
    join public.sales_order_items soi
      on soi.sales_order_id = dso.sales_order_id
    where dso.delivery_id = p_delivery_id
      and soi.product_id is not null
    group by soi.product_id
  loop
    select quantity
    into v_available_stock
    from public.product_location_stocks
    where company_id = v_delivery.company_id
      and product_id = v_item.product_id
      and location_id = v_primary_warehouse_id
    for update;

    if coalesce(v_available_stock, 0) < v_item.quantity then
      select coalesce(
        nullif(trim(p.name), ''),
        nullif(trim(p.sku), ''),
        v_item.product_id::text
      )
      into v_product_name
      from public.products p
      where p.id = v_item.product_id
        and p.company_id = v_delivery.company_id;

      raise exception
        'Not enough stock in primary warehouse for product %. Required %, available %.',
        coalesce(v_product_name, v_item.product_id::text),
        v_item.quantity,
        coalesce(v_available_stock, 0);
    end if;
  end loop;

  insert into public.inventory_movements (
    company_id,
    user_id,
    product_id,
    event_type,
    from_location_id,
    to_location_id,
    quantity,
    delivery_id,
    reference_type,
    note
  )
  select
    v_delivery.company_id,
    p_user_id,
    soi.product_id,
    'transfer',
    v_primary_warehouse_id,
    v_driver_location_id,
    sum(soi.quantity),
    p_delivery_id,
    'delivery_to_driver',
    'Stock transferred from primary warehouse to driver location'
  from public.delivery_sales_orders dso
  join public.sales_order_items soi
    on soi.sales_order_id = dso.sales_order_id
  where dso.delivery_id = p_delivery_id
    and soi.product_id is not null
  group by soi.product_id
  on conflict do nothing;

  for v_item in
    select
      soi.product_id,
      sum(soi.quantity) as quantity
    from public.delivery_sales_orders dso
    join public.sales_order_items soi
      on soi.sales_order_id = dso.sales_order_id
    where dso.delivery_id = p_delivery_id
      and soi.product_id is not null
    group by soi.product_id
  loop
    update public.product_location_stocks
    set
      quantity = quantity - v_item.quantity,
      updated_at = now()
    where company_id = v_delivery.company_id
      and product_id = v_item.product_id
      and location_id = v_primary_warehouse_id;

    insert into public.product_location_stocks (
      company_id,
      product_id,
      location_id,
      quantity
    )
    values (
      v_delivery.company_id,
      v_item.product_id,
      v_driver_location_id,
      v_item.quantity
    )
    on conflict (company_id, product_id, location_id)
    do update set
      quantity = public.product_location_stocks.quantity + excluded.quantity,
      updated_at = now();
  end loop;

  update public.deliveries
  set
    from_location_id = v_primary_warehouse_id,
    location_id = v_driver_location_id,
    status = 'delivered_to_driver',
    delivered_to_driver_at = now(),
    updated_at = now()
  where id = p_delivery_id;
end;
$$;
