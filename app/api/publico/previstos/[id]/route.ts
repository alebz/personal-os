import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { createServerClient } from '@/lib/supabase'
import { COST_CATEGORIES } from '@/lib/publico'

export const runtime = 'nodejs'

const CATS: string[] = COST_CATEGORIES.map((c) => c.key)   // fuente única (incluye mantenimiento/empaque/suministros)
const ORIGINS = ['clip', 'caja_chica', 'caja_pos']
const FRECS = ['semanal', 'quincenal', 'mensual', 'bimestral']

// PATCH /api/publico/previstos/[id] — edita cualquier campo (incl. archivar). Solo los presentes en el body.
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  let b: Record<string, unknown>
  try { b = await req.json() } catch { return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }) }
  const upd: Record<string, unknown> = {}
  if (b.concepto !== undefined) { const c = String(b.concepto).trim(); if (!c) return NextResponse.json({ error: 'concepto vacío' }, { status: 400 }); upd.concepto = c }
  if (b.categoria !== undefined) { if (!CATS.includes(String(b.categoria))) return NextResponse.json({ error: 'categoria inválida' }, { status: 400 }); upd.categoria = b.categoria }
  if (b.origin !== undefined) upd.origin = b.origin && ORIGINS.includes(String(b.origin)) ? b.origin : null
  if (b.amount !== undefined) { const a = Number(b.amount); if (!Number.isFinite(a) || a <= 0) return NextResponse.json({ error: 'amount inválido' }, { status: 400 }); upd.amount = a }
  if (b.frecuencia !== undefined) { if (!FRECS.includes(String(b.frecuencia))) return NextResponse.json({ error: 'frecuencia inválida' }, { status: 400 }); upd.frecuencia = b.frecuencia }
  if (b.anchor_date !== undefined) { if (!/^\d{4}-\d{2}-\d{2}$/.test(String(b.anchor_date))) return NextResponse.json({ error: 'anchor_date inválida' }, { status: 400 }); upd.anchor_date = b.anchor_date }
  if (b.ocurrencias !== undefined) upd.ocurrencias = b.ocurrencias != null && Number(b.ocurrencias) > 0 ? Math.round(Number(b.ocurrencias)) : null
  if (b.archived !== undefined) upd.archived = !!b.archived
  if (!Object.keys(upd).length) return NextResponse.json({ error: 'nada que actualizar' }, { status: 400 })

  const supabase = createServerClient()
  const { error } = await supabase.from('publico_previstos').update(upd).eq('id', id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}

// DELETE /api/publico/previstos/[id] — borra la DEFINICIÓN. Los publico_costos que ya creó quedan intactos
// (costo_id on delete set null) → el historial no se toca. Para detener la generación futura sin borrar, archiva.
export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = createServerClient()
  const { error } = await supabase.from('publico_previstos').delete().eq('id', id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
