-- Driver settlement status: pending | settled | due (partial payment on driver balance).
-- Run once in Supabase SQL Editor after public.deliveries exists.

DO $migration$
BEGIN
  CREATE TYPE public.driver_settlement_status AS ENUM (
    'pending',
    'settled',
    'due'
  );
EXCEPTION
  WHEN duplicate_object THEN NULL;
END
$migration$;

ALTER TABLE public.deliveries
  ADD COLUMN IF NOT EXISTS driver_settlement_status public.driver_settlement_status NOT NULL DEFAULT 'pending';

COMMENT ON COLUMN public.deliveries.driver_settlement_status IS
  'Driver balance settlement: pending, fully settled, or due (outstanding on driver balance).';

-- Backfill from legacy driver_status flag and settlement due_amount.
UPDATE public.deliveries d
SET driver_settlement_status = CASE
  WHEN COALESCE(d.driver_status, false) = false THEN 'pending'::public.driver_settlement_status
  WHEN EXISTS (
    SELECT 1
    FROM public.delivery_driver_settlements s
    WHERE s.delivery_id = d.id
      AND COALESCE(s.due_amount, 0) > 0
  ) THEN 'due'::public.driver_settlement_status
  ELSE 'settled'::public.driver_settlement_status
END;
