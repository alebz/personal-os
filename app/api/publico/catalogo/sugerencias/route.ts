import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { createServerClient } from '@/lib/supabase'
import { sugerirPares, costoPorBase, type FilaCatalogo, type FilaAlias } from '@/lib/publico/emparejar'

export const runtime = 'nodejs'

// GET /api/publico/catalogo/sugerencias — qué producto del inventario le corresponde a qué compra. El costo solo
// llega por esa liga, así que sin ella un producto se queda sin precio aunque la factura ya lo traiga.
export async function GET() {
  const supabase = createServerClient()
  const [cat, al] = await Promise.all([
    supabase.from('publico_catalogo').select('id, nombre, unidad_base, costo, cuenta_stock, alias_raw_norm, poster_ingredient_id, activo'),
    supabase.from('ticket_product_aliases').select('raw_norm, descripcion, unidad, factor_a_base, importe_acumulado, cantidad_acumulada, veces, toca_stock').is('deleted_at', null),
  ])
  const catalogo = (cat.data ?? []) as FilaCatalogo[]
  const aliases = (al.data ?? []) as FilaAlias[]
  const sugerencias = sugerirPares(catalogo, aliases)

  const sinCosto = catalogo.filter((c) => c.activo && c.cuenta_stock && !c.alias_raw_norm).length
  const comprasLibres = aliases.filter((a) => a.toca_stock && Number(a.importe_acumulado) > 0 && !catalogo.some((c) => c.alias_raw_norm === a.raw_norm)).length
  return NextResponse.json({
    sugerencias,
    resumen: {
      sinCosto,                                   // productos que cuentas y no tienen precio
      comprasLibres,                              // compras con precio que no alimentan a nadie
      proponibles: sugerencias.length,
      alta: sugerencias.filter((s) => s.confianza === 'alta').length,
      revisar: sugerencias.filter((s) => s.confianza === 'revisar').length,
      sinFactor: sugerencias.filter((s) => s.factor == null && s.unidadBase != null).length,
    },
  })
}

// POST — confirmar un emparejamiento. El producto HEREDA el costo real y queda ligado a la compra, así que las
// próximas facturas de ese proveedor lo actualizan solas. El factor viaja al alias: es de la COMPRA (una botella
// trae 250 ml), no del producto, y es lo que evita que el aceite quede en $185/l cuando vale $740/l.
export async function POST(req: NextRequest) {
  let b: { catalogoId?: string; rawNorm?: string; factor?: number | null }
  try { b = await req.json() } catch { return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }) }
  if (!b.catalogoId || !b.rawNorm) return NextResponse.json({ error: 'catalogoId y rawNorm requeridos' }, { status: 400 })
  const factor = b.factor != null && Number.isFinite(Number(b.factor)) && Number(b.factor) > 0 ? Number(b.factor) : null

  const supabase = createServerClient()
  const [{ data: dest }, { data: alias }] = await Promise.all([
    supabase.from('publico_catalogo').select('id, poster_ingredient_id, alias_raw_norm').eq('id', b.catalogoId).maybeSingle(),
    supabase.from('ticket_product_aliases').select('raw_norm, importe_acumulado, cantidad_acumulada').eq('raw_norm', b.rawNorm).maybeSingle(),
  ])
  if (!dest) return NextResponse.json({ error: 'producto no encontrado' }, { status: 404 })
  if (!alias) return NextResponse.json({ error: 'compra no encontrada' }, { status: 404 })
  if (dest.alias_raw_norm) return NextResponse.json({ error: 'ese producto ya está ligado a una compra' }, { status: 409 })

  // alias_raw_norm tiene índice único: si otra fila del catálogo ya reclamaba esta compra, se libera y se archiva
  // (es la fila-compra duplicada, misma conducta que /catalogo/ligar).
  const { data: ocupa } = await supabase.from('publico_catalogo').select('id').eq('alias_raw_norm', b.rawNorm).maybeSingle()
  if (ocupa && ocupa.id !== dest.id) {
    const { error } = await supabase.from('publico_catalogo').update({ alias_raw_norm: null, activo: false, updated_at: new Date().toISOString() }).eq('id', ocupa.id)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  }

  const costo = costoPorBase(Number(alias.importe_acumulado), Number(alias.cantidad_acumulada), factor)
  const { error: e1 } = await supabase.from('publico_catalogo')
    .update({ costo, alias_raw_norm: b.rawNorm, updated_at: new Date().toISOString() }).eq('id', dest.id)
  if (e1) return NextResponse.json({ error: e1.message }, { status: 500 })

  // El factor y la liga a Poster viven en el alias → sobreviven al re-sync del catálogo.
  const upd: Record<string, unknown> = { updated_at: new Date().toISOString() }
  if (factor != null) upd.factor_a_base = factor
  if (dest.poster_ingredient_id != null) upd.poster_ingredient_id = dest.poster_ingredient_id
  await supabase.from('ticket_product_aliases').update(upd).eq('raw_norm', b.rawNorm)

  return NextResponse.json({ ok: true, costo })
}
