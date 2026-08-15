import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { createServerClient } from '@/lib/supabase'
import { COST_CATEGORIES } from '@/lib/publico'
import { recomputeAliasAccumulators, scanRawNorms, buildCostoRows } from '@/lib/ticketArchive'

export const runtime = 'nodejs'

const CATS: string[] = COST_CATEGORIES.map((c) => c.key)
const ORIGINS = ['clip', 'caja_chica', 'caja_pos']
const NO_KIND: string[] = COST_CATEGORIES.filter((c) => c.defaultKind === null).map((c) => c.key)

// GET /api/publico/tickets/[id] — detalle: cabecera, líneas, los publico_costos que generó, y URL firmada de la foto.
export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const supabase = createServerClient()
    const [{ data: scan, error: sErr }, { data: items }, { data: costos }] = await Promise.all([
      supabase.from('ticket_scans').select('*').eq('id', id).maybeSingle(),
      supabase.from('ticket_items').select('*').eq('scan_id', id).order('pos'),
      supabase.from('publico_costos').select('id, date, category, origin, amount, cost_kind').eq('ticket_scan_id', id).order('date'),
    ])
    if (sErr) return NextResponse.json({ error: sErr.message }, { status: 500 })
    if (!scan) return NextResponse.json({ error: 'ticket no existe' }, { status: 404 })
    let imageUrl: string | null = null
    if (scan.image_path) {
      const { data: signed } = await supabase.storage.from('ticket-scans').createSignedUrl(scan.image_path, 3600)
      imageUrl = signed?.signedUrl ?? null
    }
    return NextResponse.json({ scan, items: items ?? [], costos: costos ?? [], imageUrl })
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : String(e) }, { status: 500 })
  }
}

// DELETE /api/publico/tickets/[id] — REVERTE TODO lo que el ticket generó (sin huérfanos): costos + líneas +
// scan + la foto del bucket, y recalcula los acumuladores de alias desde cero. Reversión total desde la UI.
export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const supabase = createServerClient()
    const { data: scan } = await supabase.from('ticket_scans').select('image_path').eq('id', id).maybeSingle()
    const affected = await scanRawNorms(supabase, id)
    // Orden: costos primero (su FK a scan es on-delete-set-null; hay que borrarlos explícito, si no quedan huérfanos).
    await supabase.from('publico_costos').delete().eq('ticket_scan_id', id)
    await supabase.from('ticket_items').delete().eq('scan_id', id)
    await supabase.from('ticket_scans').delete().eq('id', id)
    if (scan?.image_path) await supabase.storage.from('ticket-scans').remove([scan.image_path]).catch(() => {})
    await recomputeAliasAccumulators(supabase, affected)   // desde cero: los items ya no existen → sus alias bajan
    return NextResponse.json({ ok: true })
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : String(e) }, { status: 500 })
  }
}

type EditItem = { codigo?: string | null; descripcion?: string; descripcion_raw?: string | null; cantidad?: number | null; unidad?: string | null; precio_unitario?: number | null; importe?: number; es_descuento?: boolean }
type EditBody = {
  proveedor?: string; fecha?: string; subtotal?: number | null; descuento?: number | null; impuestos?: number | null; total?: number
  legibilidad?: string | null; notas?: string | null
  category?: string; cost_kind?: string | null; origin?: string | null; origins?: Array<{ origin?: string | null; amount?: number }>
  items?: EditItem[]
  starred?: boolean
}

