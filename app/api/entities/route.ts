import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { createServerClient } from '@/lib/supabase'

export const runtime = 'nodejs'

export async function GET() {
  const supabase = createServerClient()
  const { data, error } = await supabase
    .from('entities')
    .select('id,name,type,created_at')
    .order('name')

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data ?? [])
}

export async function POST(req: NextRequest) {
  let body: { name?: string; type?: string }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const { name, type = 'crm' } = body
  if (!name?.trim()) return NextResponse.json({ error: 'name is required' }, { status: 400 })

  const supabase = createServerClient()
  const { data, error } = await supabase
    .from('entities')
    .insert({ name: name.trim(), type })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data, { status: 201 })
}
