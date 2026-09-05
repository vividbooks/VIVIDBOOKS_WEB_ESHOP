-- Identity helpers + idempotent backfill (1 subscriber = 1 person + 1 email).
-- Neslučuje podle jména. IČO jen 8 číslic. Telefon/IČO z orders + KV jen když validní.

-- ── mapování ────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.identity_normalize_phone(raw text)
RETURNS text
LANGUAGE sql
IMMUTABLE
PARALLEL SAFE
AS $$
  SELECT CASE
    WHEN d.digits ~ '^420\d{9}$' THEN '+' || d.digits
    WHEN d.digits ~ '^00420\d{9}$' THEN '+420' || substring(d.digits from 6)
    WHEN length(d.digits) = 9 THEN '+420' || d.digits
    ELSE NULL
  END
  FROM (SELECT regexp_replace(coalesce(raw, ''), '\D', '', 'g') AS digits) d
$$;

CREATE OR REPLACE FUNCTION public.identity_map_email_source(raw text)
RETURNS text
LANGUAGE sql
IMMUTABLE
PARALLEL SAFE
AS $$
  SELECT CASE lower(btrim(coalesce(raw, '')))
    WHEN 'mailchimp' THEN 'mailchimp'
    WHEN 'mailchimp_import' THEN 'mailchimp'
    WHEN 'webinar' THEN 'webinar'
    WHEN 'checkout' THEN 'checkout'
    WHEN 'app' THEN 'app'
    WHEN 'vividbooks-app-teacher-registration' THEN 'app'
    WHEN 'pipedrive' THEN 'pipedrive'
    WHEN 'vb_id' THEN 'vb_id'
    WHEN 'trial' THEN 'trial'
    WHEN 'newsletter' THEN 'newsletter'
    ELSE 'other'
  END
$$;

CREATE OR REPLACE FUNCTION public.identity_map_subject_token(tok text)
RETURNS text
LANGUAGE sql
IMMUTABLE
PARALLEL SAFE
AS $$
  SELECT CASE lower(btrim(coalesce(tok, '')))
    WHEN 'physics' THEN 'fyzika'
    WHEN 'fyzika' THEN 'fyzika'
    WHEN 'chemistry' THEN 'chemie'
    WHEN 'chemie' THEN 'chemie'
    WHEN 'mathematics' THEN 'matematika'
    WHEN 'mathematics-1' THEN 'matematika'
    WHEN 'mathematics-2' THEN 'matematika'
    WHEN 'mathematics-1st' THEN 'matematika'
    WHEN 'matematika' THEN 'matematika'
    WHEN 'naturalhistory' THEN 'prirodopis'
    WHEN 'natural history' THEN 'prirodopis'
    WHEN 'prirodopis' THEN 'prirodopis'
    WHEN 'primaryscience' THEN 'prvouka'
    WHEN 'primary science' THEN 'prvouka'
    WHEN 'prvouka' THEN 'prvouka'
    WHEN 'czechlang' THEN 'cesky-jazyk'
    WHEN 'czechlang-1' THEN 'cesky-jazyk'
    WHEN 'czechlang-2' THEN 'cesky-jazyk'
    WHEN 'cesky-jazyk' THEN 'cesky-jazyk'
    WHEN 'other' THEN 'other'
    WHEN 'other-1' THEN 'other'
    WHEN 'other-2' THEN 'other'
    ELSE NULL
  END
$$;

CREATE OR REPLACE FUNCTION public.identity_subject_tokens(mf jsonb)
RETURNS text[]
LANGUAGE sql
IMMUTABLE
PARALLEL SAFE
AS $$
  SELECT coalesce(array_agg(tok), ARRAY[]::text[])
  FROM (
    SELECT btrim(x) AS tok
    FROM unnest(
      CASE
        WHEN jsonb_typeof(mf->'MMERGE7') = 'array' THEN ARRAY(
          SELECT jsonb_array_elements_text(mf->'MMERGE7')
        )
        WHEN jsonb_typeof(mf->'MMERGE7') = 'string' THEN string_to_array(mf->>'MMERGE7', ',')
        ELSE ARRAY[]::text[]
      END
      || CASE
        WHEN jsonb_typeof(mf->'subjects') = 'array' THEN ARRAY(
          SELECT jsonb_array_elements_text(mf->'subjects')
        )
        WHEN jsonb_typeof(mf->'subjects') = 'string' THEN string_to_array(mf->>'subjects', ',')
        ELSE ARRAY[]::text[]
      END
      || CASE
        WHEN nullif(btrim(mf->>'SUBJECT'), '') IS NOT NULL THEN ARRAY[mf->>'SUBJECT']
        ELSE ARRAY[]::text[]
      END
    ) AS x
    WHERE btrim(x) <> ''
  ) s
