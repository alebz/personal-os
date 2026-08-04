import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { createServerClient } from '@/lib/supabase'

// GET /api/uptown/renters — inquilinos ordenados. ?archived=1 incluye los archivados (soft-deleted).
export async function GET(req: NextRequest) {
  const includeArchived = req.nextUrl.searchParams.get('archived') === '1'
  const supabase = createServerClient()
  let q = supabase.from('uptown_renters').select('*').order('sort_order').order('created_at')
  if (!includeArchived) q = q.eq('archived', false)
  const { data, error } = await q
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data ?? [])
}

// POST /api/uptown/renters — alta. { name, rent, location?, start_month? }. Genera la key (id).
export async function POST(req: NextRequest) {
  let b: { name?: string; rent?: number; location?: string | null; start_month?: string | null }
  try { b = await req.json() } catch { return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }) }
  if (!b.name?.trim()) return NextResponse.json({ error: 'name required' }, { status: 400 })
  const rent = Number(b.rent ?? 0)
  if (!Number.isFinite(rent) || rent < 0) return NextResponse.json({ error: 'rent inválido' }, { status: 400 })

  const supabase = createServerClient()
  // sort_order = al final de la lista.
  const { data: last } = await supabase.from('uptown_renters').select('sort_order').order('sort_order', { ascending: false }).limit(1).maybeSingle()
  const id = `r_${crypto.randomUUID().slice(0, 8)}`   // key opaca estable (uptown_rents.renter apunta aquí)
  const row = {
    id, name: b.name.trim(), rent, location: b.location?.trim() || null,
    start_month: b.start_month || null, sort_order: (last?.sort_order ?? -1) + 1,
  }
  const { data, error } = await supabase.from('uptown_renters').insert(row).select().single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ renter: data })
}
