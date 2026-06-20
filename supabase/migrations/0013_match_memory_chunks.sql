-- 0013_match_memory_chunks.sql
-- SQL function for cosine-similarity search over memory_chunks via pgvector.

create or replace function match_memory_chunks(
  query_embedding  vector(1536),
  match_count      int     default 20,
  match_threshold  float   default 0.0
)
returns table (
  id          uuid,
  content     text,
  metadata    jsonb,
  entity_id   uuid,
  created_at  timestamptz,
  similarity  float
)
language sql stable
as $$
  select
    mc.id,
    mc.content,
    mc.metadata,
    mc.entity_id,
    mc.created_at,
    1 - (mc.embedding <=> query_embedding) as similarity
  from memory_chunks mc
  where mc.embedding is not null
    and 1 - (mc.embedding <=> query_embedding) > match_threshold
  order by mc.embedding <=> query_embedding
  limit match_count;
$$;