$$;

CREATE OR REPLACE FUNCTION public.identity_subjects_from_subscriber(mf jsonb, scores jsonb)
RETURNS text[]
LANGUAGE sql
IMMUTABLE
PARALLEL SAFE
AS $$
  SELECT coalesce((
    SELECT array_agg(DISTINCT slug ORDER BY slug)
    FROM (
      SELECT public.identity_map_subject_token(tok) AS slug
      FROM unnest(public.identity_subject_tokens(mf)) AS tok
      UNION
      SELECT key
      FROM jsonb_each_text(coalesce(scores, '{}'::jsonb))
      WHERE key IN ('matematika', 'fyzika', 'chemie', 'prirodopis', 'prvouka', 'cesky-jazyk', 'other')
        AND value ~ '^[0-9.]+$'
        AND value::numeric > 0
    ) u
    WHERE slug IS NOT NULL
  ), ARRAY[]::text[])
$$;

CREATE OR REPLACE FUNCTION public.identity_stages_from_subscriber(mf jsonb)
RETURNS smallint[]
LANGUAGE sql
IMMUTABLE
PARALLEL SAFE
AS $$
  SELECT coalesce((
    SELECT array_agg(DISTINCT st ORDER BY st)
    FROM (
      SELECT CASE
        WHEN lower(replace(btrim(tok), ' ', '')) IN (
          'mathematics-1', 'primaryscience', 'czechlang-1', 'other-1', 'schoolstage-1'
        ) THEN 1::smallint
        WHEN lower(replace(btrim(tok), ' ', '')) IN (
          'mathematics-2', 'czechlang-2', 'other-2', 'schoolstage-2'
        ) THEN 2::smallint
        ELSE NULL
      END AS st
      FROM unnest(public.identity_subject_tokens(mf)) AS tok
    ) s
    WHERE st IS NOT NULL
  ), ARRAY[]::smallint[])
$$;

-- ── backfill kroky ───────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.identity_backfill_from_subscribers()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  people_n int := 0;
  emails_n int := 0;
  orgs_n int := 0;
  mem_n int := 0;
