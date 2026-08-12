import { NextResponse } from 'next/server'
import { importSupplies } from '@/lib/posterImport'

export const runtime = 'nodejs'

// GET  → DRY-RUN: qué compras de Poster se importarían (por mes, cuántas se saltan por manual). No escribe.
// POST → COMMIT: importa storage.getSupplies → publico_costos (source='poster', anti-dup, bruto, insumo, sin
//        contenedor). Respeta lo manual. Son COMPRAS (P&L), NO consumo: no toca write-offs ni food cost real.
export async function GET() {
  const r = await importSupplies({ commit: false })
  if (!r.ok) return NextResponse.json({ error: r.error }, { status: r.status })
  return NextResponse.json({ dryRun: true, byMonth: r.byMonth, wouldImport: r.imported, wouldSkipManual: r.skippedManual.length, skipped: r.skippedManual })
}

export async function POST() {
  const r = await importSupplies({ commit: true })
  if (!r.ok) return NextResponse.json({ error: r.error }, { status: r.status })
  return NextResponse.json({ committed: true, byMonth: r.byMonth, imported: r.imported, skippedManual: r.skippedManual.length, skipped: r.skippedManual })
}
