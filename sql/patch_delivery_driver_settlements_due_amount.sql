-- Allow cash + bank + due to equal amount_to_owner on delivery driver settlements.
-- Run once in Supabase SQL Editor after public.delivery_driver_settlements exists.

ALTER TABLE public.delivery_driver_settlements
  ADD COLUMN IF NOT EXISTS due_amount numeric(14, 2) NOT NULL DEFAULT 0;

COMMENT ON COLUMN public.delivery_driver_settlements.due_amount IS
  'Portion of amount_to_owner not yet returned in cash or bank; reduced when paid via driver balance (cash_amount increases by the same amount).';

ALTER TABLE public.delivery_driver_settlements
  DROP CONSTRAINT IF EXISTS delivery_driver_settlements_split_ck;

ALTER TABLE public.delivery_driver_settlements
  ADD CONSTRAINT delivery_driver_settlements_split_ck
  CHECK (
    (
      amount_to_owner <= 0
      AND cash_amount = 0
      AND bank_transfer_amount = 0
      AND due_amount = 0
    )
    OR (
      amount_to_owner > 0
      AND cash_amount >= 0
      AND bank_transfer_amount >= 0
      AND due_amount >= 0
      AND round((cash_amount + bank_transfer_amount + due_amount)::numeric, 2)
        = round(amount_to_owner::numeric, 2)
    )
  );
