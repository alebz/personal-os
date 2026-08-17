import { NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase'
import { magnitudeGuard } from '@/lib/publico/magnitudeGuard'

export const runtime = 'nodejs'

// GET /api/publico/ticket/audit-factores — AUDITORÍA (no prueba): corre el guardián de orden de magnitud contra
// TODOS los mapeos alias→ingrediente que ya existen, usando el costo unitario histórico (acumulado) de cada uno.
// Si un factor quedó mal desde antes, aquí sale hoy y no dentro de tres meses. Solo lee; no escribe nada.
async function poster<T>(method: string, token: string): Promise<T[]> {
  const r = await fetch(`https://joinposter.com/api/${method}?format=json&token=${encodeURIComponent(token)}`, { cache: 'no-store' })
  const j = await r.json()
  if (j.error) throw new Error(`${method}: ${JSON.stringify(j.error)}`)
  return (j.response ?? []) as T[]
}

export async function GET() {
  const token = process.env.POSTER_TOKEN
  if (!token) return NextResponse.json({ error: 'POSTER_TOKEN no configurado' }, { status: 400 })
  const supabase = createServerClient()

  const [{ data: aliases, error }, ings] = await Promise.all([
    supabase.from('ticket_product_aliases')
      .select('raw_norm, descripcion, poster_ingredient_id, poster_ingredient_type, factor_a_base, importe_acumulado, cantidad_acumulada, iva_tasa')
      .is('deleted_at', null).not('poster_ingredient_id', 'is', null),
    poster<{ ingredient_id: number | string; ingredient_name: string; ingredient_unit: string; prime_cost?: number | string }>('menu.getIngredients', token),
  ])
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const ingById = new Map(ings.map((i) => [Number(i.ingredient_id), { name: i.ingredient_name, unit: i.ingredient_unit, unitCost: Number(i.prime_cost || 0) / 10_000 }]))

  const banderas: Array<{ nombre: string; raw_norm: string; unidad: string; factor: number | null; tuCosto: number; posterCosto: number; ratio: number; importeAcum: number; cantAcum: number }> = []
  const sinComparar: Array<{ nombre: string; raw_norm: string; motivo: string }> = []
  let revisados = 0, pasan = 0

  for (const a of aliases ?? []) {
    revisados++
    const id = Number(a.poster_ingredient_id)
    const nombre = a.descripcion || a.raw_norm
    const ing = ingById.get(id)
    // Mercancía (type 1) o ingrediente no hallado: su costo no vive en getIngredients → no hay contra qué comparar.
    if (!ing) { sinComparar.push({ nombre, raw_norm: a.raw_norm, motivo: a.poster_ingredient_type === 1 ? 'mercancía (sin prime_cost de ingrediente)' : 'ingrediente no encontrado en Poster' }); continue }
    if (!(ing.unitCost > 0)) { sinComparar.push({ nombre, raw_norm: a.raw_norm, motivo: 'sin prime_cost en Poster' }); continue }
    if (a.factor_a_base == null) { sinComparar.push({ nombre, raw_norm: a.raw_norm, motivo: 'sin factor a base aún' }); continue }
    const cant = Number(a.cantidad_acumulada || 0)
    const imp = Number(a.importe_acumulado || 0)
    const num = cant * Number(a.factor_a_base)
    if (!(num > 0) || !(imp > 0)) { sinComparar.push({ nombre, raw_norm: a.raw_norm, motivo: 'sin historial (cantidad/importe acumulado en 0)' }); continue }
    const neto = a.iva_tasa != null ? imp / (1 + Number(a.iva_tasa)) : imp
    const derivado = neto / num
    const warn = magnitudeGuard(derivado, ing.unitCost)
    if (warn) {
      banderas.push({ nombre, raw_norm: a.raw_norm, unidad: ing.unit, factor: Number(a.factor_a_base), tuCosto: round(warn.derivado), posterCosto: round(warn.poster), ratio: Math.round(warn.ratio), importeAcum: round(imp), cantAcum: cant })
    } else {
      pasan++
    }
  }
  banderas.sort((x, y) => y.ratio - x.ratio)
  return NextResponse.json({ revisados, pasan, conBandera: banderas.length, sinComparar: sinComparar.length, banderas, detalleSinComparar: sinComparar })
}

const round = (n: number) => Math.round(n * 10_000) / 10_000
