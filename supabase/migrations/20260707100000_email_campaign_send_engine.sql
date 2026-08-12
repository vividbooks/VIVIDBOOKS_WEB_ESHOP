-- Send engine vlastního mailingu (Fáze 2 náhrady Mailchimpu):
-- příjemci kampaně + rozšíření campaigns o HTML, audience filtr a plánování.
-- Statusy kampaně (TEXT, sdílené s Mailchimp importem): draft / scheduled / sending / sent / cancelled.

-- ── campaigns: nové sloupce ──────────────────────────────────────────────────

ALTER TABLE public.campaigns ADD COLUMN IF NOT EXISTS html_body TEXT;
ALTER TABLE public.campaigns ADD COLUMN IF NOT EXISTS audience_filter JSONB NOT NULL DEFAULT '{}';
ALTER TABLE public.campaigns ADD COLUMN IF NOT EXISTS created_by TEXT;
ALTER TABLE public.campaigns ADD COLUMN IF NOT EXISTS scheduled_at TIMESTAMPTZ;
ALTER TABLE public.campaigns ADD COLUMN IF NOT EXISTS finished_at TIMESTAMPTZ;
ALTER TABLE public.campaigns ADD COLUMN IF NOT EXISTS draft_id TEXT;

COMMENT ON COLUMN public.campaigns.html_body IS 'Vyrenderované HTML kampaně z EmailBuilderu (před personalizací merge fieldů).';
COMMENT ON COLUMN public.campaigns.audience_filter IS 'JSON filtr příjemců: { includeTagIds, excludeTagIds, sources, subjectInterestSlugs, positionLabels }. Vrstvy AND; uvnitř include/sources/subjects OR.';
COMMENT ON COLUMN public.campaigns.scheduled_at IS 'Čas naplánovaného odeslání (status scheduled); cron spustí send.';
COMMENT ON COLUMN public.campaigns.draft_id IS 'ID draftu v KV (EmailBuilder) — vazba na editor.';

CREATE INDEX IF NOT EXISTS idx_campaigns_status ON public.campaigns (status);
CREATE INDEX IF NOT EXISTS idx_campaigns_scheduled
  ON public.campaigns (scheduled_at)
  WHERE scheduled_at IS NOT NULL;

-- ── campaign_recipients ──────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.campaign_recipients (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id UUID NOT NULL REFERENCES public.campaigns(id) ON DELETE CASCADE,
  subscriber_id UUID NOT NULL REFERENCES public.subscribers(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'sending', 'sent', 'failed', 'skipped')),
  provider_message_id TEXT,
  error TEXT,
  sent_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT campaign_recipients_campaign_subscriber_key UNIQUE (campaign_id, subscriber_id)
);
CREATE INDEX IF NOT EXISTS idx_campaign_recipients_campaign_status
  ON public.campaign_recipients (campaign_id, status);
CREATE INDEX IF NOT EXISTS idx_campaign_recipients_subscriber
  ON public.campaign_recipients (subscriber_id);
CREATE INDEX IF NOT EXISTS idx_campaign_recipients_provider_msg
  ON public.campaign_recipients (provider_message_id)
  WHERE provider_message_id IS NOT NULL;
COMMENT ON TABLE public.campaign_recipients IS 'Fronta + výsledek odeslání kampaně per příjemce (send engine, Resend).';

DROP TRIGGER IF EXISTS tr_campaign_recipients_set_updated_at ON public.campaign_recipients;
CREATE TRIGGER tr_campaign_recipients_set_updated_at
  BEFORE UPDATE ON public.campaign_recipients
  FOR EACH ROW
  EXECUTE FUNCTION public.set_row_updated_at();

-- ── RLS (stejně jako ostatní mailing tabulky: čtení authenticated, zápis service role) ──

ALTER TABLE public.campaign_recipients ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS campaign_recipients_select_authenticated ON public.campaign_recipients;
CREATE POLICY campaign_recipients_select_authenticated
  ON public.campaign_recipients FOR SELECT TO authenticated USING (true);
GRANT SELECT ON public.campaign_recipients TO authenticated;

