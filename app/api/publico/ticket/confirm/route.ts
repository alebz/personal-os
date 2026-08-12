import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { createServerClient } from '@/lib/supabase'
import { normAlias, stemAlias } from '@/lib/ticketExtract'
import { todayMX, shiftDays } from '@/lib/posterImport'
import { COST_CATEGORIES } from '@/lib/publico'

export const runtime = 'nodejs'

const CATEGORIES: string[] = COST_CATEGORIES.map((c) => c.key)   // fuente única (incluye mantenimiento/empaque/suministros)
const ORIGINS = ['clip', 'caja_chica', 'caja_pos']
const NO_KIND: string[] = COST_CATEGORIES.filter((c) => c.defaultKind === null).map((c) => c.key)   // reinversión + renta_condonada

type InItem = {
  codigo?: string | null; descripcion?: string; descripcion_raw?: string | null; cantidad?: number | null
  unidad?: string | null; precio_unitario?: number | null; importe?: number; es_descuento?: boolean; ivaTasa?: number | null
}
type Body = {
  raw?: unknown; model?: string
  proveedor?: string; proveedor_raw?: string | null; fecha?: string
  subtotal?: number | null; descuento?: number | null; impuestos?: number | null; total?: number
  legibilidad?: string | null; notas?: string | null
  category?: string; cost_kind?: string | null; origin?: string | null
  origins?: Array<{ origin?: string | null; amount?: number }>   // PAGO MIXTO: split del total entre contenedores
  items?: InItem[]
  imageBase64?: string; mediaType?: string
  fecha_approved?: boolean
}

// Ventana razonable para la fecha del ticket: ni futuro ni más de 60 días atrás. Una fecha mal leída
// ensucia el food cost de dos meses sin hacer ruido, así que fuera de rango exige aprobación explícita.
const DATE_WINDOW_DAYS = 60

