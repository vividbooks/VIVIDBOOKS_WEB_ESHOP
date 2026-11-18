-- Growth proposals: návrhy změn kampaní (pravidla + LLM vysvětlení) s approval workflow.
-- growth_audit_log: audit trail aplikovaných změn.

create table if not exists public.growth_proposals (
  id uuid primary key default gen_random_uuid(),
  type text not null check (type in ('pause_keyword','add_negative','flag_low_ctr','budget_reallocation','other')),
  entity_type text not null,
  entity_id text,
  entity_name text,
  current_value jsonb,
  proposed_value jsonb,
  evidence jsonb,
  expected_impact jsonb,
  status text not null default 'draft' check (status in ('draft','approved','rejected','applied','failed')),
  approved_by text,
  applied_at timestamptz,
  result jsonb,
  error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists growth_proposals_status_idx on public.growth_proposals (status, created_at desc);
create index if not exists growth_proposals_type_idx on public.growth_proposals (type, created_at desc);

create table if not exists public.growth_audit_log (
  id uuid primary key default gen_random_uuid(),
  at timestamptz not null default now(),
  actor text,
  action text not null,
  entity text,
  before jsonb,
  after jsonb,
  result jsonb,
  error text
);

create index if not exists growth_audit_log_at_idx on public.growth_audit_log (at desc);

alter table public.growth_proposals enable row level security;
alter table public.growth_audit_log enable row level security;
-- Žádné anon/authenticated policy → jen service role.
