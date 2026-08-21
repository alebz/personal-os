import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { createServerClient } from '@/lib/supabase'
import { normAlias } from '@/lib/ticketExtract'

export const runtime = 'nodejs'

// POST /api/publico/proveedores/merge — FUSIÓN de proveedores. body { survivorId, victimIds[] }. Absorbe las
// variantes (SABOR/MÁS SABOR) hacia el sobreviviente (Sabor): re-apunta el historial (publico_costos.proveedor y
// la note del roll-up de ticket, que == proveedor), re-apunta los alias aprendidos, deja APRENDIDA cada variante
// (alias normAlias(nombre) → sobreviviente, para que un futuro OCR/tecleo exacto caiga bien), y borra las
// canónicas absorbidas. No para sesión 'captura' (el middleware solo le abre GET de /proveedores). Owner-only.
export async function POST(req: NextRequest) {
  let b: { survivorId?: string; victimIds?: string[] }
  try { b = await req.json() } catch { return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }) }
  if (!b.survivorId || !Array.isArray(b.victimIds) || b.victimIds.length === 0) return NextResponse.json({ error: 'survivorId y victimIds requeridos' }, { status: 400 })
  const victimIds = b.victimIds.filter((id) => id && id !== b.survivorId)
  if (victimIds.length === 0) return NextResponse.json({ error: 'sin víctimas válidas (¿el sobreviviente estaba en la lista?)' }, { status: 400 })

  const supabase = createServerClient()
  const { data: survivor } = await supabase.from('publico_proveedores').select('id, nombre').eq('id', b.survivorId).maybeSingle()
  if (!survivor) return NextResponse.json({ error: 'sobreviviente no encontrado' }, { status: 404 })
  const { data: victims } = await supabase.from('publico_proveedores').select('id, nombre').in('id', victimIds)
  if (!victims?.length) return NextResponse.json({ error: 'víctimas no encontradas' }, { status: 404 })

  const surv = survivor.nombre
  const now = new Date().toISOString()
  let costosRepointed = 0

  for (const v of victims) {
    // 1) Historial: la columna proveedor y la note-que-ES-el-proveedor (roll-up de ticket). ilike sin comodines =
    //    igualdad case-insensitive, así que no arrastra notas largas de otros movimientos.
    const { count: c1 } = await supabase.from('publico_costos').select('*', { count: 'exact', head: true }).eq('scope', 'publico').ilike('proveedor', v.nombre)
    await supabase.from('publico_costos').update({ proveedor: surv }).eq('scope', 'publico').ilike('proveedor', v.nombre)
    await supabase.from('publico_costos').update({ note: surv }).eq('scope', 'publico').ilike('note', v.nombre)
    costosRepointed += c1 ?? 0
    // 2) Alias aprendidos que apuntaban a la variante → al sobreviviente.
    await supabase.from('ticket_supplier_aliases').update({ proveedor: surv, updated_at: now }).ilike('proveedor', v.nombre)
    // 3) Deja aprendida la variante: futuro texto exacto de v.nombre → sobreviviente.
    await supabase.from('ticket_supplier_aliases').upsert({ raw_norm: normAlias(v.nombre), proveedor: surv, updated_at: now, deleted_at: null }, { onConflict: 'raw_norm' })
  }

  // 4) Borra las canónicas absorbidas.
  const { error: delErr } = await supabase.from('publico_proveedores').delete().in('id', victims.map((v) => v.id))
  if (delErr) return NextResponse.json({ error: delErr.message }, { status: 500 })

  return NextResponse.json({ ok: true, survivor: surv, absorbed: victims.length, costosRepointed })
}
