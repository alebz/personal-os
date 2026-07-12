import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { createServerClient } from '@/lib/supabase'

export const runtime = 'nodejs'

// GET /api/journal?limit=100[&archived=1]  — active entries, newest first. Soft-deleted (archived)
// entries are hidden by default; pass ?archived=1 to include them (mirrors /api/habits).
export async function GET(req: NextRequest) {
  const limit = Math.min(
    parseInt(req.nextUrl.searchParams.get('limit') ?? '100', 10),
    500
  )
  const includeArchived = req.nextUrl.searchParams.get('archived') === '1'

  const supabase = createServerClient()
  let q = supabase
    .from('journal_entries')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(limit)
  if (!includeArchived) q = q.eq('archived', false)
  const { data, error } = await q

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data ?? [])
}

// POST /api/journal — creates a new entry
export async function POST(req: NextRequest) {
  let body: { entry_date?: string; content?: string; mood?: string | null }
  try { body = await req.json() } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const { entry_date, content = '', mood = null } = body
  if (!entry_date || !/^\d{4}-\d{2}-\d{2}$/.test(entry_date)) {
    return NextResponse.json({ error: 'entry_date required (YYYY-MM-DD)' }, { status: 400 })
  }

  const supabase = createServerClient()
  const { data, error } = await supabase
    .from('journal_entries')
    .insert({
      entry_date,
      content:  content ?? null,
      mood:     mood    ?? null,
      summary:  null,
      insights: [],
    })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data, { status: 201 })
}
