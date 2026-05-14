-- Split settlement: cash_amount + bank_transfer_amount (both allowed).
-- Run once in Supabase SQL Editor if you already created the legacy table with `payment_type` enum.
-- Safe to re-run: skips enum migration when `payment_type` is already gone.

ALTER TABLE public.delivery_driver_settlements
  ADD COLUMN IF NOT EXISTS cash_amount numeric(14, 2);

ALTER TABLE public.delivery_driver_settlements
  ADD COLUMN IF NOT EXISTS bank_transfer_amount numeric(14, 2);

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'delivery_driver_settlements'
      AND column_name = 'payment_type'
  ) THEN
    ALTER TABLE public.delivery_driver_settlements
      DROP CONSTRAINT IF EXISTS delivery_driver_settlements_bank_reference_ck;

    UPDATE public.delivery_driver_settlements
    SET
      cash_amount = CASE
        WHEN payment_type::text = 'cash' THEN amount_to_owner
        ELSE 0
      END,
      bank_transfer_amount = CASE
        WHEN payment_type::text = 'bank_transfer' THEN amount_to_owner
        ELSE 0
      END;

    ALTER TABLE public.delivery_driver_settlements
      DROP COLUMN payment_type;
  END IF;
END
$$;

UPDATE public.delivery_driver_settlements
SET cash_amount = COALESCE(cash_amount, 0);

UPDATE public.delivery_driver_settlements
SET bank_transfer_amount = COALESCE(bank_transfer_amount, 0);

ALTER TABLE public.delivery_driver_settlements
  ALTER COLUMN cash_amount SET DEFAULT 0;

ALTER TABLE public.delivery_driver_settlements
  ALTER COLUMN bank_transfer_amount SET DEFAULT 0;

ALTER TABLE public.delivery_driver_settlements
  ALTER COLUMN cash_amount SET NOT NULL;

ALTER TABLE public.delivery_driver_settlements
  ALTER COLUMN bank_transfer_amount SET NOT NULL;

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

COMMENT ON COLUMN public.delivery_driver_settlements.cash_amount IS
  'Portion of amount_to_owner received as cash (>= 0).';

COMMENT ON COLUMN public.delivery_driver_settlements.bank_transfer_amount IS
  'Portion of amount_to_owner received by bank transfer (>= 0).';

COMMENT ON COLUMN public.delivery_driver_settlements.bank_reference IS
  'Optional note when any amount was paid by bank transfer.';

-- Only safe if no other objects use this enum:
DROP TYPE IF EXISTS public.driver_settlement_payment_type;