-- ── reporting: agregované statistiky kampaní (stránka /mailing/kampane) ──────
-- SECURITY INVOKER — čtení podkladových tabulek už mají authenticated přes RLS.

CREATE OR REPLACE FUNCTION public.mailing_campaign_stats(p_campaign_ids UUID[])
RETURNS TABLE (
  campaign_id UUID,
  recipients_total BIGINT,
  sent BIGINT,
  failed BIGINT,
  pending BIGINT,
  skipped BIGINT,
  unique_opens BIGINT,
  unique_clicks BIGINT,
  unsubscribes BIGINT,
  bounces BIGINT
)
LANGUAGE sql
STABLE
SET search_path = public
AS $fn$
  WITH rec AS (
    SELECT
      r.campaign_id,
      COUNT(*) AS recipients_total,
      COUNT(*) FILTER (WHERE r.status = 'sent') AS sent,
      COUNT(*) FILTER (WHERE r.status = 'failed') AS failed,
      COUNT(*) FILTER (WHERE r.status IN ('pending', 'sending')) AS pending,
      COUNT(*) FILTER (WHERE r.status = 'skipped') AS skipped
    FROM public.campaign_recipients r
    WHERE r.campaign_id = ANY (p_campaign_ids)
    GROUP BY r.campaign_id
  ),
  ev AS (
    SELECT
      e.campaign_id,
      COUNT(DISTINCT e.subscriber_id) FILTER (WHERE e.event_type = 'open') AS unique_opens,
      COUNT(DISTINCT e.subscriber_id) FILTER (WHERE e.event_type = 'click') AS unique_clicks,
      COUNT(DISTINCT e.subscriber_id) FILTER (WHERE e.event_type = 'unsubscribe') AS unsubscribes,
      COUNT(DISTINCT e.subscriber_id) FILTER (WHERE e.event_type = 'bounce') AS bounces
    FROM public.email_events e
    WHERE e.campaign_id = ANY (p_campaign_ids)
    GROUP BY e.campaign_id
  )
  SELECT
    c.id AS campaign_id,
    COALESCE(rec.recipients_total, 0),
    COALESCE(rec.sent, 0),
    COALESCE(rec.failed, 0),
    COALESCE(rec.pending, 0),
    COALESCE(rec.skipped, 0),
    COALESCE(ev.unique_opens, 0),
    COALESCE(ev.unique_clicks, 0),
    COALESCE(ev.unsubscribes, 0),
    COALESCE(ev.bounces, 0)
  FROM unnest(p_campaign_ids) AS ids(id)
  JOIN public.campaigns c ON c.id = ids.id
  LEFT JOIN rec ON rec.campaign_id = c.id
  LEFT JOIN ev ON ev.campaign_id = c.id;
$fn$;

GRANT EXECUTE ON FUNCTION public.mailing_campaign_stats(UUID[]) TO authenticated;

-- ── engagement_score: noční přepočet z email_events za 90 dní ────────────────
-- Heuristika: open = 10 b, click = 25 b, strop 100. Bez aktivity = 0.

CREATE OR REPLACE FUNCTION public.recompute_engagement_scores()
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $fn$
DECLARE
  updated_count INTEGER;
BEGIN
  WITH activity AS (
    SELECT
      subscriber_id,
      LEAST(
        100,
        COUNT(*) FILTER (WHERE event_type = 'open') * 10
        + COUNT(*) FILTER (WHERE event_type = 'click') * 25
      )::smallint AS score
    FROM public.email_events
    WHERE subscriber_id IS NOT NULL
      AND occurred_at >= now() - interval '90 days'
      AND event_type IN ('open', 'click')
    GROUP BY subscriber_id
  )
  UPDATE public.subscribers s
  SET engagement_score = COALESCE(a.score, 0)
  FROM activity a
  WHERE s.id = a.subscriber_id
    AND s.engagement_score IS DISTINCT FROM a.score;
  GET DIAGNOSTICS updated_count = ROW_COUNT;

  -- Kontakty bez aktivity za 90 dní → 0.
  UPDATE public.subscribers s
  SET engagement_score = 0
  WHERE s.engagement_score <> 0
    AND NOT EXISTS (
      SELECT 1 FROM public.email_events e
      WHERE e.subscriber_id = s.id
        AND e.occurred_at >= now() - interval '90 days'
        AND e.event_type IN ('open', 'click')
    );

  RETURN updated_count;
