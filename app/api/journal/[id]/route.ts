import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { createServerClient } from '@/lib/supabase'
import { reindexJournalEntry } from '@/lib/memoryIndex'

export const runtime = 'nodejs'

// PATCH /api/journal/:id — update an entry
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
      updated_at: new Date().toISOString(),
    })
    .eq('id', id)
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // Re-index for /api/ask only when the text actually changed (skip mood-only saves). Best-effort.
  if (body.content !== undefined && data) {
    try { await reindexJournalEntry(supabase, data) } catch (err) { console.error('journal PATCH reindex failed', err) }
  }

  return NextResponse.json(data)
}

// DELETE /api/journal/:id — delete an entry
export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params

  const supabase = createServerClient()
  const { error } = await supabase
    .from('journal_entries')
    .delete()
    .eq('id', id)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // Drop its memory chunk so it stops surfacing in /api/ask.
  await supabase.from('memory_chunks').delete().eq('metadata->>journal_id', id)

  return NextResponse.json({ ok: true })
}
