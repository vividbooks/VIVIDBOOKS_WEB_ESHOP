drop extension if exists "pg_net";

drop extension if exists "vector";

create extension if not exists "pg_net" with schema "public";

create extension if not exists "vector" with schema "public";

drop policy "app_settings_admin_delete" on "public"."app_settings";

drop policy "app_settings_admin_insert" on "public"."app_settings";

drop policy "app_settings_admin_select" on "public"."app_settings";

drop policy "app_settings_admin_update" on "public"."app_settings";

drop policy "chat_messages_admin_delete" on "public"."chat_messages";

drop policy "chat_messages_admin_insert" on "public"."chat_messages";

drop policy "chat_messages_admin_select" on "public"."chat_messages";

drop policy "chat_messages_admin_update" on "public"."chat_messages";

drop policy "chat_threads_admin_delete" on "public"."chat_threads";

drop policy "chat_threads_admin_insert" on "public"."chat_threads";

drop policy "chat_threads_admin_select" on "public"."chat_threads";

drop policy "chat_threads_admin_update" on "public"."chat_threads";

drop policy "rag_chunks_admin_delete" on "public"."rag_chunks";

drop policy "rag_chunks_admin_insert" on "public"."rag_chunks";

drop policy "rag_chunks_admin_select" on "public"."rag_chunks";

drop policy "rag_chunks_admin_update" on "public"."rag_chunks";

drop policy "source_documents_admin_delete" on "public"."source_documents";

drop policy "source_documents_admin_insert" on "public"."source_documents";

drop policy "source_documents_admin_select" on "public"."source_documents";

drop policy "source_documents_admin_update" on "public"."source_documents";

drop function if exists "public"."match_rag_chunks"(p_query_embedding extensions.vector, p_match_count integer, p_source_types text[], p_document_ids uuid[], p_metadata_filter jsonb);

drop index if exists "public"."idx_order_items_order_id";

drop index if exists "public"."idx_orders_idempotency_pending";

drop index if exists "public"."idx_orders_status_created_nonterminal";

drop index if exists "public"."idx_rag_chunks_document_id_created";

drop index if exists "public"."idx_source_documents_active_source";


  create table "public"."assignments" (
    "id" uuid not null default gen_random_uuid(),
    "instruction_text" text not null default ''::text,
    "instruction_image" text,
    "created_at" timestamp with time zone not null default now()
      );



  create table "public"."submissions" (
    "id" uuid not null default gen_random_uuid(),
    "assignment_id" uuid not null,
    "student_name" text not null,
    "circuit_encoded" text not null,
    "created_at" timestamp with time zone not null default now()
      );


alter table "public"."app_settings" disable row level security;

alter table "public"."chat_messages" disable row level security;

alter table "public"."chat_threads" disable row level security;

alter table "public"."rag_chunks" alter column "embedding" set data type public.vector(3072) using "embedding"::public.vector(3072);

alter table "public"."rag_chunks" disable row level security;

alter table "public"."source_documents" disable row level security;

CREATE UNIQUE INDEX assignments_pkey ON public.assignments USING btree (id);

CREATE INDEX submissions_assignment_id_idx ON public.submissions USING btree (assignment_id);

CREATE UNIQUE INDEX submissions_pkey ON public.submissions USING btree (id);

alter table "public"."assignments" add constraint "assignments_pkey" PRIMARY KEY using index "assignments_pkey";

alter table "public"."submissions" add constraint "submissions_pkey" PRIMARY KEY using index "submissions_pkey";

alter table "public"."submissions" add constraint "submissions_assignment_id_fkey" FOREIGN KEY (assignment_id) REFERENCES public.assignments(id) ON DELETE CASCADE not valid;

alter table "public"."submissions" validate constraint "submissions_assignment_id_fkey";

set check_function_bodies = off;

CREATE OR REPLACE FUNCTION public.match_rag_chunks(p_query_embedding public.vector, p_match_count integer DEFAULT 8, p_source_types text[] DEFAULT NULL::text[], p_document_ids uuid[] DEFAULT NULL::uuid[], p_metadata_filter jsonb DEFAULT '{}'::jsonb)
 RETURNS TABLE(chunk_id uuid, document_id uuid, source_type text, source_id text, title text, chunk_index integer, content text, metadata jsonb, token_count integer, cosine_distance real, similarity real)
 LANGUAGE sql
 STABLE
AS $function$
  select
    rc.id as chunk_id,
    rc.document_id,
    sd.source_type,
    sd.source_id,
    sd.title,
    rc.chunk_index,
    rc.text as content,
    rc.metadata,
    rc.token_count,
    (rc.embedding <=> p_query_embedding)::real as cosine_distance,
    (1 - (rc.embedding <=> p_query_embedding))::real as similarity
  from public.rag_chunks rc
  join public.source_documents sd on sd.id = rc.document_id
  where sd.is_active = true
    and rc.embedding is not null
    and (p_source_types is null or sd.source_type = any (p_source_types))
    and (p_document_ids is null or rc.document_id = any (p_document_ids))
    and (
      p_metadata_filter = '{}'::jsonb
      or rc.metadata @> p_metadata_filter
      or sd.metadata @> p_metadata_filter
    )
  order by rc.embedding <=> p_query_embedding
  limit greatest(coalesce(p_match_count, 8), 1);
$function$
;