// POST /api/publico/ticket/confirm — ÚNICA escritura del gasto. Crea el scan (confirmado, con el JSON crudo
// para auditoría), las líneas itemizadas, la fila ROLL-UP en publico_costos (P&L intacto), y APRENDE los
// alias que corregiste. Nada de esto ocurre hasta que el humano confirma.
export async function POST(req: NextRequest) {
  let b: Body
  try { b = await req.json() } catch { return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }) }

  const proveedor = (b.proveedor ?? '').trim()
  if (!proveedor) return NextResponse.json({ error: 'proveedor requerido' }, { status: 400 })
  if (!b.fecha || !/^\d{4}-\d{2}-\d{2}$/.test(b.fecha)) return NextResponse.json({ error: 'fecha (YYYY-MM-DD) requerida' }, { status: 400 })
  // Guardián de fecha: fuera de ventana (futuro o >60 días atrás) NO se guarda sin aprobación explícita.
  const today = todayMX()
  const floor = shiftDays(today, -DATE_WINDOW_DAYS)
  if ((b.fecha > today || b.fecha < floor) && !b.fecha_approved) {
    return NextResponse.json({ error: `La fecha ${b.fecha} está fuera de rango (futuro o más de ${DATE_WINDOW_DAYS} días atrás). Corrígela o apruébala explícitamente.`, code: 'fecha_rango' }, { status: 400 })
  }
  const total = Number(b.total)
  if (!Number.isFinite(total) || total <= 0) return NextResponse.json({ error: 'total inválido (>0)' }, { status: 400 })
  if (!b.category || !CATEGORIES.includes(b.category)) return NextResponse.json({ error: 'category inválida' }, { status: 400 })
  if (b.origin != null && !ORIGINS.includes(b.origin)) return NextResponse.json({ error: 'origin inválido' }, { status: 400 })
  const cost_kind = NO_KIND.includes(b.category) ? null : (b.cost_kind === 'variable' ? 'variable' : 'fijo')

  // PAGO MIXTO: si vienen splits (gasto pagado desde 2+ contenedores), deben ser válidos y sumar EXACTO al
  // total. Se escribe UNA fila de roll-up por contenedor, todas ligadas al mismo ticket_scan_id → cada caja
  // queda correcta y el P&L (que suma amount) no cambia. Sin splits, una sola fila con `origin`, como antes.
  let splits: Array<{ origin: string | null; amount: number }> | null = null
  if (Array.isArray(b.origins) && b.origins.length) {
    const parsed = b.origins.map((s) => ({ origin: s.origin ?? null, amount: Number(s.amount) })).filter((s) => Number.isFinite(s.amount) && s.amount > 0)
    if (!parsed.length) return NextResponse.json({ error: 'splits vacíos' }, { status: 400 })
    for (const s of parsed) if (s.origin != null && !ORIGINS.includes(s.origin)) return NextResponse.json({ error: `origin inválido en split: ${s.origin}` }, { status: 400 })
    const sum = parsed.reduce((a, s) => a + s.amount, 0)
    if (Math.abs(sum - total) > 0.01) return NextResponse.json({ error: `los contenedores suman ${sum.toFixed(2)} y el total es ${total.toFixed(2)} — deben cuadrar`, code: 'split_mismatch' }, { status: 400 })
    splits = parsed
  }
  const items = (b.items ?? []).filter((i) => i && i.descripcion != null)

  const supabase = createServerClient()

  // Imagen (evidencia): sube a storage si viene; bucket se crea perezosamente. Falla suave — no bloquea el gasto.
  let image_path: string | null = null
  if (b.imageBase64) {
    try {
      await supabase.storage.createBucket('ticket-scans', { public: false }).catch(() => {})
      const ext = (b.mediaType ?? 'image/jpeg').split('/')[1]?.replace('jpeg', 'jpg') ?? 'jpg'
      const path = `${b.fecha}/${Date.now()}.${ext}`
      const bytes = Buffer.from(b.imageBase64, 'base64')
      const up = await supabase.storage.from('ticket-scans').upload(path, bytes, { contentType: b.mediaType ?? 'image/jpeg', upsert: false })
      if (!up.error) image_path = path
    } catch { /* evidencia es best-effort */ }
  }

  // 1) Cabecera del scan (confirmado).
  const { data: scan, error: scanErr } = await supabase.from('ticket_scans').insert({
    scope: 'publico', status: 'confirmed', image_path, model: b.model ?? null, raw: b.raw ?? null,
    proveedor, proveedor_raw: b.proveedor_raw ?? null, fecha: b.fecha,
    subtotal: b.subtotal ?? null, descuento: b.descuento ?? null, impuestos: b.impuestos ?? null, total,
    legibilidad: b.legibilidad ?? null, notas: b.notas ?? null, confirmed_at: new Date().toISOString(),
  }).select('id').single()
  if (scanErr) return NextResponse.json({ error: scanErr.message }, { status: 500 })
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
    if (itErr) return NextResponse.json({ error: itErr.message }, { status: 500 })
  }

  // 3) Roll-up en publico_costos: una fila por contenedor si hay pago mixto, si no una sola (el P&L suma amount).
  const base = { scope: 'publico', date: b.fecha, month: b.fecha.slice(0, 7), category: b.category, cost_kind, note: proveedor, ticket_scan_id: scanId }
  const costoRows = splits
    ? splits.map((s) => ({ ...base, origin: s.origin, amount: s.amount }))
    : [{ ...base, origin: b.origin ?? null, amount: total }]
  const { data: costos, error: costErr } = await supabase.from('publico_costos').insert(costoRows).select('id')
  if (costErr) return NextResponse.json({ error: costErr.message }, { status: 500 })

  // 4) CATÁLOGO: registra CADA línea como alias (raw_norm → descripción), aunque no la corrijas, para poder
  // mapearla a Poster. Colapsa por raw_norm (3 líneas idénticas de mozzarella = 1 fila) sumando el importe;
  // `veces` cuenta TICKETS distintos (esa ida a Costco es 1 compra, no 3), para saber qué tan seguido lo
  // compras — el volumen ya lo lleva importe_acumulado. NO pisa lo ya aprendido: el nombre canónico, la
  // categoría, la unidad y el mapeo a Poster solo se escriben si esta vez los corregiste o si la fila es nueva.
  const now = new Date().toISOString()

  // Proveedor: también se registra siempre (mismo hueco: sin fila no se puede mapear el proveedor a Poster).
  const provRaw = b.proveedor_raw ? normAlias(b.proveedor_raw) : normAlias(proveedor)
  if (provRaw) {
    const { data: existSup } = await supabase.from('ticket_supplier_aliases').select('proveedor').eq('raw_norm', provRaw).maybeSingle()
    const renamedSup = !!b.proveedor_raw && normAlias(b.proveedor_raw) !== normAlias(proveedor)
    await supabase.from('ticket_supplier_aliases').upsert(
      { raw_norm: provRaw, proveedor: renamedSup || !existSup ? proveedor : existSup.proveedor, deleted_at: null, updated_at: now },
      { onConflict: 'raw_norm' },
    )
  }

  // Productos: agrupa las líneas de ESTE ticket por raw_norm.
  type Group = { raw_norm: string; stem: string; canonical: string; renamed: boolean; categoria: string | null; unidad: string | null; sum: number; qty: number; iva: number | null }
  const groups = new Map<string, Group>()
  for (const i of items) {
    if (i.es_descuento) continue
    const canonical = (i.descripcion ?? '').trim()
    const rawText = (i.descripcion_raw ?? i.descripcion ?? '').trim()
    const key = normAlias(rawText)
    if (!key || !canonical) continue
    const g = groups.get(key) ?? { raw_norm: key, stem: stemAlias(rawText), canonical, renamed: normAlias(rawText) !== normAlias(canonical), categoria: b.category ?? null, unidad: i.unidad ?? null, sum: 0, qty: 0, iva: i.ivaTasa ?? null }
    g.sum += Number(i.importe ?? 0)
    g.qty += Number(i.cantidad ?? 0)
    if (g.iva == null && i.ivaTasa != null) g.iva = i.ivaTasa
    groups.set(key, g)
  }

  let productos = 0
  if (groups.size) {
    const keys = [...groups.keys()]
    const { data: existing } = await supabase.from('ticket_product_aliases')
      .select('raw_norm, descripcion, categoria, unidad, importe_acumulado, veces, cantidad_acumulada, iva_tasa').in('raw_norm', keys)
    const prev = new Map((existing ?? []).map((r) => [r.raw_norm, r]))
    const rows = [...groups.values()].map((g) => {
      const e = prev.get(g.raw_norm)
      return {
        raw_norm: g.raw_norm,
        raw_stem: g.stem,   // el stem (sin número) se guarda siempre; habilita consolidar si luego marcas peso_variable
        deleted_at: null,   // re-comprar un producto resucita su fila si estaba soft-borrada
        // nombre/categoría/unidad: si ya existían, se conservan salvo que ESTA vez los hayas corregido.
        descripcion: g.renamed || !e ? g.canonical : e.descripcion,
        categoria: e?.categoria ?? g.categoria,
        unidad: e?.unidad ?? g.unidad,
        // IVA de la línea: lo hereda el alias si aún no lo tenía (no pisa el que ya definiste).
        iva_tasa: e?.iva_tasa ?? g.iva,
        // acumulados: siempre suman (no pisan). El mapeo a Poster no va en el payload → queda intacto.
        importe_acumulado: Number(e?.importe_acumulado ?? 0) + g.sum,
        cantidad_acumulada: Number(e?.cantidad_acumulada ?? 0) + g.qty,   // para precio/unidad = importe_acum / cant_acum
        veces: Number(e?.veces ?? 0) + 1,   // +1 por TICKET (ya colapsado por raw_norm), no por línea
        updated_at: now,
      }
    })
    const { error: aliasErr } = await supabase.from('ticket_product_aliases').upsert(rows, { onConflict: 'raw_norm' })
    if (aliasErr) return NextResponse.json({ error: aliasErr.message }, { status: 500 })
    productos = rows.length
  }

  return NextResponse.json({ ok: true, scanId, costoIds: (costos ?? []).map((c) => c.id), learned: { productos } })
}
