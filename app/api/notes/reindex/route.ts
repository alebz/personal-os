import { NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase'
import { reindexNote } from '@/lib/memoryIndex'

export const runtime = 'nodejs'
export const maxDuration = 300

// POST /api/notes/reindex — one-time backfill. Embeds every note into memory_chunks (same dedup as
// the live POST/PATCH). Run once from the browser/curl. Returns counts.
export async function POST() {
  const supabase = createServerClient()

  const { data: notes, error } = await supabase
    .from('notes')
    .select('id, title, content, tags')
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  let indexed = 0, cleared = 0, failed = 0
  for (const n of notes ?? []) {
    try {
      if (await reindexNote(supabase, n)) indexed++; else cleared++
    } catch (err) {
      console.error('note reindex failed for', n.id, err)
      failed++
    }
  }

  return NextResponse.json({ ok: true, total: notes?.length ?? 0, indexed, cleared, failed })
}
