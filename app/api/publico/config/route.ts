import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { createServerClient } from '@/lib/supabase'

// Config de reparto de Público (una fila, id=1). split_alex = % de Alex; Andrés = 100 − split_alex.
// El % es la DECISIÓN (config); las libretas de socios son la EVIDENCIA. Arranca 50/50.
export async function GET() {
  const supabase = createServerClient()
  // Resiliente a que clip_rate aún no exista (antes de la migración 0079): cae a solo split_alex.
  let row = await supabase.from('publico_config').select('split_alex, clip_rate, propina_umbral_amarillo, propina_umbral_rojo').eq('id', 1).maybeSingle()
  if (row.error) row = await supabase.from('publico_config').select('split_alex, clip_rate').eq('id', 1).maybeSingle() as typeof row
  if (row.error) row = await supabase.from('publico_config').select('split_alex').eq('id', 1).maybeSingle() as typeof row
  if (row.error) return NextResponse.json({ error: row.error.message }, { status: 500 })
  const d = row.data as { split_alex?: number; clip_rate?: number; propina_umbral_amarillo?: number; propina_umbral_rojo?: number } | null
  return NextResponse.json({ split_alex: Number(d?.split_alex ?? 50), clip_rate: Number(d?.clip_rate ?? 0.036), propina_umbral_amarillo: Number(d?.propina_umbral_amarillo ?? 1000), propina_umbral_rojo: Number(d?.propina_umbral_rojo ?? 2000) })
}

export async function POST(req: NextRequest) {
  let b: { split_alex?: number; clip_rate?: number; propina_umbral_amarillo?: number; propina_umbral_rojo?: number }
  try { b = await req.json() } catch { return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }) }
  const upd: Record<string, unknown> = { id: 1, updated_at: new Date().toISOString() }
  if (b.split_alex !== undefined) { const s = Number(b.split_alex); if (!Number.isFinite(s) || s < 0 || s > 100) return NextResponse.json({ error: 'split_alex 0–100' }, { status: 400 }); upd.split_alex = s }
  // Tasa de Clip como FRACCIÓN (0.036 = 3.6%). Se acepta en % (3.6) o fracción (0.036) y se normaliza.
  if (b.clip_rate !== undefined) { let r = Number(b.clip_rate); if (!Number.isFinite(r) || r < 0) return NextResponse.json({ error: 'clip_rate inválida' }, { status: 400 }); if (r >= 1) r = r / 100; if (r >= 1) return NextResponse.json({ error: 'clip_rate debe ser < 100%' }, { status: 400 }); upd.clip_rate = r }
  // Umbrales del badge de propina (pesos). amarillo < rojo.
  if (b.propina_umbral_amarillo !== undefined) { const a = Number(b.propina_umbral_amarillo); if (!Number.isFinite(a) || a < 0) return NextResponse.json({ error: 'umbral amarillo inválido' }, { status: 400 }); upd.propina_umbral_amarillo = a }
  if (b.propina_umbral_rojo !== undefined) { const r = Number(b.propina_umbral_rojo); if (!Number.isFinite(r) || r < 0) return NextResponse.json({ error: 'umbral rojo inválido' }, { status: 400 }); upd.propina_umbral_rojo = r }

  const supabase = createServerClient()
  const { data, error } = await supabase.from('publico_config').upsert(upd, { onConflict: 'id' }).select('split_alex, clip_rate, propina_umbral_amarillo, propina_umbral_rojo').single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ split_alex: Number(data.split_alex), clip_rate: Number(data.clip_rate), propina_umbral_amarillo: Number(data.propina_umbral_amarillo), propina_umbral_rojo: Number(data.propina_umbral_rojo) })
}
