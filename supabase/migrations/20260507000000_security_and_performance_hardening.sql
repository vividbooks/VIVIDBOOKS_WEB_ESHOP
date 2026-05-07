-- Security + performance hardening (requested from scan findings).
-- Focus: strict RLS for sensitive public tables, function search_path hardening,
-- chat overview view hardening, and RAG/Order query performance improvements.

-- 1) Ensure missing/critical tables have explicit policy controls when present.
DO $$
DECLARE
  tab text;
  policy_expr text;
  pol record;
  has_staff_allowlist boolean := false;
BEGIN
  IF EXISTS (
    SELECT 1
    FROM pg_proc
    WHERE pronamespace = 'public'::regnamespace
      AND proname = 'is_staff_email'
  ) THEN
    has_staff_allowlist := true;
  END IF;

  IF has_staff_allowlist THEN
    policy_expr := 'public.is_staff_email()';
  ELSE
    policy_expr := 'false';
  END IF;

  FOREACH tab IN ARRAY ARRAY[
    'assignments',
    'submissions',
    'source_documents',
    'rag_chunks',
    'chat_threads',
    'chat_messages',
    'app_settings'
  ] LOOP
    IF to_regclass(format('public.%I', tab)) IS NOT NULL THEN
      EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', tab);
      EXECUTE format('ALTER TABLE public.%I FORCE ROW LEVEL SECURITY', tab);

      FOR pol IN
        SELECT policyname
        FROM pg_policies
        WHERE schemaname = 'public'
          AND tablename = tab
      LOOP
        EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', pol.policyname, tab);
      END LOOP;

      EXECUTE format(
        'CREATE POLICY %I ON public.%I FOR SELECT TO authenticated USING (%s)',
        tab || '_admin_select',
        tab,
        policy_expr
      );
      EXECUTE format(
        'CREATE POLICY %I ON public.%I FOR INSERT TO authenticated WITH CHECK (%s)',
        tab || '_admin_insert',
        tab,
        policy_expr
      );
      EXECUTE format(
        'CREATE POLICY %I ON public.%I FOR UPDATE TO authenticated USING (%s) WITH CHECK (%s)',
        tab || '_admin_update',
        tab,
        policy_expr,
        policy_expr
      );
      EXECUTE format(
        'CREATE POLICY %I ON public.%I FOR DELETE TO authenticated USING (%s)',
        tab || '_admin_delete',
        tab,
        policy_expr
      );
    END IF;
  END LOOP;
END $$;

-- 2) Reduce function mutable-path risk: harden search_path for sensitive shared helpers.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_proc WHERE pronamespace = 'public'::regnamespace AND proname = 'set_row_updated_at') THEN
    ALTER FUNCTION public.set_row_updated_at() SET search_path = public, pg_catalog, extensions;
  END IF;

  IF EXISTS (SELECT 1 FROM pg_proc WHERE pronamespace = 'public'::regnamespace AND proname = 'generate_order_number') THEN
    ALTER FUNCTION public.generate_order_number(p_created_at timestamptz) SET search_path = public, pg_catalog, extensions;
  END IF;

  IF EXISTS (SELECT 1 FROM pg_proc WHERE pronamespace = 'public'::regnamespace AND proname = 'orders_set_order_number') THEN
    ALTER FUNCTION public.orders_set_order_number() SET search_path = public, pg_catalog, extensions;
  END IF;

  IF EXISTS (
    SELECT 1 FROM pg_proc
    WHERE pronamespace = 'public'::regnamespace
      AND proname = 'match_rag_chunks'
      AND pronargs = 5
  ) THEN
    ALTER FUNCTION public.match_rag_chunks(
      vector(3072),
      integer,
      text[],
      uuid[],
      jsonb
    ) SET search_path = public, pg_catalog, extensions;
  END IF;

  IF EXISTS (SELECT 1 FROM pg_proc WHERE pronamespace = 'public'::regnamespace AND proname = 'touch_chat_thread_from_message') THEN
    ALTER FUNCTION public.touch_chat_thread_from_message() SET search_path = public, pg_catalog, extensions;
  END IF;

  IF EXISTS (SELECT 1 FROM pg_proc WHERE pronamespace = 'public'::regnamespace AND proname = 'trim_chat_thread_messages') THEN
    ALTER FUNCTION public.trim_chat_thread_messages(text, integer) SET search_path = public, pg_catalog, extensions;
  END IF;

  IF EXISTS (SELECT 1 FROM pg_proc WHERE pronamespace = 'public'::regnamespace AND proname = 'delete_old_chat_threads') THEN
    ALTER FUNCTION public.delete_old_chat_threads(text, interval) SET search_path = public, pg_catalog, extensions;
  END IF;

  IF EXISTS (SELECT 1 FROM pg_proc WHERE pronamespace = 'public'::regnamespace AND proname = 'is_staff_email') THEN
    ALTER FUNCTION public.is_staff_email() SET search_path = public, pg_catalog, extensions;
  END IF;

  IF EXISTS (
    SELECT 1 FROM pg_proc
    WHERE pronamespace = 'public'::regnamespace
      AND proname = 'subscriber_ids_by_subject_interests'
  ) THEN
    ALTER FUNCTION public.subscriber_ids_by_subject_interests(text[]) SET search_path = public, pg_catalog, extensions;
  END IF;
