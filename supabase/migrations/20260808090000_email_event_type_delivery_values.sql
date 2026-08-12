-- Doručitelnost: nové hodnoty email_event_type pro Resend delivery události.
--
-- Samostatná migrace záměrně: nové hodnoty enumu nelze použít ve stejné transakci,
-- ve které vznikly. Navazující migrace (…_mailing_deliverability.sql) s nimi už pracuje.

ALTER TYPE public.email_event_type ADD VALUE IF NOT EXISTS 'delivered';
ALTER TYPE public.email_event_type ADD VALUE IF NOT EXISTS 'delivery_delayed';
ALTER TYPE public.email_event_type ADD VALUE IF NOT EXISTS 'failed';
