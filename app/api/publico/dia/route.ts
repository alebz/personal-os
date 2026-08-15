import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { createServerClient } from '@/lib/supabase'
import { todayMX } from '@/lib/posterImport'

export const runtime = 'nodejs'

// GET /api/publico/dia?date=YYYY-MM-DD — lo capturado ESE día (por defecto hoy CDMX) + el total, para que
// quien captura vea de un vistazo qué lleva y cuánto va. Une tickets confirmados (con o sin foto) y costos
// sueltos (los que no cuelgan de un ticket, p. ej. import de Poster). Solo lectura.
export async function GET(req: NextRequest) {
  const q = req.nextUrl.searchParams.get('date')
  const date = q && /^\d{4}-\d{2}-\d{2}$/.test(q) ? q : todayMX()
  const supabase = createServerClient()

  const [scansR, costosR] = await Promise.all([
    supabase
      .from('ticket_scans')
      .select('id, proveedor, total, confirmed_at, image_path')
      .eq('scope', 'publico').eq('status', 'confirmed').eq('fecha', date)
      .order('confirmed_at', { ascending: false }),
    supabase
      .from('publico_costos')
      .select('id, note, proveedor, amount, category, created_at')
      .eq('scope', 'publico').eq('date', date).is('ticket_scan_id', null)
      .order('created_at', { ascending: false }),
  ])
  if (scansR.error) return NextResponse.json({ error: scansR.error.message }, { status: 500 })
  if (costosR.error) return NextResponse.json({ error: costosR.error.message }, { status: 500 })

  type Item = { kind: 'ticket' | 'suelto'; id: string; label: string; amount: number; withFoto: boolean; at: string | null }
  const items: Item[] = [
    ...(scansR.data ?? []).map((t): Item => ({
      kind: 'ticket', id: t.id, label: (t.proveedor ?? '—') as string,
      amount: Number(t.total ?? 0), withFoto: !!t.image_path, at: t.confirmed_at as string | null,
    })),
    ...(costosR.data ?? []).map((s): Item => ({
      kind: 'suelto', id: s.id, label: (s.proveedor ?? s.note ?? s.category ?? 'gasto') as string,
      amount: Number(s.amount ?? 0), withFoto: false, at: s.created_at as string | null,
    })),
  ].sort((a, b) => (b.at ?? '').localeCompare(a.at ?? ''))

  const total = items.reduce((s, it) => s + it.amount, 0)
  return NextResponse.json({ date, items, total, count: items.length })
}
