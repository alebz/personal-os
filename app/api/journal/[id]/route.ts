import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { createServerClient } from '@/lib/supabase'
import { reindexJournalEntry } from '@/lib/memoryIndex'

export const runtime = 'nodejs'

// PATCH /api/journal/:id — update an entry. Also the soft-delete undo: PATCH { archived: false }
// restores an archived entry (and re-indexes its Cerebro chunk).
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params

  let body: {
    content?:  string | null
    mood?:     string | null
    summary?:  string | null
    insights?: string[]
    archived?: boolean
  }
  try { body = await req.json() } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const supabase = createServerClient()
  const { data, error } = await supabase
    .from('journal_entries')
    .update({
      ...(body.content  !== undefined && { content:  body.content }),
      ...(body.mood     !== undefined && { mood:     body.mood }),
      ...(body.summary  !== undefined && { summary:  body.summary }),
      ...(body.insights !== undefined && { insights: body.insights }),
      ...(body.archived !== undefined && { archived: body.archived }),
      updated_at: new Date().toISOString(),
    })
    .eq('id', id)
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // Keep the Cerebro index (memory_chunks) coherent with the entry's live state. Best-effort.
  //   • archived → drop the chunk so it leaves /brain + search.
  //   • restored (archived:false) or text changed → (re)index; reindexJournalEntry dedups and
  //     skips trivial text. Mood-only saves touch nothing (no re-embed).
  try {
    if (data?.archived) {
      await supabase.from('memory_chunks').delete().eq('metadata->>journal_id', id)
    } else if (body.archived === false || body.content !== undefined) {
      if (data) await reindexJournalEntry(supabase, data)
    }
  } catch (err) {
    console.error('journal PATCH chunk sync failed', err)
  }

  return NextResponse.json(data)
}

// DELETE /api/journal/:id — SOFT delete. The journal is irreplaceable, so we never hard-delete:
// mark archived (mirrors habits) and drop the memory chunk so the entry leaves /brain and search.
// Reversible via PATCH { archived: false }. Returns the updated row (for an undo affordance).
export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params

  const supabase = createServerClient()
  const { data, error } = await supabase
    .from('journal_entries')
    .update({ archived: true, updated_at: new Date().toISOString() })
    .eq('id', id)
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // Drop its memory chunk so it stops surfacing in /brain and /api/ask (undo re-indexes it).
  await supabase.from('memory_chunks').delete().eq('metadata->>journal_id', id)

  return NextResponse.json(data)
}
