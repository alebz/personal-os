import { NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase'
import { proposeFactor, normTicketUnit } from '@/lib/publico/unitFactor'

export const runtime = 'nodejs'

type Ing = { ingredient_id: number | string; ingredient_unit?: string }

async function ingUnits(): Promise<Map<number, string>> {
  const token = process.env.POSTER_TOKEN
  const m = new Map<number, string>()
  if (!token) return m
  try {
    const j = (await (await fetch(`https://joinposter.com/api/menu.getIngredients?format=json&token=${encodeURIComponent(token)}`, { cache: 'no-store' })).json()) as { response?: Ing[] }
    for (const i of j.response ?? []) m.set(Number(i.ingredient_id), (i.ingredient_unit ?? '').toLowerCase())
  } catch { /* sin token/red → mapa vacío */ }
  return m
}

// POST /api/publico/alias-factor — rellena el ×factor de los alias YA mapeados a un ingrediente que aún no lo
// tienen, con el CASO A (unidad de la línea → conversión) y, si es pieza, el CASO B (peso del nombre). Solo escribe
// factores NUMÉRICOS; los 'incompatible' (l vs kg) se reportan para que el humano los resuelva con densidad, nunca
// se adivinan. NUNCA pisa un factor existente. Full-scope (fuera del prefijo /ticket → captura no lo alcanza).
export async function POST() {
  const supabase = createServerClient()
  const [units, aliasesR] = await Promise.all([
    ingUnits(),
    supabase.from('ticket_product_aliases')
      .select('raw_norm, descripcion, unidad, poster_ingredient_id, poster_ingredient_type, factor_a_base')
      .is('deleted_at', null).not('poster_ingredient_id', 'is', null).is('factor_a_base', null),
  ])
  if (aliasesR.error) return NextResponse.json({ error: aliasesR.error.message }, { status: 500 })
  const rows = (aliasesR.data ?? []).filter((a) => Number(a.poster_ingredient_type) === 10)   // solo ingredientes (mercancía = pieza, factor manual)

  const resolved: { alias: string; factor: number; via: 'A · unidad de línea' | 'B · peso del nombre' }[] = []
  const incompatible: { alias: string; ticketUnit: string | null; ingUnit: string }[] = []
  const ambiguo: { alias: string }[] = []

  for (const a of rows) {
    const ingUnit = units.get(Number(a.poster_ingredient_id)) ?? ''
    const f = proposeFactor(a.descripcion, a.unidad, ingUnit)
    if (typeof f === 'number') {
      const { error } = await supabase.from('ticket_product_aliases').update({ factor_a_base: f, updated_at: new Date().toISOString() }).eq('raw_norm', a.raw_norm)
      if (!error) {
        const tu = normTicketUnit(a.unidad)
        resolved.push({ alias: a.descripcion, factor: f, via: tu && tu !== 'PZA' ? 'A · unidad de línea' : 'B · peso del nombre' })
      }
    } else if (f === 'incompatible') {
      incompatible.push({ alias: a.descripcion, ticketUnit: a.unidad ?? null, ingUnit })
    } else {
      ambiguo.push({ alias: a.descripcion })
    }
  }

  return NextResponse.json({
    scanned: rows.length,
    resolved: resolved.length,
    incompatible: incompatible.length,
    ambiguo: ambiguo.length,
    details: { resolved, incompatible, ambiguo },
  })
}
