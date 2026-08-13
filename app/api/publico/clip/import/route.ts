import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { createServerClient } from '@/lib/supabase'
import { runClipImport, importClipSettlements } from '@/lib/clipSettlements'

export const runtime = 'nodejs'
export const maxDuration = 60

const MX = 'America/Mexico_City'
const todayMX = () => new Date().toLocaleDateString('en-CA', { timeZone: MX })
const shiftDays = (iso: string, n: number) => { const [y, m, d] = iso.split('-').map(Number); const t = new Date(Date.UTC(y, m - 1, d)); t.setUTCDate(t.getUTCDate() + n); return t.toISOString().slice(0, 10) }
// Clip: `from` no puede ser >90 días atrás. Clampeamos con margen.
const clampFrom = (from: string) => { const floor = shiftDays(todayMX(), -89); return from < floor ? floor : from }

// GET  → heartbeat del sync + (si hay credenciales) un dry-run del rango pedido, sin escribir.
export async function GET(req: NextRequest) {
  const supabase = createServerClient()
  const { data: sync } = await supabase.from('publico_clip_sync').select('*').eq('id', 'default').maybeSingle()
  const to = todayMX(), from = clampFrom(req.nextUrl.searchParams.get('from') ?? shiftDays(to, -40))
  const dry = await importClipSettlements(supabase, { from, to, commit: false }).catch(() => null)
  return NextResponse.json({ sync: sync ?? null, dryRun: dry })
}

// POST → COMMIT. body { from?, to? }. Para el BACKFILL desde junio: from=2026-06-01 (dentro de los 90 días).
export async function POST(req: NextRequest) {
  let b: { from?: string; to?: string } = {}
  try { b = await req.json() } catch { /* body opcional */ }
  const to = b.to && /^\d{4}-\d{2}-\d{2}$/.test(b.to) ? b.to : todayMX()
  const from = clampFrom(b.from && /^\d{4}-\d{2}-\d{2}$/.test(b.from) ? b.from : shiftDays(to, -40))
  const supabase = createServerClient()
  const r = await runClipImport(supabase, from, to)
  return NextResponse.json(r, { status: r.ok ? 200 : r.status })
}
