import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { createServerClient } from '@/lib/supabase'

export const runtime = 'nodejs'

// GET /api/publico/proveedores/ficha?id=<uuid> — la FICHA de un proveedor: sus datos + el HISTORIAL DE COMPRAS
// derivado de publico_costos (cuándo · cuánto · qué tan seguido). Cadencia = promedio de días entre compras.
// "A cómo" fino (precio/unidad) vive a nivel línea/producto; aquí es el nivel compra (monto por movimiento).
const monthMX = () => new Date().toLocaleDateString('en-CA', { timeZone: 'America/Mexico_City' }).slice(0, 7)
const daysBetween = (a: string, b: string) => Math.round((new Date(b + 'T12:00:00').getTime() - new Date(a + 'T12:00:00').getTime()) / 86400000)

export async function GET(req: NextRequest) {
  const id = req.nextUrl.searchParams.get('id')
  if (!id) return NextResponse.json({ error: 'id requerido' }, { status: 400 })
  const supabase = createServerClient()

  const { data: proveedor, error } = await supabase.from('publico_proveedores').select('id, nombre, tipo, categoria, poster_supplier_id, telefono, contacto, notas, sort_order, activo').eq('id', id).maybeSingle()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  if (!proveedor) return NextResponse.json({ error: 'proveedor no encontrado' }, { status: 404 })

  const { data: rows } = await supabase.from('publico_costos').select('date, amount, category, note, ticket_scan_id').eq('scope', 'publico').ilike('proveedor', proveedor.nombre)
  const compras = (rows ?? []).map((r) => ({ date: r.date as string, amount: Number(r.amount), category: r.category as string, note: r.note as string | null, ticketScanId: (r.ticket_scan_id as string | null) ?? null }))
    .sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0))

  const total = Math.round(compras.reduce((s, c) => s + c.amount, 0) * 100) / 100
  const mes = monthMX()
  const mesActual = Math.round(compras.filter((c) => c.date.slice(0, 7) === mes).reduce((s, c) => s + c.amount, 0) * 100) / 100
  const ultimaFecha = compras[0]?.date ?? null
  // Cadencia: promedio de días entre FECHAS distintas de compra (dos compras el mismo día no cuentan como ciclo).
  const fechas = [...new Set(compras.map((c) => c.date))].sort()
  let cadenciaDias: number | null = null
  if (fechas.length >= 2) {
    let sum = 0
    for (let i = 1; i < fechas.length; i++) sum += daysBetween(fechas[i - 1], fechas[i])
    cadenciaDias = Math.round(sum / (fechas.length - 1))
  }

  return NextResponse.json({ proveedor, compras, stats: { total, count: compras.length, mesActual, ultimaFecha, cadenciaDias } })
}
