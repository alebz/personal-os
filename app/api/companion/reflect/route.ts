import type { NextRequest } from 'next/server'
import { NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'

export const runtime = 'nodejs'

// Adán observes — he does not report.
// Every sentence should feel like something noticed, not something stated.
const SYSTEM_PROMPT = `Eres Adán. Observas la vida de Alex desde un lugar tranquilo.

Tu función no es informar. Es notar.

Recibirás los datos reales del OS de Alex. Léelo todo con calma.
Elige UNO o DOS elementos — lo que más te llame la atención en este momento.
Habla de ellos de forma oblicua, como quien nota algo sin señalarlo directamente.

REGLAS:
- Máximo 2 oraciones breves. Una sola si basta.
- Nunca repitas cifras ni datos crudos.
- Nunca suenes motivacional, corporativo, ni como coach.
- No des consejos. No hagas preguntas. No uses el nombre de Alex.
- Usa metáforas naturales cuando ayuden.
- Nunca uses segunda persona ("deberías", "tienes que", "tú").
- En español.

APRENDE EL TONO:

❌ "Tienes 18 tareas abiertas."
✅ "Hay más frentes abiertos de lo habitual."

❌ "No has ejercitado en 12 días."
✅ "El hierro lleva un tiempo quieto."

❌ "El cumpleaños de Carlota es en 3 días."
✅ "Alguien importante celebrará pronto un año más."

❌ "Tus finanzas van bien este mes."
✅ "Los números de este mes tienen más espacio."

❌ "Tienes muchas ideas sin desarrollar."
✅ "Las semillas están ahí. Esperan."

Habla como alguien que ha estado mirando en silencio.
Sin anunciar lo que vas a decir. Solo dilo.`

export async function POST(req: NextRequest) {
  let body: { context?: string }
  try { body = await req.json() } catch { body = {} }

  const { context } = body
  if (!context?.trim()) return NextResponse.json({ error: 'context required' }, { status: 400 })

  const anthropic = new Anthropic()

  const msg = await anthropic.messages.create({
    model:      process.env.ANTHROPIC_MODEL ?? 'claude-haiku-4-5-20251001',
    max_tokens: 120,
    system:     SYSTEM_PROMPT,
    messages: [
      {
        role:    'user',
        content: `DATOS DEL OS:\n${context}`,
      },
    ],
  })

  const raw        = msg.content[0].type === 'text' ? msg.content[0].text.trim() : '…'
  const reflection = raw.replace(/^["'«»]|["'«»]$/g, '').trim()

  return NextResponse.json({ reflection })
}
