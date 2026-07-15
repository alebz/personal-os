import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { createServerClient } from '@/lib/supabase'

function today(): string {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

// POST /api/finance/funds/movement — write a fund movement (aportación / retiro / ajuste).
// body: { key, flow, amount, description, month, date?, source_key? }
// flow='out' = aportación (money set aside), flow='in' = retiro. When source_key is given the write is
// IDEMPOTENT (delete-by-key then insert) so a toggle can upsert without ever duplicating.
export async function POST(req: NextRequest) {
  let b: {
    key?: string; flow?: 'in' | 'out'; amount?: number
    description?: string; month?: string; date?: string; source_key?: string | null
  }
  try { b = await req.json() } catch { return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }) }
  if (!b.key || (b.flow !== 'in' && b.flow !== 'out') || !b.amount || b.amount <= 0 || !b.description || !b.month) {
    return NextResponse.json({ error: 'key, flow, amount>0, description, month required' }, { status: 400 })
  }

  const supabase = createServerClient()
  const { data: fund, error: fe } = await supabase
    .from('finance_envelopes').select('id').eq('key', b.key).single()
  if (fe || !fund) return NextResponse.json({ error: `fund '${b.key}' not found` }, { status: 404 })

  const row = {
    envelope_id: fund.id, flow: b.flow, amount: b.amount, description: b.description,
    month: b.month, date: b.date ?? today(), category: 'fondo', source_key: b.source_key ?? null,
  }
  if (b.source_key) {
    await supabase.from('finance_movements').delete().eq('source_key', b.source_key)   // idempotent upsert
  }
  const { error } = await supabase.from('finance_movements').insert(row)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}

// DELETE /api/finance/funds/movement?source_key=... — remove a fund movement (e.g. unmarking).
export async function DELETE(req: NextRequest) {
  const source_key = new URL(req.url).searchParams.get('source_key')
  if (!source_key) return NextResponse.json({ error: 'source_key required' }, { status: 400 })
  const supabase = createServerClient()
  const { error } = await supabase.from('finance_movements').delete().eq('source_key', source_key)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
