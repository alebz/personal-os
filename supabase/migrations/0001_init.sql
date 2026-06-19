-- 0001_init.sql
-- Initial schema for personal-os.

-- Extensions ----------------------------------------------------------------
create extension if not exists "pgcrypto";   -- gen_random_uuid()
create extension if not exists "vector";      -- pgvector, vector() type

-- Tables --------------------------------------------------------------------

create table if not exists entities (
  id          uuid primary key default gen_random_uuid(),
  type        text not null,
  name        text not null,
  data        jsonb not null default '{}'::jsonb,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create table if not exists raw_captures (
  id          uuid primary key default gen_random_uuid(),
  source      text,
  content     text not null,
  metadata    jsonb not null default '{}'::jsonb,
  processed   boolean not null default false,
  created_at  timestamptz not null default now()
);

create table if not exists tasks (
  id          uuid primary key default gen_random_uuid(),
  entity_id   uuid references entities (id) on delete set null,
  title       text not null,
  description text,
  status      text not null default 'todo',
  priority    int,
  due_date    date,
  completed_at timestamptz,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create table if not exists daily_logs (
  id          uuid primary key default gen_random_uuid(),
  log_date    date not null,
  content     text,
  metadata    jsonb not null default '{}'::jsonb,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create table if not exists memory_chunks (
  id          uuid primary key default gen_random_uuid(),
  entity_id   uuid references entities (id) on delete cascade,
  content     text not null,
  embedding   vector(1536),
  metadata    jsonb not null default '{}'::jsonb,
  created_at  timestamptz not null default now()
);

create table if not exists audit_log (
  id          uuid primary key default gen_random_uuid(),
  actor       text,
  action      text not null,
  table_name  text,
  record_id   uuid,
  data        jsonb not null default '{}'::jsonb,
  created_at  timestamptz not null default now()
);

-- Indexes -------------------------------------------------------------------

-- Approximate nearest-neighbour search over embeddings (cosine distance).
create index if not exists memory_chunks_embedding_idx
  on memory_chunks
  using ivfflat (embedding vector_cosine_ops)
  with (lists = 100);

-- Row Level Security: deny-all -----------------------------------------------
-- Enabling RLS with no policies denies all access to anon/authenticated roles.
-- The service role key bypasses RLS for trusted server-side operations.

alter table entities       enable row level security;
alter table raw_captures   enable row level security;
alter table tasks          enable row level security;
alter table daily_logs     enable row level security;
alter table memory_chunks  enable row level security;
alter table audit_log      enable row level security;

alter table entities       force row level security;
alter table raw_captures   force row level security;
alter table tasks          force row level security;
alter table daily_logs     force row level security;
alter table memory_chunks  force row level security;
alter table audit_log      force row level security;
