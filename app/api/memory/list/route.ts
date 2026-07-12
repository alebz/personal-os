import { NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase'

export const runtime = 'nodejs'

// GET /api/memory/list — full index of memory_chunks for the /brain browse view.
// Returns every chunk (newest first) WITHOUT the embedding vector. The dataset is small (tens of
// rows), so there's no pagination: the client loads all and filters by canonical kind in-memory.
export async function GET() {
  const supabase = createServerClient()
  const { data, error } = await supabase
    .from('memory_chunks')
    .select('id, content, metadata, created_at')
    .order('created_at', { ascending: false })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data ?? [])
}
