import { NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase'
import { reindexJournalEntry } from '@/lib/memoryIndex'

export const runtime = 'nodejs'
export const maxDuration = 300

// POST /api/journal/reindex — one-time backfill. Embeds every journal entry that has real content
// into memory_chunks (same dedup as the live PATCH). Run once from the browser/curl. Returns counts.
export async function POST() {
  const supabase = createServerClient()

  const { data: entries, error } = await supabase
    .from('journal_entries')
    .select('id, content, entry_date, mood')
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  let indexed = 0, cleared = 0, failed = 0
  for (const e of entries ?? []) {
    try {
      if (await reindexJournalEntry(supabase, e)) indexed++; else cleared++
    } catch (err) {
      console.error('journal reindex failed for', e.id, err)
      failed++
    }
  }

  return NextResponse.json({ ok: true, total: entries?.length ?? 0, indexed, cleared, failed })
}