CREATE OR REPLACE FUNCTION public.delete_old_chat_threads(p_agent_key text DEFAULT NULL::text, p_older_than interval DEFAULT '30 days'::interval)
 RETURNS integer
 LANGUAGE plpgsql
AS $function$
declare
  v_deleted integer := 0;
begin
  with deleted as (
    delete from public.chat_threads
    where status = 'deleted'
       or (
         coalesce(last_message_at, updated_at, created_at) < now() - p_older_than
         and (p_agent_key is null or agent_key = p_agent_key)
       )
    returning 1
  )
  select count(*) into v_deleted
  from deleted;

  return v_deleted;
end;
$function$
;

CREATE OR REPLACE FUNCTION public.generate_order_number(p_created_at timestamp with time zone DEFAULT now())
 RETURNS text
 LANGUAGE plpgsql
AS $function$
declare
  order_year text;
  order_prefix text;
  next_number integer;
begin
  order_year := to_char(coalesce(p_created_at, now()), 'YYYY');
  order_prefix := 'VB-' || order_year || '-';

  perform pg_advisory_xact_lock(hashtext('public.orders.order_number.' || order_year));

  select coalesce(
    max(substring(order_number from '([0-9]{4})$')::integer),
    0
  ) + 1
  into next_number
  from public.orders
  where order_number like order_prefix || '%';

  return order_prefix || lpad(next_number::text, 4, '0');
end;
$function$
;

CREATE OR REPLACE FUNCTION public.orders_set_order_number()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
begin
  if new.order_number is null or btrim(new.order_number) = '' then
    new.order_number := public.generate_order_number(new.created_at);
  end if;

  return new;
end;
$function$
;

CREATE OR REPLACE FUNCTION public.set_row_updated_at()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
begin
  new.updated_at = now();
  return new;
end;
$function$
;

CREATE OR REPLACE FUNCTION public.subscriber_ids_by_subject_interests(p_slugs text[])
 RETURNS SETOF uuid
 LANGUAGE sql
 STABLE
 SET search_path TO 'public'
AS $function$
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
$function$
;

CREATE OR REPLACE FUNCTION public.touch_chat_thread_from_message()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
declare
  v_thread_id text;
begin
  v_thread_id := coalesce(new.thread_id, old.thread_id);

  update public.chat_threads t
  set
    updated_at = now(),
    last_message_at = (
      select max(m.created_at)
      from public.chat_messages m
      where m.thread_id = v_thread_id
    )
  where t.id = v_thread_id;

  return coalesce(new, old);
end;
$function$
;

CREATE OR REPLACE FUNCTION public.trim_chat_thread_messages(p_thread_id text, p_keep_last integer DEFAULT 50)
 RETURNS integer
 LANGUAGE plpgsql
AS $function$
declare
  v_deleted integer := 0;
begin
  with ranked as (
    select
      id,
      row_number() over (
        order by created_at desc, id desc
      ) as rn
    from public.chat_messages
    where thread_id = p_thread_id
  ),
  deleted as (
    delete from public.chat_messages
    where id in (
      select id
      from ranked
      where rn > greatest(coalesce(p_keep_last, 50), 0)
    )
    returning 1
  )
  select count(*) into v_deleted
  from deleted;

  return v_deleted;
end;
$function$
;

grant delete on table "public"."assignments" to "anon";

grant insert on table "public"."assignments" to "anon";

grant references on table "public"."assignments" to "anon";

grant select on table "public"."assignments" to "anon";

grant trigger on table "public"."assignments" to "anon";

grant truncate on table "public"."assignments" to "anon";

grant update on table "public"."assignments" to "anon";

grant delete on table "public"."assignments" to "authenticated";

grant insert on table "public"."assignments" to "authenticated";

grant references on table "public"."assignments" to "authenticated";

grant select on table "public"."assignments" to "authenticated";

grant trigger on table "public"."assignments" to "authenticated";

grant truncate on table "public"."assignments" to "authenticated";

grant update on table "public"."assignments" to "authenticated";

grant delete on table "public"."assignments" to "service_role";

grant insert on table "public"."assignments" to "service_role";

grant references on table "public"."assignments" to "service_role";

grant select on table "public"."assignments" to "service_role";

grant trigger on table "public"."assignments" to "service_role";

grant truncate on table "public"."assignments" to "service_role";

grant update on table "public"."assignments" to "service_role";

grant delete on table "public"."submissions" to "anon";

grant insert on table "public"."submissions" to "anon";

grant references on table "public"."submissions" to "anon";

grant select on table "public"."submissions" to "anon";

grant trigger on table "public"."submissions" to "anon";

grant truncate on table "public"."submissions" to "anon";

grant update on table "public"."submissions" to "anon";

grant delete on table "public"."submissions" to "authenticated";

grant insert on table "public"."submissions" to "authenticated";

grant references on table "public"."submissions" to "authenticated";

grant select on table "public"."submissions" to "authenticated";

grant trigger on table "public"."submissions" to "authenticated";

grant truncate on table "public"."submissions" to "authenticated";

grant update on table "public"."submissions" to "authenticated";

grant delete on table "public"."submissions" to "service_role";

grant insert on table "public"."submissions" to "service_role";

grant references on table "public"."submissions" to "service_role";

grant select on table "public"."submissions" to "service_role";

grant trigger on table "public"."submissions" to "service_role";

grant truncate on table "public"."submissions" to "service_role";

grant update on table "public"."submissions" to "service_role";


