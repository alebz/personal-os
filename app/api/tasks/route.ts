import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { createServerClient } from '@/lib/supabase'

// Columns available after migration 0003 (key, priority_score, tags, entity_name).
// If those columns don't exist yet, Supabase returns code 42703. We detect that
// and fall back to the base schema from migrations 0001–0002, so the app stays
// functional without requiring the migration to be applied first.
const SELECT_FULL =
  'id,title,description,urgency,key,priority_score,tags,entity_id,entity_name,completed_at,created_at'
const SELECT_BASE =
  'id,title,description,urgency,priority,entity_id,completed_at,created_at'

// Normalise a task row so the client always receives the same Task shape
// regardless of whether migration 0003 has been applied.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function normalise(task: any): any {
  return {
    ...task,
    key: task.key ?? null,
    priority_score: task.priority_score ?? task.priority ?? null,
    tags: task.tags ?? [],
    entity_name: task.entity_name ?? null,
  }
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const status = searchParams.get('status') // 'open' | 'done' | null (= all)

  const supabase = createServerClient()

  // Build and execute the full query (migration 0003 columns)
  let q = supabase
    .from('tasks')
    .select(SELECT_FULL)
    .order('priority_score', { ascending: false, nullsFirst: false })
    .order('created_at', { ascending: false })

  if (status === 'open') q = q.is('completed_at', null)
  else if (status === 'done') q = q.not('completed_at', 'is', null)

  let { data, error } = await q

  // Migration 0003 not applied — fall back to base schema
  if (error?.code === '42703') {
    let qb = supabase
      .from('tasks')
      .select(SELECT_BASE)
      .order('priority', { ascending: false, nullsFirst: false })
      .order('created_at', { ascending: false })

    if (status === 'open') qb = qb.is('completed_at', null)
    else if (status === 'done') qb = qb.not('completed_at', 'is', null)

    const fb = await qb
    error = fb.error
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    data = fb.data ? (fb.data as any[]).map(normalise) : null
  }

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return NextResponse.json((data as any[] ?? []).map(normalise))
}

export async function POST(req: NextRequest) {
  let body: Record<string, unknown>
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const {
    title,
    description = null,
    urgency = 'someday',
    key = null,
    priority_score = null,
    tags = [],
    entity_id = null,
    entity_name = null,
  } = body

  if (!title || typeof title !== 'string') {
    return NextResponse.json({ error: 'title is required' }, { status: 400 })
  }

  const supabase = createServerClient()

  // Try inserting with all columns (migration 0003 applied)
  let { data, error } = await supabase
    .from('tasks')
    .insert({
      title: title.trim(),
      description,
      urgency,
      key,
      priority_score,
      tags,
      entity_id,
      entity_name,
      status: 'todo',
    })
    .select()
    .single()

  // Migration 0003 not yet applied — insert without the new columns
  if (error?.code === '42703') {
    const fb = await supabase
      .from('tasks')
      .insert({
        title: title.trim(),
        description,
        urgency,
        priority: typeof priority_score === 'number' ? priority_score : null,
        entity_id,
        status: 'todo',
      })
      .select()
      .single()

    error = fb.error
    // Stitch in the values we couldn't persist so the client gets a
    // complete Task shape back (entity_name is needed for the Category view).
    data = fb.data ? normalise({ ...fb.data, entity_name }) : null
  }

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(normalise(data), { status: 201 })
}
