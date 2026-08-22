import type { createServerClient } from '@/lib/supabase'
import { normAlias, stemAlias } from '@/lib/ticketExtract'

// PIPELINE de captura de un gasto (compartido). Escribe: scan (cabecera) + líneas itemizadas + roll-up en
// publico_costos (P&L) + aprende los alias (proveedor + productos, acumulando importe/cantidad/veces). ÚNICA
// fuente de esta lógica — la usa /ticket/confirm (foto/a mano) y /facturas/capturar (CFDI del correo). Lanza
// Error en fallo de DB (el caller responde 500). NO valida (eso es del caller: fecha, splits, category, etc.).

type Supa = ReturnType<typeof createServerClient>
export type CapturaItem = { codigo?: string | null; descripcion?: string; descripcion_raw?: string | null; cantidad?: number | null; unidad?: string | null; precio_unitario?: number | null; importe?: number; es_descuento?: boolean; ivaTasa?: number | null }
export type CapturaInput = {
  proveedor: string; proveedor_raw?: string | null; fecha: string
  subtotal?: number | null; descuento?: number | null; impuestos?: number | null; total: number
  legibilidad?: string | null; notas?: string | null
  category: string; cost_kind: string | null; origin?: string | null
  splits?: Array<{ origin: string | null; amount: number }> | null; folio?: string | null
  items: CapturaItem[]; image_path?: string | null; model?: string | null; raw?: unknown; origen: string
  // LIGAR (conciliación): id de un publico_costos que YA representa este gasto. En vez de crear un costo nuevo
  // (que lo duplicaría), el scan se cuelga de ese movimiento y le afina proveedor/folio/monto. Ver conciliar.ts.
  ligarA?: string | null
}

