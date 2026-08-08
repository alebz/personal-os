import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { createServerClient } from '@/lib/supabase'

// GET /api/finance/card-charges?card_id=… — cargos de una tarjeta, ordenados. ?archived=1 incluye
// archivados. (El progreso "N de M" y el auto-ocultar N/N los deriva el frontend de start_month/meses/
// ended_month contra el mes visto — aquí no hay contador.)
export async function GET(req: NextRequest) {
  const cardId = req.nextUrl.searchParams.get('card_id')
  const includeArchived = req.nextUrl.searchParams.get('archived') === '1'
  const supabase = createServerClient()
  let q = supabase.from('finance_card_charges').select('*').order('sort_order').order('created_at')
  if (cardId) q = q.eq('card_id', cardId)
  if (!includeArchived) q = q.eq('archived', false)
  const { data, error } = await q
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data ?? [])
}

// POST /api/finance/card-charges — alta. { card_id, name, amount, meses, start_month, kind?, attribution? }
export async function POST(req: NextRequest) {
  let b: { card_id?: string; name?: string; amount?: number; meses?: number; start_month?: string; kind?: string; attribution?: string | null; original_amount?: number | null; pending_override?: number | null }
  try { b = await req.json() } catch { return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }) }
  if (!b.card_id) return NextResponse.json({ error: 'card_id required' }, { status: 400 })
  if (!b.name?.trim()) return NextResponse.json({ error: 'name required' }, { status: 400 })
  const amount = Number(b.amount ?? 0)
  const meses = Number(b.meses ?? 0)
  if (!Number.isFinite(amount) || amount < 0) return NextResponse.json({ error: 'amount inválido' }, { status: 400 })
  if (!Number.isInteger(meses) || meses < 1) return NextResponse.json({ error: 'meses inválido' }, { status: 400 })
  if (!b.start_month || !/^\d{4}-\d{2}$/.test(b.start_month)) return NextResponse.json({ error: 'start_month inválido (YYYY-MM)' }, { status: 400 })
  const kind = b.kind === 'attributed' ? 'attributed' : 'personal'
  const attribution = (b.attribution === 'andres' || b.attribution === 'publico') ? b.attribution : null
  // original_amount: base para derivar el saldo pendiente (null = se estima con meses×mensualidad).
  // pending_override: saldo real capturado del estado de cuenta (null = usa el estimado).
  const original_amount = b.original_amount != null && Number.isFinite(Number(b.original_amount)) ? Number(b.original_amount) : null
  const pending_override = b.pending_override != null && Number.isFinite(Number(b.pending_override)) ? Number(b.pending_override) : null

  const supabase = createServerClient()
  const { data: last } = await supabase.from('finance_card_charges').select('sort_order').eq('card_id', b.card_id).order('sort_order', { ascending: false }).limit(1).maybeSingle()
  const row = {
    id: `chg_${crypto.randomUUID().slice(0, 8)}`,
    card_id: b.card_id, name: b.name.trim(), amount, meses, start_month: b.start_month,
    kind, attribution, original_amount, pending_override, sort_order: (last?.sort_order ?? -1) + 1,
  }
  const { data, error } = await supabase.from('finance_card_charges').insert(row).select().single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ charge: data })
}
