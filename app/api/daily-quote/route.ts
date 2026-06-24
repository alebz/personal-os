import { NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'

export const runtime = 'nodejs'

const SYSTEM_PROMPT = `Eres un oráculo astrológico para Leo. Alex es Leo (sol en Leo, signo fijo de fuego, regido por el Sol).

Genera una lectura diaria específica para la energía de Leo hoy — su fuego, su voluntad, su sombra o su luz. Habla directo, como un oráculo antiguo. Sin mencionar planetas ni tránsitos.

Formato obligatorio: máximo 2 oraciones muy cortas. Sin títulos, sin saludos, sin explicaciones. Solo la lectura. En español.`

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
    messages: [{ role: 'user', content: `Hoy es ${today}. Dame la lectura de Leo para hoy.` }],
  })

  const block = response.content.find((b) => b.type === 'text')
  if (!block || block.type !== 'text') {
    return NextResponse.json({ error: 'No text returned' }, { status: 500 })
  }

  return NextResponse.json({ quote: block.text.trim() })
}
