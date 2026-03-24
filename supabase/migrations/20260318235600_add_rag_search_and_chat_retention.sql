-- Helper functions for vector retrieval, chat freshness, and retention.

create or replace function public.match_rag_chunks(
  p_query_embedding vector(3072),
  p_match_count integer default 8,
  p_source_types text[] default null,
  p_document_ids uuid[] default null,
  p_metadata_filter jsonb default '{}'::jsonb
)
returns table (
  chunk_id uuid,
  document_id uuid,
  source_type text,
  source_id text,
  title text,
  chunk_index integer,
  content text,
  metadata jsonb,
  token_count integer,
  cosine_distance real,
  similarity real
)
language sql
stable
as $$
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
$$;

create or replace function public.touch_chat_thread_from_message()
returns trigger
language plpgsql
as $$
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
$$;

drop trigger if exists tr_chat_messages_touch_thread on public.chat_messages;
create trigger tr_chat_messages_touch_thread
after insert or update or delete on public.chat_messages
for each row
execute function public.touch_chat_thread_from_message();

create or replace function public.trim_chat_thread_messages(
  p_thread_id text,
  p_keep_last integer default 50
)
returns integer
language plpgsql
as $$
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
$$;

create or replace function public.delete_old_chat_threads(
  p_agent_key text default null,
  p_older_than interval default interval '30 days'
)
returns integer
language plpgsql
as $$
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
$$;

create or replace view public.chat_thread_overview as
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
