import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { createServerClient } from '@/lib/supabase'
import { sugerirPares, costoPorBase, factorConFuente, type FilaCatalogo, type FilaAlias } from '@/lib/publico/emparejar'

export const runtime = 'nodejs'

// GET /api/publico/catalogo/sugerencias — qué producto del inventario le corresponde a qué compra. El costo solo
// llega por esa liga, así que sin ella un producto se queda sin precio aunque la factura ya lo traiga.
export async function GET() {
  const supabase = createServerClient()
  const [cat, al, desc] = await Promise.all([
    supabase.from('publico_catalogo').select('id, nombre, unidad_base, costo, cuenta_stock, alias_raw_norm, poster_ingredient_id, activo'),
    supabase.from('ticket_product_aliases').select('raw_norm, descripcion, unidad, factor_a_base, importe_acumulado, cantidad_acumulada, veces, toca_stock').is('deleted_at', null),
    supabase.from('publico_catalogo_descartes').select('catalogo_id, raw_norm'),
  ])
  const catalogo = (cat.data ?? []) as FilaCatalogo[]
  const aliases = (al.data ?? []) as FilaAlias[]
  // Un "no son lo mismo" ya dado no se vuelve a proponer. Es una decisión tuya, no un estado de la pantalla.
  const descartados = new Set((desc.data ?? []).map((d) => `${d.catalogo_id}|${d.raw_norm}`))
  const sugerencias = sugerirPares(catalogo, aliases).filter((s) => !descartados.has(`${s.catalogoId}|${s.rawNorm}`))

  // ── AUDITORÍA: costos que YA están puestos pero no se sostienen ─────────────────────────────────────────
  // El factor se guarda una vez y de ahí en adelante nadie lo vuelve a mirar, así que un valor puesto a la
  // ligera se vuelve permanente e invisible. Dos revisiones, ambas mecánicas:
  //   · CONTRADICE — el documento declara un rendimiento distinto al guardado ("Tomate Racimo 907g" con
  //     factor 1). Aquí no hay duda: el nombre del propio proveedor manda.
  //   · SOSPECHOSO — compras un envase, cuentas por peso o volumen, y el factor es exactamente 1. Casi nunca
  //     un clamshell pesa un kilo exacto; ese 1 suele ser un "no sé" que quedó como dato bueno.
  const porRaw = new Map(aliases.map((a) => [a.raw_norm, a]))
  const auditoria = []
  for (const c of catalogo) {
    if (!c.activo || !c.cuenta_stock || !c.alias_raw_norm) continue
    const a = porRaw.get(c.alias_raw_norm)
    if (!a || !(Number(a.importe_acumulado) > 0 && Number(a.cantidad_acumulada) > 0)) continue
    const guardado = a.factor_a_base == null ? null : Number(a.factor_a_base)
    // Solo se acusa de contradicción cuando el documento DECLARA el rendimiento (un paquete o una medida en el
    // nombre). Si el factor solo se infiere de que las unidades se llaman igual, es una suposición y no tiene
    // autoridad para desmentir lo que ya está guardado.
    const { factor: declarado, fuente } = factorConFuente(a.descripcion, c.unidad_base, a.unidad)
    const declaraElDocumento = fuente === 'pack' || fuente === 'medida'
    const costoCon = (f: number | null) => costoPorBase(Number(a.importe_acumulado), Number(a.cantidad_acumulada), f)
    if (guardado != null && declarado != null && declaraElDocumento && Math.abs(guardado - declarado) / Math.max(guardado, declarado) > 0.02) {
      auditoria.push({ tipo: 'contradice', catalogoId: c.id, nombre: c.nombre, unidadBase: c.unidad_base,
        rawNorm: a.raw_norm, descripcion: a.descripcion, unidadCompra: a.unidad,
        guardado, declarado, costoActual: costoCon(guardado), costoCorregido: costoCon(declarado) })
    } else if (guardado != null && (guardado > 100 || (costoCon(guardado) ?? 1) < 1)) {
      // IMPLAUSIBLE: una unidad de compra que rinde más de 100 kg/l, o un costo por debajo de $1. Casi siempre
      // es un punto decimal perdido — "907" donde iba "0.907" deja el tomate en 16 centavos el kilo.
      auditoria.push({ tipo: 'implausible', catalogoId: c.id, nombre: c.nombre, unidadBase: c.unidad_base,
        rawNorm: a.raw_norm, descripcion: a.descripcion, unidadCompra: a.unidad,
        guardado, declarado: guardado > 100 ? guardado / 1000 : null,
        costoActual: costoCon(guardado), costoCorregido: guardado > 100 ? costoCon(guardado / 1000) : null })
    } else if (guardado === 1 && declarado == null && ['kg', 'l'].includes((c.unidad_base ?? '').toLowerCase())) {
      auditoria.push({ tipo: 'sospechoso', catalogoId: c.id, nombre: c.nombre, unidadBase: c.unidad_base,
        rawNorm: a.raw_norm, descripcion: a.descripcion, unidadCompra: a.unidad,
        guardado, declarado: null, costoActual: costoCon(1), costoCorregido: null })
    }
  }

  const sinCosto = catalogo.filter((c) => c.activo && c.cuenta_stock && !c.alias_raw_norm).length
  const comprasLibres = aliases.filter((a) => a.toca_stock && Number(a.importe_acumulado) > 0 && !catalogo.some((c) => c.alias_raw_norm === a.raw_norm)).length
  return NextResponse.json({
    sugerencias, auditoria,
    resumen: {
      sinCosto,                                   // productos que cuentas y no tienen precio
      comprasLibres,                              // compras con precio que no alimentan a nadie
      proponibles: sugerencias.length,
      alta: sugerencias.filter((s) => s.confianza === 'alta').length,
      revisar: sugerencias.filter((s) => s.confianza === 'revisar').length,
      sinFactor: sugerencias.filter((s) => s.factor == null && s.unidadBase != null).length,
      contradicen: auditoria.filter((a) => a.tipo === 'contradice').length,
      implausibles: auditoria.filter((a) => a.tipo === 'implausible').length,
      sospechosos: auditoria.filter((a) => a.tipo === 'sospechoso').length,
    },
  })
}

