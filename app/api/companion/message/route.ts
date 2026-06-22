import { NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'

export const runtime = 'nodejs'

const client = new Anthropic()

function getTimeContext(): string {
  const h = new Date().getHours()
  if (h >= 5 && h < 12) return 'mañana'
  if (h >= 12 && h < 18) return 'tarde'
  if (h >= 18 && h < 22) return 'noche'
  return 'madrugada'
}

export async function POST() {
  const time = getTimeContext()

  const msg = await client.messages.create({
    model: process.env.ANTHROPIC_MODEL ?? 'claude-haiku-4-5-20251001',
    max_tokens: 80,
    system:
      'Eres Adán, el companion personal de Alex. Hablas directo, con personalidad y un poco de humor. Máximo una oración. Sin emojis. En español.',
    messages: [
      {
        role: 'user',
        content: `Es de ${time}. Dale a Alex un mensaje corto y directo. Una sola oración.`,
      },
    ],
  })

  const text =
    msg.content[0].type === 'text' ? msg.content[0].text.trim() : '...'

  return NextResponse.json({ message: text })
}
