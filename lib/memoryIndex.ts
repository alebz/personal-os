import { createServerClient } from '@/lib/supabase'
import { embed } from '@/lib/openai'

type SB = ReturnType<typeof createServerClient>

// Embed one piece of text and insert it as a memory_chunk with arbitrary metadata. Bulk callers
// (e.g. the context reindex) own their own dedup (delete-by-metadata) before inserting.
export async function insertMemoryChunk(supabase: SB, content: string, metadata: Record<string, unknown>): Promise<void> {
  const embedding = await embed(content)
  await supabase.from('memory_chunks').insert({ entity_id: null, content, embedding, metadata })
}

// ONE memory_chunk per source row, kept in sync with its text. Each call deletes the row's existing
// chunk(s) first (dedup — repeated saves never pile up), then inserts a fresh one if there's real
// text. Callers own error handling (live routes = best-effort try/catch; backfills = count failures).
// Returns true if a chunk was (re)written, false if the row was left de-indexed (empty/trivial text).

export async function reindexJournalEntry(
  supabase: SB,
  entry: { id: string; content: string | null; entry_date: string; mood: string | null },
): Promise<boolean> {
  await supabase.from('memory_chunks').delete().eq('metadata->>journal_id', entry.id)
  const content = (entry.content ?? '').trim()
  if (content.length <= 10) return false
  const embedding = await embed(content)
  await supabase.from('memory_chunks').insert({
    entity_id: null,
    content,
    embedding,
    metadata: { kind: 'diario', journal_id: entry.id, entry_date: entry.entry_date, mood: entry.mood },
  })
  return true
}

export async function reindexNote(
  supabase: SB,
  note: { id: string; title: string | null; content: string | null; tags?: string[] },
): Promise<boolean> {
  await supabase.from('memory_chunks').delete().eq('metadata->>note_id', note.id)
  // Notes can be terse (a phone number, a PIN), so embed title + body and keep the bar low.
  const text = [note.title?.trim(), (note.content ?? '').trim()].filter(Boolean).join('\n\n').trim()
  if (text.length < 2) return false
  const embedding = await embed(text)
  await supabase.from('memory_chunks').insert({
    entity_id: null,
    content: text,
    embedding,
    metadata: { kind: 'nota', note_id: note.id, tags: note.tags ?? [] },
  })
  return true
}