// DELETE — "no son lo mismo". Se guarda para no volver a proponer ese par nunca.
export async function DELETE(req: NextRequest) {
  let b: { catalogoId?: string; rawNorm?: string }
  try { b = await req.json() } catch { return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }) }
  if (!b.catalogoId || !b.rawNorm) return NextResponse.json({ error: 'catalogoId y rawNorm requeridos' }, { status: 400 })
  const supabase = createServerClient()
  const { error } = await supabase.from('publico_catalogo_descartes').upsert({ catalogo_id: b.catalogoId, raw_norm: b.rawNorm }, { onConflict: 'catalogo_id,raw_norm' })
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}

// PATCH — corregir el rendimiento de un producto YA ligado. Es el par del bloque de auditoría: el factor se
// guarda una vez y después nadie lo vuelve a mirar, así que tiene que poder corregirse sin desligar y rehacer.
export async function PATCH(req: NextRequest) {
  let b: { catalogoId?: string; rawNorm?: string; factor?: number | null }
  try { b = await req.json() } catch { return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }) }
  if (!b.catalogoId || !b.rawNorm) return NextResponse.json({ error: 'catalogoId y rawNorm requeridos' }, { status: 400 })
  const factor = b.factor != null && Number.isFinite(Number(b.factor)) && Number(b.factor) > 0 ? Number(b.factor) : null
  if (factor == null) return NextResponse.json({ error: 'factor debe ser un número mayor que cero' }, { status: 400 })

  const supabase = createServerClient()
  const { data: alias } = await supabase.from('ticket_product_aliases').select('importe_acumulado, cantidad_acumulada').eq('raw_norm', b.rawNorm).maybeSingle()
  if (!alias) return NextResponse.json({ error: 'compra no encontrada' }, { status: 404 })
  const costo = costoPorBase(Number(alias.importe_acumulado), Number(alias.cantidad_acumulada), factor)
  const { error } = await supabase.from('publico_catalogo').update({ costo, updated_at: new Date().toISOString() }).eq('id', b.catalogoId)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  await supabase.from('ticket_product_aliases').update({ factor_a_base: factor, updated_at: new Date().toISOString() }).eq('raw_norm', b.rawNorm)
  return NextResponse.json({ ok: true, costo })
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
