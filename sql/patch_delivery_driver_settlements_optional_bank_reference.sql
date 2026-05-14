-- Make bank_reference optional when bank_transfer_amount > 0 (UI + app no longer require it).
-- Run once in Supabase SQL Editor if you already applied a CHECK that required a non-empty reference.

ALTER TABLE public.delivery_driver_settlements
  DROP CONSTRAINT IF EXISTS delivery_driver_settlements_split_ck;

ALTER TABLE public.delivery_driver_settlements
  ADD CONSTRAINT delivery_driver_settlements_split_ck
  CHECK (
    (
      amount_to_owner <= 0
      AND cash_amount = 0
      AND bank_transfer_amount = 0
    )
    OR (
      amount_to_owner > 0
      AND cash_amount >= 0
      AND bank_transfer_amount >= 0
      AND round((cash_amount + bank_transfer_amount)::numeric, 2)
        = round(amount_to_owner::numeric, 2)
      AND (cash_amount > 0 OR bank_transfer_amount > 0)
    )
  );

COMMENT ON COLUMN public.delivery_driver_settlements.bank_reference IS
  'Optional note when any amount was paid by bank transfer.';
