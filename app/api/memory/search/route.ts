import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { embed } from '@/lib/openai'
import { createServerClient } from '@/lib/supabase'

export const runtime = 'nodejs'

export async function POST(req: NextRequest) {
  let body: { query?: string; limit?: number }
  try { body = await req.json() } catch { return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }) }

  const { query, limit = 20 } = body
  if (!query?.trim()) return NextResponse.json({ error: 'query required' }, { status: 400 })

  let queryEmbedding: number[]
  try {
    queryEmbedding = await embed(query.trim())
  } catch (err) {
    return NextResponse.json({ error: `Embedding failed: ${String(err)}` }, { status: 502 })
  }

  const supabase = createServerClient()
  // Pass embedding as a formatted text string — PostgreSQL can cast text → vector
  // but has no implicit JSON-array → vector cast (PostgREST sends number[] as JSON).
  const { data, error } = await supabase.rpc('match_memory_chunks', {
    query_embedding: `[${queryEmbedding.join(',')}]`,
    match_count:     Math.min(limit, 50),
    match_threshold: 0.0,
  })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data ?? [])
}
