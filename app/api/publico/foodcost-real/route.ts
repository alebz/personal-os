import { NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase'

export const runtime = 'nodejs'

// FOOD COST REAL basado en TUS CONTEOS — 100% del OS, sin depender del perpetuo roto de Poster.
//   food cost real = (inventario inicial + compras − inventario final) ÷ ventas   … por periodo entre dos conteos.
// inventario = valor de cada conteo (Σ líneas) · compras = publico_costos categoría 'insumo' · ventas = publico_ventas.
// El conteo de cierre incluye la merma revelada, por eso el consumo se mide del día DESPUÉS de un conteo hasta el
// siguiente conteo (inclusive). El primer conteo reconcilia el arranque (write-down), sin gap confiable.

const shiftDay = (iso: string, n: number) => {
  const [y, m, d] = iso.split('-').map(Number)
  const t = new Date(Date.UTC(y, m - 1, d + n))
  return `${t.getUTCFullYear()}-${String(t.getUTCMonth() + 1).padStart(2, '0')}-${String(t.getUTCDate()).padStart(2, '0')}`
}
const daysBetween = (a: string, b: string) => {
  const [ay, am, ad] = a.split('-').map(Number), [by, bm, bd] = b.split('-').map(Number)
  return Math.round((Date.UTC(by, bm - 1, bd) - Date.UTC(ay, am - 1, ad)) / 86_400_000)
}
const todayMX = () => new Date().toLocaleDateString('en-CA', { timeZone: 'America/Mexico_City' })

export async function GET() {
  const supabase = createServerClient()
  const [conteosR, lineasR, comprasR, ventasR] = await Promise.all([
    supabase.from('publico_conteos').select('id, fecha').order('fecha', { ascending: true }),
    supabase.from('publico_conteo_lineas').select('conteo_id, value'),
    supabase.from('publico_costos').select('date, amount').eq('scope', 'publico').eq('category', 'insumo'),
    supabase.from('publico_ventas').select('date, efectivo, tarjeta').eq('scope', 'publico'),
  ])

  const conteos = (conteosR.data ?? []) as Array<{ id: string; fecha: string }>
  // Valor de cada conteo = Σ de sus líneas.
  const valueById = new Map<string, number>()
  for (const l of (lineasR.data ?? []) as Array<{ conteo_id: string; value: number }>)
    valueById.set(l.conteo_id, (valueById.get(l.conteo_id) ?? 0) + Number(l.value))
  const counts = conteos.map((c) => ({ id: c.id, fecha: c.fecha, value: valueById.get(c.id) ?? 0 }))

  const compras = (comprasR.data ?? []) as Array<{ date: string; amount: number }>
  const ventas = (ventasR.data ?? []) as Array<{ date: string; efectivo: number; tarjeta: number }>
  const sumBetween = <T,>(rows: T[], from: string, to: string, val: (r: T) => number, day: (r: T) => string) =>
    rows.reduce((s, r) => (day(r) >= from && day(r) <= to ? s + val(r) : s), 0)
  const comprasIn = (from: string, to: string) => sumBetween(compras, from, to, (r) => Number(r.amount), (r) => r.date)
  const ventasIn = (from: string, to: string) => sumBetween(ventas, from, to, (r) => Number(r.efectivo) + Number(r.tarjeta), (r) => r.date)

  const today = todayMX()
  type Period = { from: string; to: string; days: number; kind: 'confiable' | 'abierto'; invIni: number; invFin: number | null; compras: number; ventas: number; consumo: number | null; realPct: number | null; note?: string }
  const periods: Period[] = []

  // Periodos CONFIABLES entre conteos consecutivos.
  for (let i = 1; i < counts.length; i++) {
    const prev = counts[i - 1], next = counts[i]
    const from = shiftDay(prev.fecha, 1), to = next.fecha
    const comprasP = comprasIn(from, to), ventasP = ventasIn(from, to)
    const consumo = prev.value + comprasP - next.value
    periods.push({
      from, to, days: daysBetween(from, to), kind: 'confiable',
      invIni: prev.value, invFin: next.value, compras: comprasP, ventas: ventasP, consumo,
      realPct: ventasP > 0 ? (consumo / ventasP) * 100 : null,
    })
  }
  // Periodo ABIERTO: desde el último conteo hasta hoy — sin conteo de cierre, el real no es confiable aún.
  if (counts.length) {
    const last = counts[counts.length - 1]
    const from = shiftDay(last.fecha, 1)
    if (from <= today) periods.push({
      from, to: today, days: daysBetween(from, today), kind: 'abierto',
      invIni: last.value, invFin: null, compras: comprasIn(from, today), ventas: ventasIn(from, today), consumo: null, realPct: null,
      note: 'En curso — sin conteo de cierre, el real no es confiable hasta el próximo conteo.',
    })
  }

  const status = counts.length === 0
    ? 'Aún no hay conteos. Haz el primero para arrancar el food cost real por tus conteos.'
    : counts.length === 1
      ? 'Solo hay un conteo (el de arranque). El primer food cost real confiable sale entre este conteo y el próximo.'
      : 'Hay periodos con food cost real confiable (entre dos conteos).'

  return NextResponse.json({ counts, periods: periods.reverse(), lastCount: counts[counts.length - 1] ?? null, status })
}
