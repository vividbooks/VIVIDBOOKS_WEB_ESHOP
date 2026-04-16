-- Pozice kontaktu z Mailchimp merge pole SELECT (dropdown „role“), odděleně od tagů.

ALTER TABLE public.subscribers
  ADD COLUMN IF NOT EXISTS position_label TEXT;

COMMENT ON COLUMN public.subscribers.position_label IS 'Pozice / role z Mailchimp merge field SELECT; naplňuje import z MC.';

CREATE INDEX IF NOT EXISTS idx_subscribers_position_label ON public.subscribers (position_label)
  WHERE position_label IS NOT NULL;
