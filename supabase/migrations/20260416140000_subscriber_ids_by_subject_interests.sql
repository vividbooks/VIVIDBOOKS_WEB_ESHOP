-- Pro Audience filtr: kontakt má alespoň jeden z uvedených slugů v subject_interest_scores s hodnotou > 0.

CREATE OR REPLACE FUNCTION public.subscriber_ids_by_subject_interests(p_slugs text[])
RETURNS SETOF uuid
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = public
AS $$
  SELECT s.id
  FROM public.subscribers s
  WHERE p_slugs IS NOT NULL
    AND cardinality(p_slugs) > 0
    AND EXISTS (
      SELECT 1
      FROM unnest(p_slugs) AS u(slug)
      WHERE s.subject_interest_scores ? u.slug
        AND coalesce((s.subject_interest_scores->>u.slug)::numeric, 0) > 0
    );
$$;

COMMENT ON FUNCTION public.subscriber_ids_by_subject_interests IS 'Vrátí id kontaktů s nenulovým skóre pro alespoň jeden z předaných slugů (OR).';

GRANT EXECUTE ON FUNCTION public.subscriber_ids_by_subject_interests(text[]) TO authenticated;
GRANT EXECUTE ON FUNCTION public.subscriber_ids_by_subject_interests(text[]) TO service_role;
