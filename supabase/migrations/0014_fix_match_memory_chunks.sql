-- 0014_fix_match_memory_chunks.sql
--
-- Two fixes:
--
-- 1. Parameter type text → vector cast.
--    PostgREST serialises number[] as a JSON array.  PostgreSQL has no implicit
--    json-array → vector cast, so the function received a null embedding and
--    returned 0 rows without raising an error.  Accepting `text` and casting
--    inside the body (`::vector`) is the reliable workaround.
--
-- 2. Drop the broken IVFFlat index.
--    It was created with `lists = 100` against ≈5 rows.  pgvector requires
--    roughly 3 × lists rows to build IVFFlat properly; with only 5 rows the
--    index is corrupt and the query planner chose it over a sequential scan,
--    returning 0 results.  HNSW works correctly at any dataset size.

-- Drop the broken IVFFlat index
drop index if exists memory_chunks_embedding_idx;

-- HNSW index: works from 0 rows, better recall, no minimum-row requirement
create index if not exists memory_chunks_embedding_hnsw_idx
  on memory_chunks
  using hnsw (embedding vector_cosine_ops);

-- Drop the old function (different signature, so must drop explicitly)
drop function if exists match_memory_chunks(vector(1536), int, float);

-- Recreate with text parameter so PostgREST's JSON array serialises correctly
create or replace function match_memory_chunks(
  query_embedding  text,
  match_count      int   default 20,
  match_threshold  float default 0.0
)
returns table (
  id         uuid,
  content    text,
  metadata   jsonb,
  entity_id  uuid,
  created_at timestamptz,
  similarity float
)
language sql stable
as $$
  select
    mc.id,
    mc.content,
    mc.metadata,
    mc.entity_id,
    mc.created_at,
    1 - (mc.embedding <=> query_embedding::vector) as similarity
  from memory_chunks mc
  where mc.embedding is not null
    and 1 - (mc.embedding <=> query_embedding::vector) > match_threshold
  order by mc.embedding <=> query_embedding::vector
  limit match_count;
$$;
