import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { createServerClient } from '@/lib/supabase'

// POST /api/finance/envelopes — create a new apartado in a Caja Fuerte section.
// body: { label, target?, scope? } — target=null → colchón/asset (no meta); target=number → savings
// goal. scope 'personal' (default, Finanzas Alex) or 'uptown'. Created keyless (key=null); its saved
// starts at 0 and grows via fund movements (aportar/retirar).
// (The old GET — Vacaciones-only, key IS NULL — was retired: /api/finance/funds?scope=… replaced it.)
export async function POST(req: NextRequest) {
  let b: { label?: string; target?: number | null; scope?: string; sort_order?: number }
  try { b = await req.json() } catch { return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }) }
  if (!b.label || !b.label.trim()) {
    return NextResponse.json({ error: 'label required' }, { status: 400 })
  }
  const scope = b.scope === 'uptown' ? 'uptown' : 'personal'

  const supabase = createServerClient()
  const { data, error } = await supabase
    .from('finance_envelopes')
    .insert({ label: b.label.trim(), target: b.target ?? null, key: null, scope, sort_order: b.sort_order ?? 100 })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ...data, saved: 0, movements: [] }, { status: 201 })
}
