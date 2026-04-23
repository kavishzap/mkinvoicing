-- After adding column public.sales_order_items.product_id, ensure the
-- Postgres function public.create_sales_order inserts it for each row in p_items.
--
-- The app now sends each element of p_items with:
--   item, description, quantity, unit_price, tax_percent, sort_order, product_id
--
-- Open your existing create_sales_order definition in Supabase (SQL editor or
-- migration history) and extend the INSERT into sales_order_items to include
--   product_id
-- mapped from the JSON (e.g. (elem->>'product_id')::uuid when present, else NULL).
--
-- If the function only whitelists columns, add product_id to that list.
-- No-op below (comment-only file for operators).

SELECT 1;
