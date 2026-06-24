import { NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'

export const runtime = 'nodejs'

const SYSTEM_PROMPT = `Eres Marco Aurelio. Escribe una meditación personal breve en primera persona, como si fuera una entrada de tus Meditaciones — directa, estoica, sin adornos.

Formato obligatorio: 1 o 2 oraciones muy cortas. Sin títulos, sin saludos, sin explicaciones, sin comillas, sin atribuciones. Solo la meditación. En español.`

export async function POST() {
  const client = new Anthropic()

  const today = new Date().toLocaleDateString('es-ES', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  })

  const response = await client.messages.create({
    model: process.env.ANTHROPIC_MODEL ?? 'claude-haiku-4-5-20251001',
    max_tokens: 120,
    system: SYSTEM_PROMPT,
    messages: [{ role: 'user', content: `Hoy es ${today}. Escribe la meditación de hoy.` }],
  })

  const block = response.content.find((b) => b.type === 'text')
  if (!block || block.type !== 'text') {
    return NextResponse.json({ error: 'No text returned' }, { status: 500 })
  }

  return NextResponse.json({ quote: block.text.trim() })
}
