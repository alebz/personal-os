import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { createServerClient } from '@/lib/supabase'

// GET /api/finance/cards — tarjetas ordenadas. ?archived=1 incluye las archivadas (soft-deleted).
export async function GET(req: NextRequest) {
  const includeArchived = req.nextUrl.searchParams.get('archived') === '1'
  const supabase = createServerClient()
  let q = supabase.from('finance_cards').select('*').order('sort_order').order('created_at')
  if (!includeArchived) q = q.eq('archived', false)
  const { data, error } = await q
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data ?? [])
}

// POST /api/finance/cards — alta. { name, last4?, credit_limit?, cut_day?, due_day? }. Genera la key.
export async function POST(req: NextRequest) {
  let b: { name?: string; last4?: string | null; credit_limit?: number | null; cut_day?: number | null; due_day?: number | null }
  try { b = await req.json() } catch { return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }) }
  if (!b.name?.trim()) return NextResponse.json({ error: 'name required' }, { status: 400 })

  const supabase = createServerClient()
  const { data: last } = await supabase.from('finance_cards').select('sort_order').order('sort_order', { ascending: false }).limit(1).maybeSingle()
  const row = {
    id: `card_${crypto.randomUUID().slice(0, 8)}`,
    name: b.name.trim(),
    last4: b.last4?.trim() || null,
    credit_limit: b.credit_limit ?? null,
    cut_day: b.cut_day ?? null,
    due_day: b.due_day ?? null,
    sort_order: (last?.sort_order ?? -1) + 1,
  }
  const { data, error } = await supabase.from('finance_cards').insert(row).select().single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ card: data })
}
