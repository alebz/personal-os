import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { createServerClient } from '@/lib/supabase'

export const runtime = 'nodejs'

interface Meal {
  id:        string
  t:         string
  n:         string
  kcal:      number
  p:         number
  c:         number
  f:         number
  estimated: boolean
}

interface DayRecord {
  date:  string
  meals: Meal[]
  kcal:  number
  p:     number
  c:     number
  f:     number
}

export async function GET(req: NextRequest) {
  const daysParam = req.nextUrl.searchParams.get('days')
  const days = Math.min(Math.max(parseInt(daysParam ?? '30') || 30, 1), 90)

  const cutoff = new Date()
  cutoff.setDate(cutoff.getDate() - days)
  const cutoffStr = cutoff.toISOString().slice(0, 10)

  const supabase = createServerClient()
  const { data, error } = await supabase
    .from('daily_logs')
    .select('log_date, metadata')
    .gte('log_date', cutoffStr)
    .order('log_date', { ascending: false })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const records: DayRecord[] = (data ?? [])
    .map(row => {
      const meta = row.metadata as Record<string, { meals?: Meal[] }> | null
      const meals: Meal[] = meta?.nutrition?.meals ?? []
      const kcal = meals.reduce((s, m) => s + (m.kcal ?? 0), 0)
      const p    = meals.reduce((s, m) => s + (m.p    ?? 0), 0)
      const c    = meals.reduce((s, m) => s + (m.c    ?? 0), 0)
      const f    = meals.reduce((s, m) => s + (m.f    ?? 0), 0)
      return { date: row.log_date as string, meals, kcal, p, c, f }
    })
    .filter(r => r.meals.length > 0)

  return NextResponse.json(records)
}
