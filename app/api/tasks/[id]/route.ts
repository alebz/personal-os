import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { createServerClient } from '@/lib/supabase'

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  let body: Record<string, unknown>
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const supabase = createServerClient()
  const update = { ...body, updated_at: new Date().toISOString() }

  let result = await supabase
    .from('tasks')
    .update(update)
    .eq('id', id)
    .select()
    .single()

  // Migration 0003 not yet applied — strip unknown columns and retry
  if (result.error?.code === '42703') {
    const { key, priority_score, tags, entity_name, ...baseFields } = body
    const baseUpdate: Record<string, unknown> = {
      ...baseFields,
      updated_at: new Date().toISOString(),
    }
    if (typeof priority_score === 'number') {
      baseUpdate.priority = priority_score
    }

    result = await supabase
      .from('tasks')
      .update(baseUpdate)
      .eq('id', id)
      .select()
      .single()

    if (result.data) {
      result = {
        ...result,
        data: {
          ...result.data,
          key: key ?? result.data.key ?? null,
          priority_score: result.data.priority_score ?? result.data.priority ?? null,
          tags: tags ?? result.data.tags ?? [],
          entity_name: entity_name ?? result.data.entity_name ?? null,
        },
      }
    }
  }

  if (result.error) {
    return NextResponse.json({ error: result.error.message }, { status: 500 })
  }
  return NextResponse.json(result.data)
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const supabase = createServerClient()
  const { error } = await supabase.from('tasks').delete().eq('id', id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return new NextResponse(null, { status: 204 })
}
