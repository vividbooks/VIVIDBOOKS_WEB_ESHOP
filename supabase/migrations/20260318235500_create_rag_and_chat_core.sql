-- Core storage model for scalable RAG, chat persistence, and small app settings.

create extension if not exists pgcrypto;
create extension if not exists vector;

create or replace function public.set_row_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create table if not exists public.app_settings (
  key text primary key,
  value jsonb not null default '{}'::jsonb,
  description text,
  updated_at timestamptz not null default now()
);

create table if not exists public.source_documents (
  id uuid primary key default gen_random_uuid(),
  source_type text not null,
  source_id text not null,
  title text,
  language text not null default 'cs',
  ingest_state text not null default 'pending'
    check (ingest_state in ('pending', 'indexed', 'failed', 'skipped')),
  content_hash text not null,
  raw_storage_path text,
  raw_content_size_bytes integer
    check (raw_content_size_bytes is null or raw_content_size_bytes >= 0),
  metadata jsonb not null default '{}'::jsonb,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  last_ingested_at timestamptz,
  unique (source_type, source_id)
);

create table if not exists public.rag_chunks (
  id uuid primary key default gen_random_uuid(),
  document_id uuid not null references public.source_documents(id) on delete cascade,
  chunk_index integer not null check (chunk_index >= 0),
  text text not null check (length(trim(text)) > 0),
  token_count integer check (token_count is null or token_count >= 0),
  content_hash text not null,
  metadata jsonb not null default '{}'::jsonb,
  embedding vector(3072),
  search_tsv tsvector generated always as (to_tsvector('simple', coalesce(text, ''))) stored,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (document_id, chunk_index)
);

create table if not exists public.chat_threads (
  id text primary key,
  agent_key text not null,
  title text not null default 'New chat',
  status text not null default 'active'
    check (status in ('active', 'archived', 'deleted')),
  summary text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  last_message_at timestamptz
);

create table if not exists public.chat_messages (
  id text primary key,
  thread_id text not null references public.chat_threads(id) on delete cascade,
  role text not null
    check (role in ('user', 'assistant', 'system', 'tool')),
  message_kind text not null default 'message'
    check (message_kind in ('message', 'action', 'event')),
  content text not null default '',
  content_format text not null default 'text'
    check (content_format in ('text', 'markdown', 'html', 'json')),
  token_count integer check (token_count is null or token_count >= 0),
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists app_settings_updated_at_idx
  on public.app_settings (updated_at desc);

create index if not exists source_documents_source_type_idx
  on public.source_documents (source_type);

create index if not exists source_documents_ingest_state_idx
  on public.source_documents (ingest_state);

create index if not exists source_documents_last_ingested_at_idx
  on public.source_documents (last_ingested_at desc nulls last);

create index if not exists source_documents_metadata_gin_idx
  on public.source_documents using gin (metadata);

create index if not exists source_documents_active_idx
  on public.source_documents (is_active)
  where is_active = true;

create index if not exists rag_chunks_document_id_idx
  on public.rag_chunks (document_id);

create index if not exists rag_chunks_content_hash_idx
  on public.rag_chunks (content_hash);

create index if not exists rag_chunks_metadata_gin_idx
  on public.rag_chunks using gin (metadata);

create index if not exists rag_chunks_search_tsv_gin_idx
  on public.rag_chunks using gin (search_tsv);

-- New Supabase projects currently reject HNSW indexes for vector(3072).
-- Keep the embedding column and skip the ANN index so migrations stay portable.

create index if not exists chat_threads_agent_key_updated_at_idx
  on public.chat_threads (agent_key, updated_at desc);

create index if not exists chat_threads_status_idx
  on public.chat_threads (status);

create index if not exists chat_messages_thread_id_created_at_idx
  on public.chat_messages (thread_id, created_at desc);

create index if not exists chat_messages_message_kind_idx
  on public.chat_messages (message_kind);

create index if not exists chat_messages_metadata_gin_idx
  on public.chat_messages using gin (metadata);

drop trigger if exists tr_app_settings_set_updated_at on public.app_settings;
create trigger tr_app_settings_set_updated_at
before update on public.app_settings
for each row
execute function public.set_row_updated_at();

drop trigger if exists tr_source_documents_set_updated_at on public.source_documents;
create trigger tr_source_documents_set_updated_at
before update on public.source_documents
for each row
execute function public.set_row_updated_at();

drop trigger if exists tr_rag_chunks_set_updated_at on public.rag_chunks;
create trigger tr_rag_chunks_set_updated_at
before update on public.rag_chunks
for each row
execute function public.set_row_updated_at();

drop trigger if exists tr_chat_threads_set_updated_at on public.chat_threads;
create trigger tr_chat_threads_set_updated_at
before update on public.chat_threads
for each row
execute function public.set_row_updated_at();
