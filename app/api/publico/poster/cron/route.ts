import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { runPosterImport, importSupplies } from '@/lib/posterImport'
import { runClipImport } from '@/lib/clipSettlements'
import { runPosterTipsImport } from '@/lib/posterTips'
import { createServerClient } from '@/lib/supabase'

export const runtime = 'nodejs'

// Registra la salud de UN paso en publico_cron_health. La clave: `count` separa "corrió" de "trajo datos".
// last_nonempty_at solo se mueve si count>0 → un paso en verde pero importando cero deja last_nonempty_at
// congelado (o null), y ESO es lo que la barra de estado lee como "verde pero vacío". El heartbeat viejo no lo
// veía porque solo miraba si el paso tronó. La salud nunca debe tumbar el cron: se traga sus propios errores.
async function recordHealth(supabase: ReturnType<typeof createServerClient>, step: string, ok: boolean, count: number, error?: string | null) {
  const now = new Date().toISOString()
  const patch: Record<string, unknown> = { last_run_at: now, updated_at: now, last_import_count: count }
  if (ok) { patch.last_success_at = now; patch.last_error = null } else { patch.last_error = error ?? 'error' }
  if (count > 0) patch.last_nonempty_at = now
  try { await supabase.from('publico_cron_health').update(patch).eq('step', step) } catch { /* la salud no debe tumbar el cron */ }
}

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
  const supabase = createServerClient()

  const r = await runPosterImport(14)
  await recordHealth(supabase, 'ventas', r.ok, r.ok ? r.imported : 0, r.ok ? null : r.error)

  // Compras de Poster: las nuevas entran solas (idempotente, anti-dup por supply_id, respeta lo manual).
  const s = await importSupplies({ commit: true })
  await recordHealth(supabase, 'compras', s.ok, s.ok ? s.imported : 0, s.ok ? null : s.error)

  const drafts = await sweepDraftTickets()   // limpia fotos de ticket subidas y nunca confirmadas
  await recordHealth(supabase, 'sweep', !('error' in drafts), 'deleted' in drafts ? drafts.deleted : 0, 'error' in drafts ? drafts.error : null)

  // Comisiones de Clip (settlements): ventana reciente (relleno de huecos), idempotente. Solo si hay credenciales;
  // si no, devuelve error suave sin tumbar el cron. Escribe su propio heartbeat (publico_clip_sync) + la salud.
  const to = new Date().toLocaleDateString('en-CA', { timeZone: 'America/Mexico_City' })
  const from = (() => { const [y, m, d] = to.split('-').map(Number); const t = new Date(Date.UTC(y, m - 1, d)); t.setUTCDate(t.getUTCDate() - 40); return t.toISOString().slice(0, 10) })()
  const clip = await runClipImport(supabase, from, to).catch((e) => ({ ok: false as const, error: String(e), status: 500 }))
  await recordHealth(supabase, 'clip', clip.ok, clip.ok ? clip.imported : 0, clip.ok ? null : clip.error)

  // Propinas desde POSTER (tips_cash + tips_card): ventana corta (últimos ~10 días). Reemplaza a Clip (que solo veía tarjeta).
  const tipsFrom = (() => { const [y, m, d] = to.split('-').map(Number); const t = new Date(Date.UTC(y, m - 1, d)); t.setUTCDate(t.getUTCDate() - 10); return t.toISOString().slice(0, 10) })()
  const tips = await runPosterTipsImport(supabase, tipsFrom, to).catch((e) => ({ ok: false as const, error: String(e), status: 500 }))
  await recordHealth(supabase, 'propinas', tips.ok, tips.ok ? tips.imported : 0, tips.ok ? null : tips.error)

  // Status HTTP = 500 si CUALQUIER paso de dinero ERRÓ (no si trajo cero — eso es legítimo a veces y lo cachea la
  // barra de estado como "verde pero vacío"). Así la alerta de cron-fallido de Vercel se dispara ante errores reales,
  // ya no solo ante los de ventas.
  const anyError = !r.ok || !s.ok || !clip.ok || !tips.ok
  return NextResponse.json({
    ventas: r,
    compras: s.ok ? { imported: s.imported, skippedManual: s.skippedManual.length } : { error: s.error },
    draftsBarridos: drafts,
    comisionesClip: clip.ok ? { imported: clip.imported, totalFee: clip.totalFee } : { error: clip.error },
    propinasPoster: tips.ok ? { imported: tips.imported, total: tips.total } : { error: tips.error },
  }, { status: anyError ? 500 : 200 })
}
