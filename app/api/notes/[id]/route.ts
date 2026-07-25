import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { createServerClient } from '@/lib/supabase'
import { reindexNote } from '@/lib/memoryIndex'

export const runtime = 'nodejs'

// GET /api/notes/:id — the source note (title + content separately), so an editor can split the
// title from the body (the search chunk stores them joined as "title\n\ncontent").
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const supabase = createServerClient()
  const { data, error } = await supabase.from('notes').select('*').eq('id', id).single()
  if (error) return NextResponse.json({ error: error.message }, { status: 404 })
  return NextResponse.json(data)
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const body = await req.json()
  const supabase = createServerClient()
  const { data, error } = await supabase
    .from('notes')
    .update({ ...body, updated_at: new Date().toISOString() })
    .eq('id', id)
    .select()
    .single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // Re-index the edited note for /api/ask (best-effort; dedup keeps one chunk).
  if (data) { try { await reindexNote(supabase, data) } catch (err) { console.error('note PATCH reindex failed', err) } }

  return NextResponse.json(data)
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const supabase = createServerClient()
  const { error } = await supabase.from('notes').delete().eq('id', id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // Drop its memory chunk so it stops surfacing in /api/ask.
  await supabase.from('memory_chunks').delete().eq('metadata->>note_id', id)

  return new NextResponse(null, { status: 204 })
}
