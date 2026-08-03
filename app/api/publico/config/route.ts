import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { createServerClient } from '@/lib/supabase'

// Config de reparto de Público (una fila, id=1). split_alex = % de Alex; Andrés = 100 − split_alex.
// El % es la DECISIÓN (config); las libretas de socios son la EVIDENCIA. Arranca 50/50.
export async function GET() {
  const supabase = createServerClient()
  const { data, error } = await supabase.from('publico_config').select('split_alex').eq('id', 1).maybeSingle()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ split_alex: Number(data?.split_alex ?? 50) })
}

export async function POST(req: NextRequest) {
  let b: { split_alex?: number }
  try { b = await req.json() } catch { return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }) }
  const s = Number(b.split_alex)
  if (!Number.isFinite(s) || s < 0 || s > 100) return NextResponse.json({ error: 'split_alex 0–100' }, { status: 400 })

  const supabase = createServerClient()
  const { data, error } = await supabase
    .from('publico_config')
    .upsert({ id: 1, split_alex: s, updated_at: new Date().toISOString() }, { onConflict: 'id' })
    .select('split_alex').single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ split_alex: Number(data.split_alex) })
}
