import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { runPosterImport, importSupplies } from '@/lib/posterImport'
import { runClipImport } from '@/lib/clipSettlements'
import { runClipTipsImport } from '@/lib/clipTips'
import { createServerClient } from '@/lib/supabase'

export const runtime = 'nodejs'

// Barre fotos de ticket HUÉRFANAS: las que se subieron a drafts/ pero NUNCA se confirmaron (al confirmar se
// mueven a su carpeta por fecha). Borra las de drafts/ con más de 24h. Evita basura acumulada en Storage (#5).
async function sweepDraftTickets(): Promise<{ deleted: number } | { error: string }> {
  try {
    const supabase = createServerClient()
    const { data, error } = await supabase.storage.from('ticket-scans').list('drafts', { limit: 1000 })
    if (error) return { error: error.message }
    const cutoff = Date.now() - 24 * 3600 * 1000
    const stale = (data ?? []).filter((f) => { const t = new Date(f.created_at ?? 0).getTime(); return t > 0 && t < cutoff }).map((f) => `drafts/${f.name}`)
    if (stale.length) await supabase.storage.from('ticket-scans').remove(stale)
    return { deleted: stale.length }
  } catch (e) { return { error: e instanceof Error ? e.message : String(e) } }
}

// GET /api/publico/poster/cron — lo llama el Vercel Cron 1×/día (Vercel manda GET). Corre el import de la
// ventana (relleno de huecos incluido). Protegido: Vercel agrega `Authorization: Bearer $CRON_SECRET`
// automáticamente si CRON_SECRET está en el entorno; lo verificamos para que nadie más lo dispare.
export async function GET(req: NextRequest) {
  const secret = process.env.CRON_SECRET
  if (secret && req.headers.get('authorization') !== `Bearer ${secret}`) {
    return NextResponse.json({ error: 'no autorizado' }, { status: 401 })
  }
  const r = await runPosterImport(14)
  // Compras de Poster: las nuevas entran solas (idempotente, anti-dup por supply_id, respeta lo manual).
  // No hace fallar el cron de ventas si algo truena aquí: se reporta aparte.
  const s = await importSupplies({ commit: true })
  const drafts = await sweepDraftTickets()   // limpia fotos de ticket subidas y nunca confirmadas
  // Comisiones de Clip (settlements): ventana reciente (relleno de huecos), idempotente. Solo si hay credenciales;
  // si no, devuelve error suave sin tumbar el cron. Escribe su propio heartbeat (publico_clip_sync).
  const to = new Date().toLocaleDateString('en-CA', { timeZone: 'America/Mexico_City' })
  const from = (() => { const [y, m, d] = to.split('-').map(Number); const t = new Date(Date.UTC(y, m - 1, d)); t.setUTCDate(t.getUTCDate() - 40); return t.toISOString().slice(0, 10) })()
  const clip = await runClipImport(createServerClient(), from, to).catch((e) => ({ ok: false as const, error: String(e), status: 500 }))
  // Propinas de tarjeta (Clip /payments): ventana corta (últimos ~10 días) para no hacer 40 llamadas por día.
  const tipsFrom = (() => { const [y, m, d] = to.split('-').map(Number); const t = new Date(Date.UTC(y, m - 1, d)); t.setUTCDate(t.getUTCDate() - 10); return t.toISOString().slice(0, 10) })()
  const tips = await runClipTipsImport(createServerClient(), tipsFrom, to).catch((e) => ({ ok: false as const, error: String(e), status: 500 }))
  return NextResponse.json({ ventas: r, compras: s.ok ? { imported: s.imported, skippedManual: s.skippedManual.length } : { error: s.error }, draftsBarridos: drafts, comisionesClip: clip.ok ? { imported: clip.imported, totalFee: clip.totalFee } : { error: clip.error }, propinasClip: tips.ok ? { imported: tips.imported, totalTip: tips.totalTip } : { error: tips.error } }, { status: r.ok ? 200 : r.status })
}
