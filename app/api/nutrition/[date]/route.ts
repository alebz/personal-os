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

function isValidDate(s: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(s)
}

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ date: string }> }
) {
  const { date } = await params
  if (!isValidDate(date)) {
    return NextResponse.json({ error: 'Invalid date' }, { status: 400 })
  }

  const supabase = createServerClient()
  const { data, error } = await supabase
    .from('daily_logs')
    .select('metadata')
    .eq('log_date', date)
    .maybeSingle()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const meta = data?.metadata as Record<string, { meals?: Meal[] }> | null
  const meals: Meal[] = meta?.nutrition?.meals ?? []

  return NextResponse.json({ meals })
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ date: string }> }
) {
  const { date } = await params
  if (!isValidDate(date)) {
    return NextResponse.json({ error: 'Invalid date' }, { status: 400 })
  }

  let body: { meals?: Meal[] }
  try { body = await req.json() } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const meals = Array.isArray(body.meals) ? body.meals : []

  const supabase = createServerClient()

  // Fetch existing row to merge other metadata fields
  const { data: existing } = await supabase
    .from('daily_logs')
    .select('id, metadata')
    .eq('log_date', date)
    .maybeSingle()

  const mergedMeta = {
    ...(existing?.metadata as Record<string, unknown> ?? {}),
    nutrition: { meals },
  }

  let error: { message: string } | null = null

  if (existing) {
    const result = await supabase
      .from('daily_logs')
      .update({ metadata: mergedMeta, updated_at: new Date().toISOString() })
      .eq('id', existing.id)
    error = result.error
  } else {
    const result = await supabase
      .from('daily_logs')
      .insert({ log_date: date, metadata: mergedMeta })
    error = result.error
  }

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
