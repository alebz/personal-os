import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { createServerClient } from '@/lib/supabase'

// POST /api/finance/cards/reorder — { ids: [...] } en el nuevo orden → sort_order = índice.
export async function POST(req: NextRequest) {
  let b: { ids?: string[] }
  try { b = await req.json() } catch { return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }) }
  if (!Array.isArray(b.ids)) return NextResponse.json({ error: 'ids required' }, { status: 400 })

  const supabase = createServerClient()
  await Promise.all(b.ids.map((id, i) => supabase.from('finance_cards').update({ sort_order: i }).eq('id', id)))
  return NextResponse.json({ ok: true })
}
