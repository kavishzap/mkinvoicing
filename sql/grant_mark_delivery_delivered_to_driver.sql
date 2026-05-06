-- Run in Supabase SQL editor after `mark_delivery_delivered_to_driver` exists.
-- Allows the browser client (authenticated) to invoke the RPC used by
-- `advanceDeliveryNoteStatus` in lib/deliveries-service.ts.

GRANT EXECUTE ON FUNCTION public.mark_delivery_delivered_to_driver(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.mark_delivery_delivered_to_driver(uuid, uuid) TO service_role;
