import Anthropic from '@anthropic-ai/sdk'
import { CLASSIFIER_MODEL } from '@/lib/models'

// Fast query router for Cerebro: decides whether a query is a LOOKUP (direct fact, retrieval does
// the work) or SÍNTESIS (reasoning across memories). Mirrors the structured-output shape of
// lib/router/classifyCapture.ts (Claude tier), but runs on Haiku and OMITS `effort` — effort isn't
// supported on Haiku 4.5. Any failure or unexpected value defaults to 'synthesis' (fail toward the
// stronger model — never silently downgrade a synthesis query to a lookup answer).

export type QueryRoute = 'lookup' | 'synthesis'

const SYSTEM_PROMPT = `Clasificas una consulta a un "segundo cerebro" personal en dos rutas. Responde solo con la ruta.

- "lookup": el usuario pide un dato puntual y recuperable directamente — un número, fecha, nombre, hora, dirección. Ejemplos: "cuándo es la junta con Andrés", "teléfono de X", "cuál es la contraseña del wifi", "a qué hora es el masaje".
- "synthesis": el usuario pide razonamiento, relaciones, patrones o una respuesta compuesta a partir de varias piezas. Ejemplos: "qué he pensado sobre X", "cómo se relacionan Y y Z", "qué patrones ves en mi diario", "resume mi relación con Andrés".

Ante la duda, elige "synthesis".`

const JSON_SCHEMA = {
  type: 'object',
  properties: {
    route: { type: 'string', enum: ['lookup', 'synthesis'] },
  },
  required: ['route'],
  additionalProperties: false,
} as const

export async function classifyQuery(query: string): Promise<QueryRoute> {
  if (!process.env.ANTHROPIC_API_KEY) return 'synthesis'   // no key → don't block; use the stronger path
  try {
    const client = new Anthropic()
    const response = await client.messages.create({
      model: CLASSIFIER_MODEL,
      max_tokens: 16,
      system: SYSTEM_PROMPT,
      output_config: { format: { type: 'json_schema', schema: JSON_SCHEMA } },   // no `effort`: unsupported on Haiku 4.5
      messages: [{ role: 'user', content: query }],
    })
    const block = response.content.find((b) => b.type === 'text')
    if (!block || block.type !== 'text') return 'synthesis'
    const route = JSON.parse(block.text)?.route
    return route === 'lookup' ? 'lookup' : 'synthesis'
  } catch {
    return 'synthesis'   // fail toward quality
  }
}
