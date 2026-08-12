import { NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase'

export const runtime = 'nodejs'

// GET /api/publico/empaque — empaque como % de VENTAS por mes. Es el único costo no-comida que escala con el
// volumen (cajas, vasos, servilletas: se van CON la venta), así que se mira como ratio de ventas, SEPARADO
// del food cost (que es consumo de receta). NO se suma al food cost. Punto 5 del bloque B.
export async function GET() {
  const supabase = createServerClient()
  const [{ data: ventas }, { data: costos }] = await Promise.all([
    supabase.from('publico_ventas').select('month, efectivo, tarjeta').eq('scope', 'publico'),
    supabase.from('publico_costos').select('month, amount').eq('scope', 'publico').eq('category', 'empaque'),
  ])
  const sales: Record<string, number> = {}
  for (const v of ventas ?? []) sales[v.month] = (sales[v.month] ?? 0) + Number(v.efectivo) + Number(v.tarjeta)
  const emp: Record<string, number> = {}
  for (const c of costos ?? []) emp[c.month] = (emp[c.month] ?? 0) + Number(c.amount)

  const months = [...new Set([...Object.keys(sales), ...Object.keys(emp)])].sort()
  const byMonth = months.map((month) => {
    const s = sales[month] ?? 0, e = emp[month] ?? 0
    return { month, sales: s, empaque: e, pct: s > 0 ? (e / s) * 100 : null }
  })
  return NextResponse.json({ byMonth })
}
