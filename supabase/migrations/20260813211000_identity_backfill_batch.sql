-- Batched subscriber backfill so REST/PostgREST 8s timeout stačí.

CREATE OR REPLACE FUNCTION public.identity_backfill_subscribers_batch(p_limit int DEFAULT 2000)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  people_n int := 0;
  emails_n int := 0;
BEGIN
  IF p_limit IS NULL OR p_limit < 1 THEN
    p_limit := 2000;
  END IF;

  WITH batch AS (
    SELECT s.id, s.email, s.first_name, s.last_name, s.phone, s.position_label,
           s.merge_fields, s.subject_interest_scores, s.source,
           s.created_at, s.updated_at
    FROM public.subscribers s
    WHERE s.email IS NOT NULL
      AND position('@' in s.email) > 0
      AND NOT EXISTS (SELECT 1 FROM public.identity_people p WHERE p.id = s.id)
    LIMIT p_limit
  ),
  ins_people AS (
    INSERT INTO public.identity_people (
      id, first_name, last_name, phone, role, subjects, school_stages,
      created_at, updated_at, last_seen_at
    )
    SELECT
      b.id,
      nullif(btrim(b.first_name), ''),
      nullif(btrim(b.last_name), ''),
      public.identity_normalize_phone(b.phone),
      public.mailing_canonical_role(b.position_label),
      public.identity_subjects_from_subscriber(b.merge_fields, b.subject_interest_scores),
      public.identity_stages_from_subscriber(b.merge_fields),
      coalesce(b.created_at, timezone('utc', now())),
      timezone('utc', now()),
      coalesce(b.updated_at, b.created_at, timezone('utc', now()))
    FROM batch b
    ON CONFLICT (id) DO NOTHING
    RETURNING id
  )
  SELECT count(*) INTO people_n FROM ins_people;

  INSERT INTO public.identity_emails (email, person_id, subscriber_id, source, is_primary)
  SELECT
    lower(btrim(s.email)),
    s.id,
    s.id,
    public.identity_map_email_source(s.source::text),
    true
  FROM public.subscribers s
  WHERE EXISTS (SELECT 1 FROM public.identity_people p WHERE p.id = s.id)
    AND NOT EXISTS (SELECT 1 FROM public.identity_emails e WHERE e.email = lower(btrim(s.email)))
    AND s.email IS NOT NULL
    AND position('@' in s.email) > 0
  LIMIT p_limit;
  GET DIAGNOSTICS emails_n = ROW_COUNT;

  RETURN jsonb_build_object(
    'people_inserted', people_n,
    'emails_inserted', emails_n
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.identity_backfill_subscribers_batch(int) TO service_role;
