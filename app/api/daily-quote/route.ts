import { NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'

export const runtime = 'nodejs'

const SYSTEM_PROMPT =
  'Eres el supraconsciente de Alex. Cada día generas un mensaje corto y poético para él — como una lectura del tarot o un susurro del universo. El mensaje debe sentirse personal, místico y sabio. Máximo 3 oraciones. Solo el mensaje, sin títulos ni explicaciones.'

export async function POST() {
  const client = new Anthropic()

  const today = new Date().toLocaleDateString('es-ES', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  })

  const response = await client.messages.create({
    model: process.env.ANTHROPIC_MODEL ?? 'claude-haiku-4-5-20251001',
    max_tokens: 256,
    system: SYSTEM_PROMPT,
    messages: [{ role: 'user', content: `Hoy es ${today}.` }],
  })

  const block = response.content.find((b) => b.type === 'text')
  if (!block || block.type !== 'text') {
    return NextResponse.json({ error: 'No text returned' }, { status: 500 })
  }

  return NextResponse.json({ quote: block.text.trim() })
}
