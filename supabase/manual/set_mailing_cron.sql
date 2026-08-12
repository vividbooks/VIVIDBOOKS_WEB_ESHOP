-- Jednorázové nastavení pg_cron pro vlastní mailing (naplánované kampaně + dokončení dávek).
-- Spusťte v Supabase SQL Editoru (role postgres). Secret musí být STEJNÝ jako
-- Edge Secret MAILING_CRON_SECRET u funkce make-server-93a20b6f.

-- Nahraďte YOUR_SECRET stejnou hodnotou jako v Dashboard → Edge Functions → Secrets.
ALTER DATABASE postgres SET app.mailing_cron_secret = 'YOUR_SECRET';

-- Volitelně vlastní URL (jiný project ref / vlastní doména):
-- ALTER DATABASE postgres SET app.mailing_cron_url =
--   'https://iekkundgizzdbmkzatdl.supabase.co/functions/v1/make-server-93a20b6f/cron/mailing-send';
-- ALTER DATABASE postgres SET app.mailing_automation_url =
--   'https://iekkundgizzdbmkzatdl.supabase.co/functions/v1/make-server-93a20b6f/cron/automation-runner';

-- Po změně secretu znovu naplánujte joby (spusťte migraci nebo ručně):
-- select cron.unschedule(jobid) from cron.job
--   where jobname in ('mailing-send-every-minute', 'mailing-automation-runner');
-- a pak znovu deploy / push migrace 20260707100000_email_campaign_send_engine.sql
