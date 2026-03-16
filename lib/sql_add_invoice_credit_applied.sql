-- Add a column to track how much customer credit was applied to each invoice
ALTER TABLE public.invoices
ADD COLUMN IF NOT EXISTS credit_applied numeric NOT NULL DEFAULT 0 CHECK (credit_applied >= 0);