END;
$fn$;

do $engagement_cron$
declare
  existing_job_id bigint;
begin
  if not exists (select 1 from pg_extension where extname = 'pg_cron') then
    raise notice 'pg_cron není nainstalován — job mailing-engagement-nightly přeskočen.';
    return;
  end if;

  select jobid into existing_job_id from cron.job where jobname = 'mailing-engagement-nightly' limit 1;
  if existing_job_id is not null then
    perform cron.unschedule(existing_job_id);
  end if;

  perform cron.schedule(
    'mailing-engagement-nightly',
    '15 2 * * *',
    'select public.recompute_engagement_scores()'
  );
end;
$engagement_cron$;

-- ── pg_cron: naplánované kampaně (á 1 min) + pokračování rozeslaných dávek ────
-- Secret: DB setting app.mailing_cron_secret = Edge secret MAILING_CRON_SECRET
-- (viz supabase/manual/set_mailing_cron.sql). Bez pg_cron se blok přeskočí.

do $migration$
declare
  v_url text := coalesce(
    nullif(current_setting('app.mailing_cron_url', true), ''),
    'https://iekkundgizzdbmkzatdl.supabase.co/functions/v1/make-server-93a20b6f/cron/mailing-send'
  );
  existing_job_id bigint;
  v_headers jsonb;
begin
  if not exists (select 1 from pg_extension where extname = 'pg_cron') then
    raise notice 'pg_cron není nainstalován — job mailing-send-every-minute přeskočen.';
    return;
  end if;

  select jobid
    into existing_job_id
    from cron.job
    where jobname = 'mailing-send-every-minute'
    limit 1;

  if existing_job_id is not null then
    perform cron.unschedule(existing_job_id);
  end if;

  v_headers := jsonb_strip_nulls(
    jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', case
        when nullif(current_setting('app.mailing_cron_secret', true), '') is not null
        then 'Bearer ' || current_setting('app.mailing_cron_secret', true)
        else null
      end,
      'x-cron-secret', nullif(current_setting('app.mailing_cron_secret', true), '')
    )
  );

  perform cron.schedule(
    'mailing-send-every-minute',
    '* * * * *',
    format(
      $job$
      select net.http_post(
        url := %L,
        headers := %L::jsonb,
        body := '{}'::jsonb
      )
      $job$,
      v_url,
      v_headers::text
    )
  );
end;
$migration$;

-- ── pg_cron: automatizační runner (á 5 min) — vykoná splatné kroky flows ─────

do $automation_cron$
declare
  v_url text := coalesce(
    nullif(current_setting('app.mailing_automation_url', true), ''),
    'https://iekkundgizzdbmkzatdl.supabase.co/functions/v1/make-server-93a20b6f/cron/automation-runner'
  );
  existing_job_id bigint;
  v_headers jsonb;
begin
  if not exists (select 1 from pg_extension where extname = 'pg_cron') then
    raise notice 'pg_cron není nainstalován — job mailing-automation-runner přeskočen.';
    return;
  end if;

  select jobid into existing_job_id from cron.job where jobname = 'mailing-automation-runner' limit 1;
  if existing_job_id is not null then
    perform cron.unschedule(existing_job_id);
  end if;

  v_headers := jsonb_strip_nulls(
    jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', case
        when nullif(current_setting('app.mailing_cron_secret', true), '') is not null
        then 'Bearer ' || current_setting('app.mailing_cron_secret', true)
        else null
      end,
      'x-cron-secret', nullif(current_setting('app.mailing_cron_secret', true), '')
    )
  );

  perform cron.schedule(
    'mailing-automation-runner',
    '*/5 * * * *',
    format(
      $job$
      select net.http_post(
        url := %L,
        headers := %L::jsonb,
        body := '{}'::jsonb
      )
      $job$,
      v_url,
      v_headers::text
    )
  );
end;
$automation_cron$;
