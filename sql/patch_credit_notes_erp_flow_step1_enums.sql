-- Step 1 of 2: add draft/posted to credit_note_status enum.
-- PostgreSQL requires this to be committed BEFORE those values are used.
-- Run this first, then run patch_credit_notes_erp_flow.sql (skip is fine if enums exist).

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_enum e
    JOIN pg_type t ON e.enumtypid = t.oid
    WHERE t.typname = 'credit_note_status' AND e.enumlabel = 'draft'
  ) THEN
    ALTER TYPE public.credit_note_status ADD VALUE 'draft';
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_enum e
    JOIN pg_type t ON e.enumtypid = t.oid
    WHERE t.typname = 'credit_note_status' AND e.enumlabel = 'posted'
  ) THEN
    ALTER TYPE public.credit_note_status ADD VALUE 'posted';
  END IF;
END $$;