export async function capturarTicket(supabase: Supa, input: CapturaInput): Promise<{ scanId: string; costoIds: string[]; productos: number; ligado?: { costoId: string; montoAntes: number; montoDespues: number } }> {
  const { proveedor, fecha, total, category, cost_kind } = input
  const items = (input.items ?? []).filter((i) => i && i.descripcion != null)
  const now = new Date().toISOString()

  // 1) Cabecera del scan (confirmado).
  const { data: scan, error: scanErr } = await supabase.from('ticket_scans').insert({
    scope: 'publico', status: 'confirmed', image_path: input.image_path ?? null, model: input.model ?? null, raw: input.raw ?? null, origen: input.origen,
    proveedor, proveedor_raw: input.proveedor_raw ?? null, fecha,
    subtotal: input.subtotal ?? null, descuento: input.descuento ?? null, impuestos: input.impuestos ?? null, total,
    legibilidad: input.legibilidad ?? null, notas: input.notas ?? null, confirmed_at: now,
  }).select('id').single()
  if (scanErr) throw new Error(scanErr.message)
  const scanId = scan.id as string

  // 2) Líneas itemizadas.
  if (items.length) {
    const rows = items.map((i, pos) => ({
      scan_id: scanId, pos, codigo: i.codigo ?? null,
      descripcion: (i.descripcion ?? '').trim(), descripcion_raw: i.descripcion_raw ?? null,
      cantidad: i.cantidad ?? null, unidad: i.unidad ?? null, precio_unitario: i.precio_unitario ?? null,
      importe: Number(i.importe ?? 0), es_descuento: !!i.es_descuento,
    }))
    const { error: itErr } = await supabase.from('ticket_items').insert(rows)
    if (itErr) throw new Error(itErr.message)
  }

  // 3) El DINERO. Dos caminos:
  const folio = (input.folio ?? '').trim() || null
  let costoIds: string[] = []
  let ligado: { costoId: string; montoAntes: number; montoDespues: number } | undefined

  if (input.ligarA) {
    // 3a) LIGAR: el gasto YA está en los libros. Se le cuelga este scan y se afina su IDENTIDAD (proveedor,
    // folio, monto del documento fiscal). NO se re-clasifica: category/cost_kind son de los libros y ahí se
    // quedan. La única excepción es el contenedor VACÍO — llenarlo es ganancia pura (mata un cabo suelto).
    const { data: prev, error: prevErr } = await supabase.from('publico_costos').select('id, amount, origin').eq('id', input.ligarA).maybeSingle()
    if (prevErr) throw new Error(prevErr.message)
    if (!prev) throw new Error('el movimiento a ligar ya no existe')
    const patch: Record<string, unknown> = { ticket_scan_id: scanId, proveedor, note: proveedor, folio, amount: total }
    if (prev.origin == null && input.origin) patch.origin = input.origin
    const { error: linkErr } = await supabase.from('publico_costos').update(patch).eq('id', input.ligarA)
    if (linkErr) throw new Error(linkErr.message)
    costoIds = [input.ligarA]
    ligado = { costoId: input.ligarA, montoAntes: Number(prev.amount), montoDespues: total }
  } else {
    // 3b) Roll-up nuevo: una fila por contenedor si hay pago mixto, si no una sola (el P&L suma amount).
    const base = { scope: 'publico', date: fecha, month: fecha.slice(0, 7), category, cost_kind, note: proveedor, proveedor, folio, ticket_scan_id: scanId, origen: input.origen }
    const costoRows = input.splits && input.splits.length
      ? input.splits.map((s) => ({ ...base, origin: s.origin, amount: s.amount }))
      : [{ ...base, origin: input.origin ?? null, amount: total }]
    const { data: costos, error: costErr } = await supabase.from('publico_costos').insert(costoRows).select('id')
    if (costErr) throw new Error(costErr.message)
    costoIds = (costos ?? []).map((c) => c.id as string)
  }

  // 4a) Alias de PROVEEDOR (para mapear a Poster). No pisa el nombre canónico ya aprendido salvo que renombres.
  const provRaw = input.proveedor_raw ? normAlias(input.proveedor_raw) : normAlias(proveedor)
  if (provRaw) {
    const { data: existSup } = await supabase.from('ticket_supplier_aliases').select('proveedor').eq('raw_norm', provRaw).maybeSingle()
    const renamedSup = !!input.proveedor_raw && normAlias(input.proveedor_raw) !== normAlias(proveedor)
    await supabase.from('ticket_supplier_aliases').upsert({ raw_norm: provRaw, proveedor: renamedSup || !existSup ? proveedor : existSup.proveedor, deleted_at: null, updated_at: now }, { onConflict: 'raw_norm' })
  }

  // 4b) Alias de PRODUCTOS: agrupa las líneas por raw_norm, acumula importe/cantidad, +1 vez por ticket.
  type Group = { raw_norm: string; stem: string; canonical: string; renamed: boolean; categoria: string | null; unidad: string | null; sum: number; qty: number; iva: number | null }
  const groups = new Map<string, Group>()
  for (const i of items) {
    if (i.es_descuento) continue
    const canonical = (i.descripcion ?? '').trim()
    const rawText = (i.descripcion_raw ?? i.descripcion ?? '').trim()
    const key = normAlias(rawText)
    if (!key || !canonical) continue
    const g = groups.get(key) ?? { raw_norm: key, stem: stemAlias(rawText), canonical, renamed: normAlias(rawText) !== normAlias(canonical), categoria: category ?? null, unidad: i.unidad ?? null, sum: 0, qty: 0, iva: i.ivaTasa ?? null }
    g.sum += Number(i.importe ?? 0)
    g.qty += Number(i.cantidad ?? 0)
    if (g.iva == null && i.ivaTasa != null) g.iva = i.ivaTasa
    groups.set(key, g)
  }
  let productos = 0
  if (groups.size) {
    const keys = [...groups.keys()]
    const { data: existing } = await supabase.from('ticket_product_aliases').select('raw_norm, descripcion, categoria, unidad, importe_acumulado, veces, cantidad_acumulada, iva_tasa').in('raw_norm', keys)
    const prev = new Map((existing ?? []).map((r) => [r.raw_norm, r]))
    const rows = [...groups.values()].map((g) => {
      const e = prev.get(g.raw_norm)
      return {
        raw_norm: g.raw_norm, raw_stem: g.stem, deleted_at: null,
        descripcion: g.renamed || !e ? g.canonical : e.descripcion,
        categoria: e?.categoria ?? g.categoria, unidad: e?.unidad ?? g.unidad, iva_tasa: e?.iva_tasa ?? g.iva,
        importe_acumulado: Number(e?.importe_acumulado ?? 0) + g.sum,
        cantidad_acumulada: Number(e?.cantidad_acumulada ?? 0) + g.qty,
        veces: Number(e?.veces ?? 0) + 1, updated_at: now,
      }
    })
    const { error: aliasErr } = await supabase.from('ticket_product_aliases').upsert(rows, { onConflict: 'raw_norm' })
    if (aliasErr) throw new Error(aliasErr.message)
    productos = rows.length
  }

  return { scanId, costoIds, productos, ligado }
}
