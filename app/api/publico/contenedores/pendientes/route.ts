import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { createServerClient } from '@/lib/supabase'

export const runtime = 'nodejs'

// Compras importadas de Poster SIN contenedor asignado (origin null) — el dato no viene en Poster. Mientras
// no se asignen NO tocan ningún cajón (flowSince solo resta si origin === contenedor). Pero una compra
// POSTERIOR al baseline de un cajón sí salió de ahí en la realidad: si no se asigna, el saldo del sistema
// queda inflado respecto al real. La fecha de baseline (de CLIP/caja chica) es la LÍNEA DIVISORIA: solo se
// marcan como pendientes las compras después de ella (las previas ya están dentro del conteo del baseline).
async function earliestBaseline(supabase: ReturnType<typeof createServerClient>): Promise<string | null> {
  const { data } = await supabase.from('publico_contenedor_saldos').select('fecha').in('contenedor', ['clip', 'caja_chica']).order('fecha', { ascending: true }).limit(1)
  return data?.[0]?.fecha ?? null
}

async function pendientes(supabase: ReturnType<typeof createServerClient>) {
  const since = await earliestBaseline(supabase)
  if (!since) return { since: null, items: [] as { id: string; date: string; concepto: string; amount: number }[] }
  // Compras Poster sin contenedor, después de la línea. (renta condonada es sin-caja a propósito → no aplica: no es source poster.)
  const { data } = await supabase.from('publico_costos').select('id, date, amount, note')
    .eq('scope', 'publico').eq('source', 'poster').is('origin', null).gt('date', since).order('date', { ascending: false })
  const items = (data ?? []).map((c) => ({ id: c.id as string, date: c.date as string, concepto: (c.note as string) ?? 'Compra', amount: Number(c.amount) }))
  return { since, items }
}

export async function GET() {
  const supabase = createServerClient()
  const { since, items } = await pendientes(supabase)
  const total = items.reduce((s, i) => s + i.amount, 0)
  return NextResponse.json({ since, count: items.length, total, items })
}

// POST { origin: 'clip'|'caja_chica', ids?: string[] } — asigna contenedor por lote. Sin ids → todas las
// pendientes. flowSince solo debita las posteriores a ESE baseline, así que asignar es siempre seguro.
export async function POST(req: NextRequest) {
  let b: { origin?: string; ids?: string[] }
  try { b = await req.json() } catch { return NextResponse.json({ error: 'JSON inválido' }, { status: 400 }) }
  if (b.origin !== 'clip' && b.origin !== 'caja_chica') return NextResponse.json({ error: 'origin inválido (clip | caja_chica)' }, { status: 400 })
  const supabase = createServerClient()

  let ids = b.ids
  if (!ids || ids.length === 0) { const { items } = await pendientes(supabase); ids = items.map((i) => i.id) }
  if (ids.length === 0) return NextResponse.json({ ok: true, assigned: 0 })

  const { error } = await supabase.from('publico_costos').update({ origin: b.origin }).in('id', ids).is('origin', null).eq('source', 'poster')
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true, assigned: ids.length, origin: b.origin })
}
