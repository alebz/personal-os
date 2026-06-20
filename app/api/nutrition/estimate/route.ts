import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'

export const runtime = 'nodejs'

const SYSTEM_PROMPT =
  'Eres un asistente de nutrición. Estima los valores nutricionales para el alimento descrito. ' +
  'Responde con valores razonables para una porción típica. Usa ÚNICAMENTE números enteros. ' +
  'Responde solo con JSON válido, sin texto adicional.'

const SCHEMA = {
  type: 'object',
  properties: {
    kcal: { type: 'number', description: 'Calorías totales' },
    p:    { type: 'number', description: 'Proteína en gramos' },
    c:    { type: 'number', description: 'Carbohidratos en gramos' },
    f:    { type: 'number', description: 'Grasa en gramos' },
  },
  required: ['kcal', 'p', 'c', 'f'],
  additionalProperties: false,
}

export async function POST(req: NextRequest) {
  let body: { text?: string }
  try { body = await req.json() } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const { text } = body
  if (!text?.trim()) {
    return NextResponse.json({ error: 'text required' }, { status: 400 })
  }

  if (!process.env.ANTHROPIC_API_KEY) {
    console.error('[nutrition/estimate] ANTHROPIC_API_KEY is not set')
    return NextResponse.json({ error: 'ANTHROPIC_API_KEY not configured' }, { status: 500 })
  }

  const client = new Anthropic()
  const model  = process.env.ANTHROPIC_MODEL ?? 'claude-sonnet-4-6'

  let rawText: string
  try {
    const response = await client.messages.create({
      model,
      max_tokens: 256,
      system: SYSTEM_PROMPT,
      output_config: { format: { type: 'json_schema', schema: SCHEMA } },
      messages: [{ role: 'user', content: text.trim() }],
    })

    const block = response.content.find(b => b.type === 'text')
    if (!block || block.type !== 'text') {
      console.error('[nutrition/estimate] No text block in response:', JSON.stringify(response.content))
      return NextResponse.json({ error: 'No text block in model response' }, { status: 500 })
    }
    rawText = block.text
  } catch (err) {
    console.error('[nutrition/estimate] Claude API error:', err)
    return NextResponse.json(
      { error: `Claude API error: ${err instanceof Error ? err.message : String(err)}` },
      { status: 502 }
    )
  }

  let parsed: { kcal: number; p: number; c: number; f: number }
  try {
    parsed = JSON.parse(rawText)
  } catch (err) {
    console.error('[nutrition/estimate] Failed to parse response JSON. Raw text:', rawText, 'Error:', err)
    return NextResponse.json(
      { error: `Failed to parse model response: ${rawText.slice(0, 200)}` },
      { status: 500 }
    )
  }

  return NextResponse.json({
    kcal: Math.round(parsed.kcal ?? 0),
    p:    Math.round(parsed.p    ?? 0),
    c:    Math.round(parsed.c    ?? 0),
    f:    Math.round(parsed.f    ?? 0),
  })
}