BEGIN
  INSERT INTO public.identity_people (
    id, first_name, last_name, phone, role, subjects, school_stages,
    created_at, updated_at, last_seen_at
  )
  SELECT
    s.id,
    nullif(btrim(s.first_name), ''),
    nullif(btrim(s.last_name), ''),
    public.identity_normalize_phone(s.phone),
    public.mailing_canonical_role(s.position_label),
    public.identity_subjects_from_subscriber(s.merge_fields, s.subject_interest_scores),
    public.identity_stages_from_subscriber(s.merge_fields),
    coalesce(s.created_at, timezone('utc', now())),
    timezone('utc', now()),
    coalesce(s.updated_at, s.created_at, timezone('utc', now()))
  FROM public.subscribers s
  WHERE s.email IS NOT NULL
    AND position('@' in s.email) > 0
  ON CONFLICT (id) DO NOTHING;
  GET DIAGNOSTICS people_n = ROW_COUNT;

  INSERT INTO public.identity_emails (email, person_id, subscriber_id, source, is_primary)
  SELECT
    lower(btrim(s.email)),
    s.id,
    s.id,
    public.identity_map_email_source(s.source::text),
    true
  FROM public.subscribers s
  WHERE s.email IS NOT NULL
    AND position('@' in s.email) > 0
  ON CONFLICT (email) DO NOTHING;
  GET DIAGNOSTICS emails_n = ROW_COUNT;

  INSERT INTO public.identity_orgs (ico, school_name)
  SELECT DISTINCT ON (public.identity_normalize_ico(s.ico))
    public.identity_normalize_ico(s.ico),
    nullif(btrim(s.school_name), '')
  FROM public.subscribers s
  WHERE public.identity_normalize_ico(s.ico) IS NOT NULL
  ORDER BY public.identity_normalize_ico(s.ico), length(coalesce(s.school_name, '')) DESC
  ON CONFLICT (ico) WHERE ico IS NOT NULL DO NOTHING;
  GET DIAGNOSTICS orgs_n = ROW_COUNT;

  INSERT INTO public.identity_memberships (person_id, org_id, role, source)
  SELECT DISTINCT e.person_id, o.id, p.role, 'other'
  FROM public.subscribers s
  JOIN public.identity_emails e ON e.subscriber_id = s.id
  JOIN public.identity_orgs o ON o.ico = public.identity_normalize_ico(s.ico)
  JOIN public.identity_people p ON p.id = e.person_id
  WHERE public.identity_normalize_ico(s.ico) IS NOT NULL
  ON CONFLICT (person_id, org_id) DO NOTHING;
  GET DIAGNOSTICS mem_n = ROW_COUNT;

  RETURN jsonb_build_object(
    'people_inserted', people_n,
    'emails_inserted', emails_n,
    'orgs_inserted', orgs_n,
    'memberships_inserted', mem_n
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.identity_backfill_from_orders()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  orgs_n int := 0;
  people_n int := 0;
  emails_n int := 0;
  mem_n int := 0;
  phone_n int := 0;
BEGIN
  INSERT INTO public.identity_orgs (ico, school_name)
  SELECT DISTINCT ON (public.identity_normalize_ico(o.ico))
    public.identity_normalize_ico(o.ico),
    nullif(btrim(o.school_name), '')
  FROM public.orders o
  WHERE public.identity_normalize_ico(o.ico) IS NOT NULL
  ORDER BY public.identity_normalize_ico(o.ico), length(coalesce(o.school_name, '')) DESC
  ON CONFLICT (ico) WHERE ico IS NOT NULL DO UPDATE
    SET school_name = coalesce(public.identity_orgs.school_name, excluded.school_name);
  GET DIAGNOSTICS orgs_n = ROW_COUNT;

  -- Objednávky bez existující identity: 1 e-mail = 1 nová osoba (neslučovat podle jména).
  DROP TABLE IF EXISTS identity_order_missing;
  CREATE TEMP TABLE identity_order_missing (
    email text PRIMARY KEY,
    person_id uuid NOT NULL DEFAULT gen_random_uuid(),
    first_name text,
    last_name text,
    phone text,
    last_seen_at timestamptz
  ) ON COMMIT DROP;

  INSERT INTO identity_order_missing (email, first_name, last_name, phone, last_seen_at)
  SELECT DISTINCT ON (lower(btrim(o.customer_email)))
    lower(btrim(o.customer_email)),
    nullif(btrim(split_part(o.customer_name, ' ', 1)), ''),
    nullif(btrim(regexp_replace(o.customer_name, '^\S+\s*', '')), ''),
    public.identity_normalize_phone(o.customer_phone),
    o.created_at
  FROM public.orders o
  WHERE o.customer_email IS NOT NULL
    AND position('@' in o.customer_email) > 0
    AND NOT EXISTS (
      SELECT 1 FROM public.identity_emails e
      WHERE e.email = lower(btrim(o.customer_email))
    )
  ORDER BY lower(btrim(o.customer_email)), o.created_at DESC;

  INSERT INTO public.identity_people (id, first_name, last_name, phone, role, last_seen_at)
  SELECT person_id, first_name, last_name, phone, 'unknown', last_seen_at
  FROM identity_order_missing
  ON CONFLICT (id) DO NOTHING;
  GET DIAGNOSTICS people_n = ROW_COUNT;

  INSERT INTO public.identity_emails (email, person_id, source, is_primary)
  SELECT email, person_id, 'checkout', true
  FROM identity_order_missing
  ON CONFLICT (email) DO NOTHING;
  GET DIAGNOSTICS emails_n = ROW_COUNT;

  UPDATE public.identity_people p
  SET phone = src.phone
  FROM (
    SELECT DISTINCT ON (e.person_id)
      e.person_id,
      public.identity_normalize_phone(o.customer_phone) AS phone
    FROM public.orders o
    JOIN public.identity_emails e ON e.email = lower(btrim(o.customer_email))
    WHERE public.identity_normalize_phone(o.customer_phone) IS NOT NULL
    ORDER BY e.person_id, o.created_at DESC
  ) src
  WHERE p.id = src.person_id
    AND (p.phone IS NULL OR btrim(p.phone) = '');
  GET DIAGNOSTICS phone_n = ROW_COUNT;

  INSERT INTO public.identity_memberships (person_id, org_id, role, source)
  SELECT DISTINCT e.person_id, org.id, coalesce(p.role, 'unknown'), 'checkout'
  FROM public.orders o
  JOIN public.identity_emails e ON e.email = lower(btrim(o.customer_email))
  JOIN public.identity_orgs org ON org.ico = public.identity_normalize_ico(o.ico)
  JOIN public.identity_people p ON p.id = e.person_id
  WHERE public.identity_normalize_ico(o.ico) IS NOT NULL
  ON CONFLICT (person_id, org_id) DO NOTHING;
  GET DIAGNOSTICS mem_n = ROW_COUNT;

  RETURN jsonb_build_object(
    'orgs_upserted', orgs_n,
    'people_inserted', people_n,
    'emails_inserted', emails_n,
    'phones_filled', phone_n,
    'memberships_inserted', mem_n
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.identity_backfill_from_kv()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  phone_n int := 0;
  orgs_n int := 0;
  mem_n int := 0;
  role_n int := 0;
BEGIN
  UPDATE public.identity_people p
  SET phone = public.identity_normalize_phone(k.value->>'phone')
  FROM public.kv_store_33b2092f k
  JOIN public.identity_emails e
    ON e.email = lower(btrim(coalesce(k.value->>'email', '')))
  WHERE k.key LIKE 'webinar_reg_%'
    AND e.person_id = p.id
    AND (p.phone IS NULL OR btrim(p.phone) = '')
    AND public.identity_normalize_phone(k.value->>'phone') IS NOT NULL;
  GET DIAGNOSTICS phone_n = ROW_COUNT;

  UPDATE public.identity_people p
  SET role = public.mailing_canonical_role(coalesce(k.value->>'position', k.value->>'positionLabel'))
  FROM public.kv_store_33b2092f k
  JOIN public.identity_emails e
    ON e.email = lower(btrim(coalesce(k.value->>'email', '')))
  WHERE (k.key LIKE 'webinar_reg_%' OR k.key LIKE 'trial_request_email_%')
    AND e.person_id = p.id
    AND p.role IN ('unknown', 'other')
    AND public.mailing_canonical_role(coalesce(k.value->>'position', k.value->>'positionLabel'))
      NOT IN ('unknown', 'other');
  GET DIAGNOSTICS role_n = ROW_COUNT;

  INSERT INTO public.identity_orgs (ico, school_name)
  SELECT DISTINCT ON (public.identity_normalize_ico(raw_ico))
    public.identity_normalize_ico(raw_ico),
    nullif(btrim(school), '')
  FROM (
    SELECT
      coalesce(k.value->>'certificateSchoolIco', k.value->>'ico') AS raw_ico,
      coalesce(k.value->>'certificateSchoolName', k.value->>'schoolName') AS school
    FROM public.kv_store_33b2092f k
    WHERE k.key LIKE 'webinar_reg_%' OR k.key LIKE 'trial_request_email_%'
  ) src
  WHERE public.identity_normalize_ico(raw_ico) IS NOT NULL
  ON CONFLICT (ico) WHERE ico IS NOT NULL DO UPDATE
    SET school_name = coalesce(public.identity_orgs.school_name, excluded.school_name);
  GET DIAGNOSTICS orgs_n = ROW_COUNT;

  INSERT INTO public.identity_memberships (person_id, org_id, role, source)
  SELECT DISTINCT e.person_id, org.id, p.role,
    CASE WHEN k.key LIKE 'trial_request_email_%' THEN 'trial' ELSE 'webinar' END
  FROM public.kv_store_33b2092f k
  JOIN public.identity_emails e
    ON e.email = lower(btrim(coalesce(k.value->>'email', '')))
  JOIN public.identity_orgs org
    ON org.ico = public.identity_normalize_ico(coalesce(k.value->>'certificateSchoolIco', k.value->>'ico'))
  JOIN public.identity_people p ON p.id = e.person_id
  WHERE (k.key LIKE 'webinar_reg_%' OR k.key LIKE 'trial_request_email_%')
    AND public.identity_normalize_ico(coalesce(k.value->>'certificateSchoolIco', k.value->>'ico')) IS NOT NULL
  ON CONFLICT (person_id, org_id) DO NOTHING;
  GET DIAGNOSTICS mem_n = ROW_COUNT;

  RETURN jsonb_build_object(
    'phones_filled', phone_n,
    'roles_filled', role_n,
    'orgs_upserted', orgs_n,
    'memberships_inserted', mem_n
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.identity_backfill()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  subs jsonb;
  ords jsonb;
  kv jsonb;
BEGIN
  subs := public.identity_backfill_from_subscribers();
  ords := public.identity_backfill_from_orders();
  kv := public.identity_backfill_from_kv();
  RETURN jsonb_build_object(
    'subscribers', subs,
    'orders', ords,
    'kv', kv,
    'totals', jsonb_build_object(
      'people', (SELECT count(*) FROM public.identity_people),
      'emails', (SELECT count(*) FROM public.identity_emails),
      'orgs', (SELECT count(*) FROM public.identity_orgs),
      'memberships', (SELECT count(*) FROM public.identity_memberships),
      'merge_review_open', (SELECT count(*) FROM public.identity_merge_review WHERE status = 'open')
    )
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.identity_normalize_phone(text) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.identity_map_email_source(text) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.identity_map_subject_token(text) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.identity_subject_tokens(jsonb) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.identity_subjects_from_subscriber(jsonb, jsonb) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.identity_stages_from_subscriber(jsonb) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.identity_backfill_from_subscribers() TO service_role;
GRANT EXECUTE ON FUNCTION public.identity_backfill_from_orders() TO service_role;
GRANT EXECUTE ON FUNCTION public.identity_backfill_from_kv() TO service_role;
GRANT EXECUTE ON FUNCTION public.identity_backfill() TO service_role;
