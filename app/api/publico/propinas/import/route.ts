import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { createServerClient } from '@/lib/supabase'
import { importClipTips, runClipTipsImport } from '@/lib/clipTips'

export const runtime = 'nodejs'
export const maxDuration = 60

const MX = 'America/Mexico_City'
const todayMX = () => new Date().toLocaleDateString('en-CA', { timeZone: MX })
const shiftDays = (iso: string, n: number) => { const [y, m, d] = iso.split('-').map(Number); const t = new Date(Date.UTC(y, m - 1, d)); t.setUTCDate(t.getUTCDate() + n); return t.toISOString().slice(0, 10) }
// Clip /payments: `from` no puede ser >90 días atrás.
const clampFrom = (from: string) => { const floor = shiftDays(todayMX(), -89); return from < floor ? floor : from }

// GET → heartbeat + dry-run (cuánta propina hay en el rango, sin escribir).
export async function GET(req: NextRequest) {
  const supabase = createServerClient()
  const { data: sync } = await supabase.from('publico_propina_sync').select('*').eq('id', 'default').maybeSingle()
  const to = todayMX(), from = clampFrom(req.nextUrl.searchParams.get('from') ?? shiftDays(to, -7))
  const dry = await importClipTips(supabase, { from, to, commit: false }).catch(() => null)
  return NextResponse.json({ sync: sync ?? null, dryRun: dry })
}

// POST → COMMIT. body { from?, to? }. Backfill desde junio: from=2026-06-01 (dentro de 90 días).
export async function POST(req: NextRequest) {
  let b: { from?: string; to?: string } = {}
  try { b = await req.json() } catch { /* body opcional */ }
  const to = b.to && /^\d{4}-\d{2}-\d{2}$/.test(b.to) ? b.to : todayMX()
  const from = clampFrom(b.from && /^\d{4}-\d{2}-\d{2}$/.test(b.from) ? b.from : shiftDays(to, -7))
  const supabase = createServerClient()
  const r = await runClipTipsImport(supabase, from, to)
  return NextResponse.json(r, { status: r.ok ? 200 : r.status })
}
