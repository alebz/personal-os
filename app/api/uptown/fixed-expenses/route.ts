import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { createServerClient } from '@/lib/supabase'

function addMonths(m: string, n: number): string {
  const [y, mo] = m.split('-').map(Number)
  const d = new Date(y, mo - 1 + n, 1)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}

export async function POST(req: NextRequest) {
  let body: { category?: string; amount?: number; method?: string; month_start?: string }
  try { body = await req.json() } catch { return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }) }

  const { category, amount, method, month_start } = body
  if (!category || amount == null || !month_start) {
    return NextResponse.json({ error: 'category, amount, month_start required' }, { status: 400 })
  }

  const supabase = createServerClient()

  const rows = Array.from({ length: 13 }, (_, i) => ({
    month:    addMonths(month_start, i),
    category,
    amount,
    paid:     false,
    method:   method ?? 'cash',
  }))

  const { data, error } = await supabase
    .from('uptown_fixed_expenses')
    .upsert(rows, { onConflict: 'month,category' })
    .select()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ rows: data }, { status: 201 })
}

export async function PATCH(req: NextRequest) {
  let body: { old_category?: string; new_category?: string; month?: string }
  try { body = await req.json() } catch { return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }) }

  const { old_category, new_category, month } = body
  if (!old_category || !new_category || !month) {
    return NextResponse.json({ error: 'old_category, new_category, month required' }, { status: 400 })
  }

  const supabase = createServerClient()

  const { error } = await supabase
    .from('uptown_fixed_expenses')
    .update({ category: new_category })
    .eq('category', old_category)
    .eq('month', month)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}

export async function DELETE(req: NextRequest) {
  let body: { category?: string; month_from?: string }
  try { body = await req.json() } catch { return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }) }

  const { category, month_from } = body
  if (!category || !month_from) {
    return NextResponse.json({ error: 'category and month_from required' }, { status: 400 })
  }

  const supabase = createServerClient()

  const { error, count } = await supabase
    .from('uptown_fixed_expenses')
    .delete({ count: 'exact' })
    .eq('category', category)
    .gte('month', month_from)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ deleted: count ?? 0 })
}
