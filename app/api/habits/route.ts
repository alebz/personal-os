import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { createServerClient } from '@/lib/supabase'

// GET /api/habits?days=30[&today=YYYY-MM-DD]
// The optional `today` param lets the client anchor the end of the range to
// *its* local date rather than the server's UTC date — so users in timezones
// ahead of UTC don't lose today's data.
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const days = Math.min(Math.max(parseInt(searchParams.get('days') ?? '30', 10), 1), 365)

  // Prefer the client-supplied local date; fall back to server UTC + 1 day
  // buffer to handle even the most extreme (UTC+14) offset.
  const endStr =
    searchParams.get('today') ??
    (() => {
      const d = new Date()
      d.setDate(d.getDate() + 1)
      return d.toISOString().split('T')[0]
    })()

  // Walk back `days` from the end date
  const startDate = new Date(endStr + 'T00:00:00Z')
  startDate.setDate(startDate.getDate() - days)
  const startStr = startDate.toISOString().split('T')[0]

  const supabase = createServerClient()
  const { data, error } = await supabase
    .from('daily_logs')
    .select('log_date, metadata')
    .eq('kind', 'habits')
    .gte('log_date', startStr)
    .lte('log_date', endStr)
    .order('log_date', { ascending: false })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const rows = (data ?? []).map((row) => ({
    date: row.log_date as string,
    habits: (row.metadata as Record<string, unknown> | null)?.habits ?? {
      done: [] as string[],
      total: 6,
    },
  }))

  return NextResponse.json(rows)
}
