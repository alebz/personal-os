import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'

export const runtime = 'nodejs'

const SYSTEM_PROMPT = [
  'Eres un asistente de journaling personal. Analiza la entrada de diario y proporciona:',
  '1. Un resumen conciso de 2-3 oraciones que capture los temas principales y el tono emocional.',
  '2. Exactamente 3 insights clave o reflexiones importantes derivadas de la entrada.',
  'Responde en el mismo idioma que la entrada del diario.',
].join(' ')

const SUMMARY_SCHEMA = {
  type: 'object',
  properties: {
    summary:  { type: 'string', description: 'Resumen de 2-3 oraciones' },
    insights: {
      type:        'array',
      items:       { type: 'string' },
      minItems:    3,
      maxItems:    3,
      description: 'Exactamente 3 insights clave',
    },
  },
  required:             ['summary', 'insights'],
  additionalProperties: false,
} as const

export async function POST(req: NextRequest) {
  let body: { content?: string }
  try { body = await req.json() } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const { content } = body
  if (!content?.trim()) {
    return NextResponse.json({ error: 'content required' }, { status: 400 })
  }

  const client = new Anthropic()
  const response = await client.messages.create({
    model:      process.env.ANTHROPIC_MODEL ?? 'claude-sonnet-4-6',
    max_tokens: 1024,
    system:     SYSTEM_PROMPT,
    output_config: {
      format: { type: 'json_schema', schema: SUMMARY_SCHEMA },
    },
    messages: [
      { role: 'user', content: `Entrada de diario:\n\n${content.trim()}` },
    ],
  })

  const block = response.content.find(b => b.type === 'text')
  if (!block || block.type !== 'text') {
    return NextResponse.json({ error: 'Claude returned no text block' }, { status: 500 })
  }

  let parsed: { summary: string; insights: string[] }
  try { parsed = JSON.parse(block.text) } catch {
    return NextResponse.json({ error: 'Failed to parse Claude response' }, { status: 500 })
  }

  return NextResponse.json({
    summary:  parsed.summary  ?? '',
    insights: Array.isArray(parsed.insights) ? parsed.insights.slice(0, 3) : [],
  })
}
