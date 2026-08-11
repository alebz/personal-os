import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { importWindow, shiftDays, type WindowDay } from '@/lib/posterImport'

export const runtime = 'nodejs'

// Inicio OFICIAL del histórico de Público Gourmet. NO backfillear antes de esta fecha: marzo–mayo 2026 fueron
// el arranque INTERMITENTE del POS (días sueltos, sin operación real) y se descartaron a propósito — que la
// API de Poster devuelva ventas ahí NO significa que "falten datos" en la base. Si a futuro ves huecos antes
// de junio 2026, es deliberado, no un bug. Decisión del dueño (2026-08-10).
const HISTORY_START = '2026-06-01'

// POST /api/publico/poster/backfill?from=YYYY-MM-DD&to=YYYY-MM-DD — backfill MANUAL del histórico (una sola
// vez). Rango EXPLÍCITO obligatorio. Trocea en ventanas ≤65 días (límite de getPaymentsReport para diario)
// y llama importWindow por tramo → upsert respetando lo MANUAL, idempotente. NO va en ningún cron y NO
// escribe el heartbeat del import diario (para no falsear "el diario está sano"). Detrás del middleware.
export async function POST(req: NextRequest) {
  const from = req.nextUrl.searchParams.get('from')
  const to = req.nextUrl.searchParams.get('to')
  const ok = (s: string | null) => !!s && /^\d{4}-\d{2}-\d{2}$/.test(s)
  if (!ok(from) || !ok(to) || from! > to!) {
    return NextResponse.json({ error: 'from y to (YYYY-MM-DD, from<=to) requeridos' }, { status: 400 })
  }
  if (from! < HISTORY_START) {
    return NextResponse.json({ error: `El histórico de Público arranca el ${HISTORY_START}; marzo–mayo 2026 se descartaron (arranque intermitente del POS, sin operación real). No backfillees antes de esa fecha.` }, { status: 400 })
  }

  // Trocear [from..to] en ventanas de ≤65 días.
  const windows: Array<[string, string]> = []
  for (let s = from!; s <= to!; s = shiftDays(s, 1)) {
    let e = shiftDays(s, 64)
    if (e > to!) e = to!
    windows.push([s, e])
    s = e
  }

  const chunks: Array<{ from: string; to: string; imported: number; skippedManual: string[] }> = []
  const apiDays: WindowDay[] = []
  for (const [wf, wt] of windows) {
    const r = await importWindow(wf, wt)
    if (!r.ok) return NextResponse.json({ error: r.error, failedWindow: [wf, wt], chunksDone: chunks }, { status: r.status })
    chunks.push({ from: r.from, to: r.to, imported: r.imported, skippedManual: r.skippedManual })
    apiDays.push(...r.apiDays)
  }

  // Diagnóstico para el reporte: días de calendario del rango, cuáles trajo la API, cuáles NO (ausentes),
  // y cuáles vinieron en CERO explícito (para distinguir "no hay dato" de "vendimos cero").
  const rangeDates: string[] = []
  for (let s = from!; s <= to!; s = shiftDays(s, 1)) rangeDates.push(s)
  const apiSet = new Set(apiDays.map(d => d.date))
  const absentDays = rangeDates.filter(d => !apiSet.has(d))
  const zeroDays = apiDays.filter(d => d.efectivo === 0 && d.tarjeta === 0).map(d => d.date)

  return NextResponse.json({
    ok: true,
    range: { from, to, calendarDays: rangeDates.length },
    windows: windows.length,
    totalImported: chunks.reduce((s, c) => s + c.imported, 0),
    skippedManual: chunks.flatMap(c => c.skippedManual),
    apiDays: apiDays.sort((a, b) => a.date.localeCompare(b.date)),
    absentDays,   // días del rango que la API NO devolvió = sin billing (cerrado / sin venta)
    zeroDays,     // días que la API devolvió con efectivo=tarjeta=0 (venta cero explícita), si los hay
    chunks,
  })
}
