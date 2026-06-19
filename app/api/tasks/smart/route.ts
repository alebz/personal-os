import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { createServerClient } from '@/lib/supabase'
import Anthropic from '@anthropic-ai/sdk'

const anthropic = new Anthropic()

export async function POST(req: NextRequest) {
  let body: { query?: string }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const { query } = body
  if (!query?.trim()) {
    return NextResponse.json({ error: 'query is required' }, { status: 400 })
  }

  const supabase = createServerClient()
  const { data: tasks, error } = await supabase
    .from('tasks')
    .select('id, title, description, urgency, tags, entity_name, priority_score')
    .is('completed_at', null)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  if (!tasks?.length) return NextResponse.json([])

  const taskLines = tasks
    .map(
      (t, i) =>
        `${i + 1}. [${t.id}] ${t.title}` +
        (t.description ? ` — ${t.description}` : '') +
        (t.urgency ? ` | urgency:${t.urgency}` : '') +
        (t.entity_name ? ` | entity:${t.entity_name}` : '') +
        (t.tags?.length ? ` | tags:${t.tags.join(',')}` : '') +
        (t.priority_score != null ? ` | priority:${t.priority_score}` : '')
    )
    .join('\n')

  const response = await anthropic.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 512,
    messages: [
      {
        role: 'user',
        content: `You are a personal task search assistant. Return the IDs of tasks that match the natural language query below.

Tasks:
${taskLines}

Query: "${query}"

Respond with ONLY a JSON array of matching task UUIDs, e.g. ["uuid1","uuid2"]. If no tasks match, return []. Do not include any explanation.`,
      },
    ],
  })

  let ids: string[] = []
  try {
    const text =
      response.content[0].type === 'text' ? response.content[0].text.trim() : '[]'
    ids = JSON.parse(text)
  } catch {
    ids = []
  }

  const matched = tasks.filter((t) => ids.includes(t.id))
  return NextResponse.json(matched)
}
