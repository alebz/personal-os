import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { createServerClient } from '@/lib/supabase'

export const runtime = 'nodejs'

export async function GET(req: NextRequest) {
  const date = req.nextUrl.searchParams.get('date')
  if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return NextResponse.json({ error: 'date required (YYYY-MM-DD)' }, { status: 400 })
  }

  const supabase = createServerClient()
  const { data, error } = await supabase
    .from('journal_entries')
    .select('*')
    .eq('entry_date', date)
    .maybeSingle()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

export async function POST(req: NextRequest) {
  let body: {
    date: string
    content?: string
    mood?: string | null
    summary?: string
    insights?: string[]
  }
  try { body = await req.json() } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const { date, content, mood, summary, insights } = body
  if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return NextResponse.json({ error: 'date required (YYYY-MM-DD)' }, { status: 400 })
  }

  const supabase = createServerClient()
  const { data, error } = await supabase
    .from('journal_entries')
    .upsert(
      {
        entry_date: date,
        content:    content    ?? null,
        mood:       mood       ?? null,
        summary:    summary    ?? null,
        insights:   insights   ?? [],
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'entry_date' }
    )
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data, { status: 200 })
}
