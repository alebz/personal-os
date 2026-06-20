import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'

export const runtime = 'nodejs'

const SYSTEM_PROMPT =
  'Eres un especialista en macronutrientes. Dado un alimento y un objetivo calórico, ' +
  'sugiere una distribución realista de proteína, carbohidratos y grasa. ' +
  'Los valores deben satisfacer: p×4 + c×4 + f×9 ≈ kcal_objetivo (±5%). ' +
  'Basa los ratios en el perfil nutricional típico del alimento. Usa números enteros. ' +
  'Responde solo con JSON válido, sin texto adicional.'

const SCHEMA = {
  type: 'object',
  properties: {
    p: { type: 'number', description: 'Proteína en gramos' },
    c: { type: 'number', description: 'Carbohidratos en gramos' },
    f: { type: 'number', description: 'Grasa en gramos' },
  },
  required: ['p', 'c', 'f'],
  additionalProperties: false,
}

export async function POST(req: NextRequest) {
  let body: { name?: string; kcal?: number }
  try { body = await req.json() } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const { name, kcal } = body
  if (!name?.trim() || !kcal || kcal <= 0) {
    return NextResponse.json({ error: 'name and kcal required' }, { status: 400 })
  }

  if (!process.env.ANTHROPIC_API_KEY) {
    console.error('[nutrition/redistribute] ANTHROPIC_API_KEY is not set')
    return NextResponse.json({ error: 'ANTHROPIC_API_KEY not configured' }, { status: 500 })
  }

  const client = new Anthropic()
  const model  = process.env.ANTHROPIC_MODEL ?? 'claude-sonnet-4-6'

  let rawText: string
  try {
    const response = await client.messages.create({
      model,
      max_tokens: 128,
      system: SYSTEM_PROMPT,
      output_config: { format: { type: 'json_schema', schema: SCHEMA } },
      messages: [{
        role:    'user',
        content: `Alimento: ${name.trim()}\nObjetivo calórico: ${kcal} kcal`,
      }],
    })

    const block = response.content.find(b => b.type === 'text')
    if (!block || block.type !== 'text') {
      console.error('[nutrition/redistribute] No text block in response:', JSON.stringify(response.content))
      return NextResponse.json({ error: 'No text block in model response' }, { status: 500 })
    }
    rawText = block.text
  } catch (err) {
    console.error('[nutrition/redistribute] Claude API error:', err)
    return NextResponse.json(
      { error: `Claude API error: ${err instanceof Error ? err.message : String(err)}` },
      { status: 502 }
    )
  }

  let parsed: { p: number; c: number; f: number }
  try {
    parsed = JSON.parse(rawText)
  } catch (err) {
    console.error('[nutrition/redistribute] Failed to parse response JSON. Raw text:', rawText, 'Error:', err)
    return NextResponse.json(
      { error: `Failed to parse model response: ${rawText.slice(0, 200)}` },
      { status: 500 }
    )
  }

  return NextResponse.json({
    p: Math.round(parsed.p ?? 0),
    c: Math.round(parsed.c ?? 0),
    f: Math.round(parsed.f ?? 0),
  })
}
