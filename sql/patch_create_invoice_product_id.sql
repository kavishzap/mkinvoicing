-- After adding public.invoice_items.product_id, update public.create_invoice so that
-- each element of p_items persists product_id and company_id when inserting into
-- invoice_items (same idea as sales_order_items), e.g.:
--   company_id, product_id, item, description, quantity, unit_price, tax_percent, ...
-- mapped from JSON (uuid casts where needed).
--
-- The app already sends company_id and product_id on each line in p_items and runs
-- client-side patches (lib/invoices-service) if the RPC ignores them.

SELECT 1;
