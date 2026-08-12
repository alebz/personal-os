import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { createServerClient } from '@/lib/supabase'

export const runtime = 'nodejs'

// POST /api/publico/previstos/reorder  body: { ids: string[] } — reordena por arrastre (mismo patrón que
// inquilinos de Uptown): el índice en el array pasa a ser el sort_order.
export async function POST(req: NextRequest) {
  let b: { ids?: string[] }
  try { b = await req.json() } catch { return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }) }
  if (!Array.isArray(b.ids) || !b.ids.length) return NextResponse.json({ error: 'ids requerido' }, { status: 400 })
  const supabase = createServerClient()
  const now = new Date().toISOString()
  await Promise.all(b.ids.map((id, i) => supabase.from('publico_previstos').update({ sort_order: i }).eq('id', id)))
  return NextResponse.json({ ok: true, at: now })
}
