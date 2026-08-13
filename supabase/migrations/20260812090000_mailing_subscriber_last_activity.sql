-- Poslední open/click z email_events (+ fallback sloupce na subscribers).
-- Engagement audience bere aktivitu z Mailchimp importu i z Resend trackingu.

CREATE OR REPLACE FUNCTION public.mailing_subscriber_last_activity(p_ids UUID[])
RETURNS TABLE (
  subscriber_id UUID,
  last_opened_at TIMESTAMPTZ,
  last_clicked_at TIMESTAMPTZ
)
LANGUAGE sql
STABLE
SET search_path = public
AS $fn$
  SELECT
    s.id AS subscriber_id,
    GREATEST(s.last_opened_at, ev.last_open) AS last_opened_at,
    GREATEST(s.last_clicked_at, ev.last_click) AS last_clicked_at
  FROM unnest(p_ids) AS x(id)
  JOIN public.subscribers s ON s.id = x.id
  LEFT JOIN LATERAL (
    SELECT
      MAX(e.occurred_at) FILTER (WHERE e.event_type = 'open') AS last_open,
      MAX(e.occurred_at) FILTER (WHERE e.event_type = 'click') AS last_click
    FROM public.email_events e
    WHERE e.subscriber_id = s.id
      AND e.event_type IN ('open', 'click')
  ) ev ON true;
$fn$;

GRANT EXECUTE ON FUNCTION public.mailing_subscriber_last_activity(UUID[]) TO service_role;
GRANT EXECUTE ON FUNCTION public.mailing_subscriber_last_activity(UUID[]) TO authenticated;

COMMENT ON FUNCTION public.mailing_subscriber_last_activity(UUID[]) IS
  'Pro engagement audience: max open/click z email_events, jinak sloupce na subscribers.';
