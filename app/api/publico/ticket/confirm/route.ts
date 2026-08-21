import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { createServerClient } from '@/lib/supabase'
import { SESSION_COOKIE, getSessionScope } from '@/lib/auth'
import { todayMX, shiftDays } from '@/lib/posterImport'
import { capturarTicket } from '@/lib/publico/capturarTicket'
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
  folio?: string | null   // folio/nº de nota del proveedor (opcional) — se guarda en el roll-up
  origins?: Array<{ origin?: string | null; amount?: number }>   // PAGO MIXTO: split del total entre contenedores
  items?: InItem[]
  imageBase64?: string; mediaType?: string
  storagePath?: string   // la foto ya subida a Storage (vía nueva); al confirmar se mueve de drafts/ a su fecha
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

  // SELLO DE ORIGEN — derivado del token firmado, NUNCA del body. Sin cookie (acceso por x-api-secret) = 'full'.
  const origen = (await getSessionScope(req.cookies.get(SESSION_COOKIE)?.value)) ?? 'full'

  const supabase = createServerClient()

  // Imagen (evidencia). Vía NUEVA: ya está en Storage (drafts/…) → se MUEVE a su carpeta por fecha (una sola
  // copia, sin re-subir). Vía vieja (base64): se sube. Falla suave — no bloquea el gasto.
  let image_path: string | null = null
  try {
    await supabase.storage.createBucket('ticket-scans', { public: false }).catch(() => {})
    if (b.storagePath) {
      const base = b.storagePath.split('/').pop() ?? `${Date.now()}.jpg`
      const dest = `${b.fecha}/${base}`
      const mv = await supabase.storage.from('ticket-scans').move(b.storagePath, dest)
      image_path = mv.error ? b.storagePath : dest   // si el move falla, al menos conserva la ruta del draft
    } else if (b.imageBase64) {
      const ext = (b.mediaType ?? 'image/jpeg').split('/')[1]?.replace('jpeg', 'jpg') ?? 'jpg'
      const path = `${b.fecha}/${Date.now()}.${ext}`
      const up = await supabase.storage.from('ticket-scans').upload(path, Buffer.from(b.imageBase64, 'base64'), { contentType: b.mediaType ?? 'image/jpeg', upsert: false })
      if (!up.error) image_path = path
    }
  } catch { /* evidencia es best-effort */ }

  // Escritura del gasto (scan + líneas + roll-up + aprendizaje de alias) — pipeline compartido con /facturas.
  try {
    const { scanId, costoIds, productos } = await capturarTicket(supabase, {
      proveedor, proveedor_raw: b.proveedor_raw ?? null, fecha: b.fecha,
      subtotal: b.subtotal ?? null, descuento: b.descuento ?? null, impuestos: b.impuestos ?? null, total,
      legibilidad: b.legibilidad ?? null, notas: b.notas ?? null,
      category: b.category, cost_kind, origin: b.origin ?? null, splits, folio: b.folio ?? null,
      items, image_path, model: b.model ?? null, raw: b.raw ?? null, origen,
    })
    return NextResponse.json({ ok: true, scanId, costoIds, learned: { productos } })
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : String(e) }, { status: 500 })
  }
}
