import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { createServerClient } from '@/lib/supabase'
import { reindexNote } from '@/lib/memoryIndex'

export const runtime = 'nodejs'

export async function GET() {
  const supabase = createServerClient()
  const { data, error } = await supabase
    .from('notes')
    .select('*')
    .order('updated_at', { ascending: false })
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data ?? [])
}

export async function POST(req: NextRequest) {
  const { title, content = '', tags = [] } = await req.json()
  if (!title?.trim()) return NextResponse.json({ error: 'title required' }, { status: 400 })

  const supabase = createServerClient()
  const { data, error } = await supabase
    .from('notes')
    .insert({ title: title.trim(), content, tags })
    .select()
    .single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // Index the new note for /api/ask (best-effort).
  if (data) { try { await reindexNote(supabase, data) } catch (err) { console.error('note POST reindex failed', err) } }

  return NextResponse.json(data, { status: 201 })
}