END $$;

-- 3) Restrict broad function execution visibility.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_proc
    WHERE pronamespace = 'public'::regnamespace
      AND proname = 'is_staff_email'
  ) THEN
    REVOKE ALL ON FUNCTION public.is_staff_email() FROM PUBLIC;
    GRANT EXECUTE ON FUNCTION public.is_staff_email() TO authenticated;
  END IF;
END $$;

-- 4) Harden chat view into a barriered view to reduce planner/rewrites risk.
DROP VIEW IF EXISTS public.chat_thread_overview;
CREATE VIEW public.chat_thread_overview
  WITH (security_barrier = true)
AS
select
  t.id,
  t.agent_key,
  t.title,
  t.status,
  t.summary,
  t.metadata,
  t.created_at,
  t.updated_at,
  t.last_message_at,
  count(m.id) as message_count,
  max(m.created_at) as latest_message_at
from public.chat_threads t
left join public.chat_messages m on m.thread_id = t.id
group by
  t.id,
  t.agent_key,
  t.title,
  t.status,
  t.summary,
  t.metadata,
  t.created_at,
  t.updated_at,
  t.last_message_at;

-- 5) RLS plan/perf fixes for high-volume paths.
CREATE INDEX IF NOT EXISTS idx_order_items_order_id
  ON public.order_items (order_id);
CREATE INDEX IF NOT EXISTS idx_orders_status_created_nonterminal
  ON public.orders (status, created_at desc)
  WHERE status NOT IN ('delivered', 'refunded');

-- 6) Indexes for chat/RAG query performance.
CREATE INDEX IF NOT EXISTS idx_source_documents_active_source
  ON public.source_documents (is_active, source_type)
  WHERE is_active = true;
CREATE INDEX IF NOT EXISTS idx_rag_chunks_document_id_created
  ON public.rag_chunks (document_id, created_at);

DO $$
BEGIN
  -- HNSW support varies by Supabase project version; fall back to IVFFLAT.
  BEGIN
    CREATE INDEX IF NOT EXISTS idx_rag_chunks_embedding_hnsw
      ON public.rag_chunks
      USING hnsw (embedding vector_cosine_ops)
      WITH (m = 16, ef_construction = 64);
  EXCEPTION WHEN others THEN
    RAISE NOTICE 'HNSW vector index not available in this environment: %', SQLERRM;
  END;

  BEGIN
    CREATE INDEX IF NOT EXISTS idx_rag_chunks_embedding_ivfflat
      ON public.rag_chunks
      USING ivfflat (embedding vector_l2_ops)
      WITH (lists = 100);
  EXCEPTION WHEN others THEN
    RAISE NOTICE 'IVFFLAT vector index could not be created: %', SQLERRM;
  END;
END $$;
