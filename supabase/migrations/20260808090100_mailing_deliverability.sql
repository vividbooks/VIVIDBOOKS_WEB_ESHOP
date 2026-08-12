-- Doručitelnost kampaní: stav doručení per příjemce + rozšířený reporting.
--
-- Doposud se `sent` rovnalo „Resend API přijalo request“. Skutečné doručení hlásí
-- až webhook (email.delivered), bounce se nerozlišoval na hard/soft — každý bounce
-- kontakt natvrdo označil jako `cleaned`, což u přeplněné schránky není správně.

-- ── campaign_recipients: stav doručení ──────────────────────────────────────

ALTER TABLE public.campaign_recipients ADD COLUMN IF NOT EXISTS delivered_at TIMESTAMPTZ;
ALTER TABLE public.campaign_recipients ADD COLUMN IF NOT EXISTS bounce_type TEXT;
ALTER TABLE public.campaign_recipients ADD COLUMN IF NOT EXISTS bounce_reason TEXT;

DO $$ BEGIN
  ALTER TABLE public.campaign_recipients
    ADD CONSTRAINT campaign_recipients_bounce_type_check
    CHECK (bounce_type IS NULL OR bounce_type IN ('hard', 'soft', 'undetermined'));
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

COMMENT ON COLUMN public.campaign_recipients.delivered_at IS 'Potvrzené doručení od Resendu (webhook email.delivered). NULL = jen odesláno přes API.';
COMMENT ON COLUMN public.campaign_recipients.bounce_type IS 'hard = trvalé odmítnutí (kontakt se čistí), soft = dočasné (schránka plná apod.), undetermined = Resend neurčil.';

CREATE INDEX IF NOT EXISTS idx_campaign_recipients_delivered
  ON public.campaign_recipients (campaign_id)
  WHERE delivered_at IS NOT NULL;

-- ── reporting: doplnění doručitelnosti do statistik kampaní ─────────────────
-- Mění se návratový typ, proto DROP + CREATE (CREATE OR REPLACE to neumí).
-- `bounces` zůstává počítané z email_events kvůli historickým datům bez bounce_type;
-- hard/soft rozpad vychází z campaign_recipients, tedy jen z událostí po této migraci.

DROP FUNCTION IF EXISTS public.mailing_campaign_stats(UUID[]);

CREATE FUNCTION public.mailing_campaign_stats(p_campaign_ids UUID[])
RETURNS TABLE (
  campaign_id UUID,
  recipients_total BIGINT,
  sent BIGINT,
  failed BIGINT,
  pending BIGINT,
  skipped BIGINT,
  delivered BIGINT,
  hard_bounces BIGINT,
  soft_bounces BIGINT,
  unique_opens BIGINT,
  unique_clicks BIGINT,
  unsubscribes BIGINT,
  bounces BIGINT,
  complaints BIGINT
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
      COUNT(*) FILTER (WHERE r.status = 'skipped') AS skipped,
      COUNT(*) FILTER (WHERE r.delivered_at IS NOT NULL) AS delivered,
      COUNT(*) FILTER (WHERE r.bounce_type = 'hard') AS hard_bounces,
      COUNT(*) FILTER (WHERE r.bounce_type = 'soft') AS soft_bounces
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
      COUNT(DISTINCT e.subscriber_id) FILTER (WHERE e.event_type = 'bounce') AS bounces,
      COUNT(DISTINCT e.subscriber_id) FILTER (WHERE e.event_type = 'complaint') AS complaints
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
    COALESCE(rec.delivered, 0),
    COALESCE(rec.hard_bounces, 0),
    COALESCE(rec.soft_bounces, 0),
    COALESCE(ev.unique_opens, 0),
    COALESCE(ev.unique_clicks, 0),
    COALESCE(ev.unsubscribes, 0),
    COALESCE(ev.bounces, 0),
    COALESCE(ev.complaints, 0)
  FROM unnest(p_campaign_ids) AS ids(id)
  JOIN public.campaigns c ON c.id = ids.id
  LEFT JOIN rec ON rec.campaign_id = c.id
  LEFT JOIN ev ON ev.campaign_id = c.id;
$fn$;

GRANT EXECUTE ON FUNCTION public.mailing_campaign_stats(UUID[]) TO authenticated;
