import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { createServerClient } from '@/lib/supabase'
import { normAlias } from '@/lib/ticketExtract'
import { todayMX, shiftDays } from '@/lib/posterImport'

export const runtime = 'nodejs'

const CATEGORIES = ['insumo', 'nomina', 'gasto_fijo', 'reinversion', 'renta_condonada']
const ORIGINS = ['clip', 'caja_chica', 'caja_pos']
const NO_KIND = ['reinversion', 'renta_condonada']

type InItem = {
  codigo?: string | null; descripcion?: string; descripcion_raw?: string | null; cantidad?: number | null
  unidad?: string | null; precio_unitario?: number | null; importe?: number; es_descuento?: boolean
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

  // 4) APRENDE: alias de proveedor + de productos donde tu texto difiere del que leyó la IA.
  const supAliases: Array<{ raw_norm: string; proveedor: string }> = []
  if (b.proveedor_raw && normAlias(b.proveedor_raw) !== normAlias(proveedor)) {
    supAliases.push({ raw_norm: normAlias(b.proveedor_raw), proveedor })
  }
  const prodAliases = new Map<string, { raw_norm: string; descripcion: string; categoria: string | null; unidad: string | null }>()
  for (const i of items) {
    const desc = (i.descripcion ?? '').trim()
    if (i.es_descuento || !i.descripcion_raw || !desc) continue
    if (normAlias(i.descripcion_raw) === normAlias(desc)) continue     // no cambiaste nada → no hay alias que aprender
    prodAliases.set(normAlias(i.descripcion_raw), { raw_norm: normAlias(i.descripcion_raw), descripcion: desc, categoria: b.category ?? null, unidad: i.unidad ?? null })
  }
  const now = new Date().toISOString()
  if (supAliases.length) await supabase.from('ticket_supplier_aliases').upsert(supAliases.map((a) => ({ ...a, updated_at: now })), { onConflict: 'raw_norm' })
  if (prodAliases.size) await supabase.from('ticket_product_aliases').upsert([...prodAliases.values()].map((a) => ({ ...a, updated_at: now })), { onConflict: 'raw_norm' })

  return NextResponse.json({ ok: true, scanId, costoIds: (costos ?? []).map((c) => c.id), learned: { proveedores: supAliases.length, productos: prodAliases.size } })
}
