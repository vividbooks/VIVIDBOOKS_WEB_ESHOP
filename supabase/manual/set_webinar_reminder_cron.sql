-- Jednorázové nastavení pg_cron pro připomínky webinářů.
-- Spusťte v Supabase SQL Editoru (role postgres). Secret musí být STEJNÝ jako
-- Edge Secret WEBINAR_REMINDER_CRON_SECRET u funkce make-server-93a20b6f.

-- Nahraďte YOUR_SECRET stejným hodnotou jako v Dashboard → Edge Functions → Secrets.
ALTER DATABASE postgres SET app.webinar_reminder_cron_secret = 'YOUR_SECRET';

-- Volitelně vlastní URL (jiný project ref / vlastní doména):
-- ALTER DATABASE postgres SET app.webinar_reminder_url =
--   'https://iekkundgizzdbmkzatdl.supabase.co/functions/v1/make-server-93a20b6f/cron/webinar-reminders';

-- Po změně secretu znovu naplánujte job (spusťte migraci nebo ručně):
-- select cron.unschedule(jobid) from cron.job where jobname = 'webinar-reminders-every-ten-minutes';
-- a pak znovu deploy / push migrace 20260617120000_schedule_webinar_reminder_cron.sql
