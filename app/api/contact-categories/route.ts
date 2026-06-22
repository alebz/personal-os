import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { createServerClient } from '@/lib/supabase'

export const runtime = 'nodejs'

const DEFAULTS = ['Familia', 'Círculo cercano', 'Círculo extendido', 'Proveedores', 'Clientes']

export async function GET() {
  const supabase = createServerClient()

  const { data, error } = await supabase
    .from('entities')
    .select('id,name')
    .eq('type', 'contact_category')
    .order('created_at')

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // Auto-seed defaults on first use so no manual migration run is required
  if (!data || data.length === 0) {
    const { error: seedErr } = await supabase
      .from('entities')
      .insert(DEFAULTS.map(name => ({ type: 'contact_category', name })))

    if (seedErr) return NextResponse.json({ error: seedErr.message }, { status: 500 })

    const { data: seeded, error: fetchErr } = await supabase
      .from('entities')
      .select('id,name')
      .eq('type', 'contact_category')
      .order('created_at')

    if (fetchErr) return NextResponse.json({ error: fetchErr.message }, { status: 500 })
    return NextResponse.json(seeded ?? [])
  }

  return NextResponse.json(data)
}

export async function POST(req: NextRequest) {
  let body: { name?: string }
  try { body = await req.json() } catch { return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }) }

  const name = body.name?.trim()
  if (!name) return NextResponse.json({ error: 'name is required' }, { status: 400 })

  const supabase = createServerClient()

  const { data: existing } = await supabase
    .from('entities')
    .select('id')
    .eq('type', 'contact_category')
    .eq('name', name)
    .maybeSingle()

  if (existing) return NextResponse.json({ error: 'Ya existe una categoría con ese nombre' }, { status: 409 })

  const { data, error } = await supabase
    .from('entities')
    .insert({ type: 'contact_category', name })
    .select('id,name')
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data, { status: 201 })
}
