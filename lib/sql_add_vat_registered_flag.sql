-- Add a flag indicating whether the company is VAT registered
ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS vat_registered boolean NOT NULL DEFAULT false;

