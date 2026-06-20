import { NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase'

export const runtime = 'nodejs'

export async function GET() {
  const supabase = createServerClient()
  const { data, error } = await supabase
    .from('journal_entries')
    .select('entry_date, mood, summary')
    .order('entry_date', { ascending: false })
    .limit(30)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data ?? [])
}