// PATCH /api/publico/tickets/[id] — EDITAR = des-confirmar + re-confirmar atómico. Reemplaza cabecera + líneas,
// BORRA y RECREA los publico_costos (keyed por ticket_scan_id → sin huérfanos ni duplicados), y recalcula los
// acumuladores de alias desde cero (union de líneas viejas + nuevas). Contenedores y utilidad derivan solos.
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    let b: EditBody
    try { b = await req.json() } catch { return NextResponse.json({ error: 'JSON inválido' }, { status: 400 }) }
    const supabase = createServerClient()
    const { data: scan } = await supabase.from('ticket_scans').select('id').eq('id', id).maybeSingle()
    if (!scan) return NextResponse.json({ error: 'ticket no existe' }, { status: 404 })

    // Toggle ⭐ ligero: si solo llega `starred` (sin re-editar el ticket), marca y ya.
    if (b.starred !== undefined && b.proveedor === undefined) {
      const { error } = await supabase.from('ticket_scans').update({ starred: !!b.starred }).eq('id', id)
      if (error) return NextResponse.json({ error: error.message }, { status: 500 })
      return NextResponse.json({ ok: true })
    }

    const proveedor = (b.proveedor ?? '').trim()
    if (!proveedor) return NextResponse.json({ error: 'proveedor requerido' }, { status: 400 })
    if (!b.fecha || !/^\d{4}-\d{2}-\d{2}$/.test(b.fecha)) return NextResponse.json({ error: 'fecha (YYYY-MM-DD) requerida' }, { status: 400 })
    const total = Number(b.total)
    if (!Number.isFinite(total) || total <= 0) return NextResponse.json({ error: 'total inválido (>0)' }, { status: 400 })
    if (!b.category || !CATS.includes(b.category)) return NextResponse.json({ error: 'category inválida' }, { status: 400 })
    const cost_kind = NO_KIND.includes(b.category) ? null : (b.cost_kind === 'variable' ? 'variable' : 'fijo')

    // Pago mixto: mismos requisitos que /confirm — los splits deben cuadrar EXACTO con el total.
    let splits: Array<{ origin: string | null; amount: number }> | null = null
    if (Array.isArray(b.origins) && b.origins.length) {
      const parsed = b.origins.map((s) => ({ origin: s.origin ?? null, amount: Number(s.amount) })).filter((s) => Number.isFinite(s.amount) && s.amount > 0)
      for (const s of parsed) if (s.origin != null && !ORIGINS.includes(s.origin)) return NextResponse.json({ error: `origin inválido: ${s.origin}` }, { status: 400 })
      if (parsed.length) { const sum = parsed.reduce((a, s) => a + s.amount, 0); if (Math.abs(sum - total) > 0.01) return NextResponse.json({ error: `los contenedores suman ${sum.toFixed(2)} y el total es ${total.toFixed(2)}`, code: 'split_mismatch' }, { status: 400 }); splits = parsed }
    }
    if (!splits && b.origin != null && !ORIGINS.includes(b.origin)) return NextResponse.json({ error: 'origin inválido' }, { status: 400 })

    const oldRawNorms = await scanRawNorms(supabase, id)

    // 1) cabecera
    const { error: hErr } = await supabase.from('ticket_scans').update({
      proveedor, fecha: b.fecha, subtotal: b.subtotal ?? null, descuento: b.descuento ?? null,
      impuestos: b.impuestos ?? null, total, legibilidad: b.legibilidad ?? null, notas: b.notas ?? null,
    }).eq('id', id)
    if (hErr) return NextResponse.json({ error: hErr.message }, { status: 500 })

    // 2) líneas: reemplazo total
    await supabase.from('ticket_items').delete().eq('scan_id', id)
    const items = (b.items ?? []).filter((i) => i && i.descripcion != null)
    if (items.length) {
      const rows = items.map((i, pos) => ({
        scan_id: id, pos, codigo: i.codigo ?? null, descripcion: (i.descripcion ?? '').trim(), descripcion_raw: i.descripcion_raw ?? null,
        cantidad: i.cantidad ?? null, unidad: i.unidad ?? null, precio_unitario: i.precio_unitario ?? null,
        importe: Number(i.importe ?? 0), es_descuento: !!i.es_descuento,
      }))
      const { error: itErr } = await supabase.from('ticket_items').insert(rows)
      if (itErr) return NextResponse.json({ error: itErr.message }, { status: 500 })
    }

    // 3) costos: borra y recrea (keyed por ticket_scan_id) — sin huérfanos ni duplicados
    await supabase.from('publico_costos').delete().eq('ticket_scan_id', id)
    const costoRows = buildCostoRows({ scanId: id, date: b.fecha, category: b.category, cost_kind, proveedor, origin: b.origin ?? null, splits, total })
    const { data: costos, error: cErr } = await supabase.from('publico_costos').insert(costoRows).select('id')
    if (cErr) return NextResponse.json({ error: cErr.message }, { status: 500 })

    // 4) acumuladores de alias: recálculo DESDE CERO sobre líneas viejas ∪ nuevas (no aditivo → no infla)
    const newRawNorms = await scanRawNorms(supabase, id)
    await recomputeAliasAccumulators(supabase, [...oldRawNorms, ...newRawNorms])

    return NextResponse.json({ ok: true, costoIds: (costos ?? []).map((c) => c.id) })
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : String(e) }, { status: 500 })
  }
}
