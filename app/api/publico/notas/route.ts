import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { createServerClient } from '@/lib/supabase'

export const runtime = 'nodejs'

// Notas operativas (título + cuerpo), ordenables, borrado reversible (soft-delete).
// GET → lista visible (no archivadas), en orden.
export async function GET() {
  const supabase = createServerClient()
  const { data, error } = await supabase.from('publico_notas').select('id, titulo, cuerpo, sort_order').eq('scope', 'publico').eq('archived', false).order('sort_order', { ascending: true }).order('created_at', { ascending: true })
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ notas: data ?? [] })
}

// POST → crear una nota (al final del orden). body { titulo, cuerpo }.
export async function POST(req: NextRequest) {
  let b: { titulo?: string; cuerpo?: string }
  try { b = await req.json() } catch { return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }) }
  const titulo = (b.titulo ?? '').trim(), cuerpo = (b.cuerpo ?? '').trim()
  if (!titulo && !cuerpo) return NextResponse.json({ error: 'nota vacía' }, { status: 400 })
  const supabase = createServerClient()
  const { data: last } = await supabase.from('publico_notas').select('sort_order').eq('scope', 'publico').order('sort_order', { ascending: false }).limit(1).maybeSingle()
  const sort_order = (last?.sort_order ?? -1) + 1
  const { data, error } = await supabase.from('publico_notas').insert({ scope: 'publico', titulo, cuerpo, sort_order }).select('id, titulo, cuerpo, sort_order').single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true, nota: data })
}

// PATCH → editar (titulo/cuerpo), restaurar (archived:false), o REORDENAR (order: [id,...] → reasigna sort_order).
export async function PATCH(req: NextRequest) {
  let b: { id?: string; titulo?: string; cuerpo?: string; archived?: boolean; order?: string[] }
  try { b = await req.json() } catch { return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }) }
  const supabase = createServerClient()
  if (Array.isArray(b.order)) {
    // Reordenar: sort_order = índice en la lista recibida.
    const now = new Date().toISOString()
    for (let i = 0; i < b.order.length; i++) await supabase.from('publico_notas').update({ sort_order: i, updated_at: now }).eq('id', b.order[i]).eq('scope', 'publico')
    return NextResponse.json({ ok: true })
  }
  if (!b.id) return NextResponse.json({ error: 'falta id' }, { status: 400 })
  const upd: Record<string, unknown> = { updated_at: new Date().toISOString() }
  if (b.titulo !== undefined) upd.titulo = b.titulo.trim()
  if (b.cuerpo !== undefined) upd.cuerpo = b.cuerpo.trim()
  if (b.archived !== undefined) upd.archived = b.archived   // restaurar (false) tras un borrado
  const { error } = await supabase.from('publico_notas').update(upd).eq('id', b.id).eq('scope', 'publico')
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}

// DELETE ?id → borrado REVERSIBLE (soft): archiva la nota. Se restaura con PATCH { id, archived:false } ("deshacer").
export async function DELETE(req: NextRequest) {
  const id = req.nextUrl.searchParams.get('id')
  if (!id) return NextResponse.json({ error: 'falta id' }, { status: 400 })
  const supabase = createServerClient()
  const { error } = await supabase.from('publico_notas').update({ archived: true, updated_at: new Date().toISOString() }).eq('id', id).eq('scope', 'publico')
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
