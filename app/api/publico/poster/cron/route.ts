import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { runPosterImport, importSupplies } from '@/lib/posterImport'
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
  return NextResponse.json({ ventas: r, compras: s.ok ? { imported: s.imported, skippedManual: s.skippedManual.length } : { error: s.error }, draftsBarridos: drafts }, { status: r.ok ? 200 : r.status })
}
