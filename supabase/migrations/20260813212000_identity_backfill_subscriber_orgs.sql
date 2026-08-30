-- IČO/členství ze subscriberů (jen validní 8 číslic) — malá množina, po people backfillu.

CREATE OR REPLACE FUNCTION public.identity_backfill_subscriber_orgs()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  orgs_n int := 0;
  mem_n int := 0;
BEGIN
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

  RETURN jsonb_build_object('orgs_inserted', orgs_n, 'memberships_inserted', mem_n);
END;
$$;

GRANT EXECUTE ON FUNCTION public.identity_backfill_subscriber_orgs() TO service_role;
