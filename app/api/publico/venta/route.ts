import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { createServerClient } from '@/lib/supabase'

// POST /api/publico/venta — UPSERT del cierre del día por (scope, date). Una fila por día: si ya
// existe, se edita (anti-doble-conteo). Ventas desglosadas efectivo/tarjeta (efectivo→Caja POS,
// tarjeta→CLIP, derivado por regla en el cliente — aquí solo guardamos los dos montos).
export async function POST(req: NextRequest) {
  let b: { date?: string; efectivo?: number; tarjeta?: number; note?: string }
  try { b = await req.json() } catch { return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }) }
  if (!b.date) return NextResponse.json({ error: 'date required' }, { status: 400 })

  const efectivo = Number(b.efectivo ?? 0)
  const tarjeta = Number(b.tarjeta ?? 0)
  if (efectivo < 0 || tarjeta < 0 || !Number.isFinite(efectivo) || !Number.isFinite(tarjeta))
    return NextResponse.json({ error: 'montos inválidos' }, { status: 400 })

  const supabase = createServerClient()
  // Guardar/editar a mano marca el día 'manual' → el import de Poster ya no lo pisa (tu corrección manda).
  const row = {
    scope: 'publico', date: b.date, month: b.date.slice(0, 7),
    efectivo, tarjeta, note: b.note?.trim() || null, source: 'manual', updated_at: new Date().toISOString(),
  }
  const { data, error } = await supabase
    .from('publico_ventas').upsert(row, { onConflict: 'scope,date' }).select().single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ venta: data })
}

// DELETE /api/publico/venta?id=... — borra el cierre de un día (corrección).
export async function DELETE(req: NextRequest) {
  const id = req.nextUrl.searchParams.get('id')
  if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 })
  const supabase = createServerClient()
  const { error } = await supabase.from('publico_ventas').delete().eq('id', id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
