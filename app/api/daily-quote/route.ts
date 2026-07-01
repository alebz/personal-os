import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'

export const runtime = 'nodejs'

const ORACLE_SYSTEM = `Eres un oráculo sin nombre ni origen. Generas mensajes que se sienten como pequeñas señales del cosmos — coincidencias significativas. Puedes inspirarte en la fase lunar aproximada según la fecha, el simbolismo astrológico del día de la semana, el bloque horario del día, patrones y números matemáticos del momento, efemérides astronómicas o históricas de esta fecha, arquetipos del tarot, proporciones áureas, geometría sagrada. Nunca menciones explícitamente de dónde viene la inspiración. El mensaje debe sentirse como algo que el consultante necesitaba escuchar hoy. Máximo 2-3 oraciones en español. Sin títulos ni saludos.`

const EXPAND_SYSTEM = `Eres un oráculo sin nombre. Un consultante recibió una señal y quiere profundizar. Expande la lectura: qué corrientes subyacen, qué sugiere para las próximas horas o días, qué contemplación o acción invita a hacer. Sin mencionar el origen de la señal ni citar el texto original. 3-4 oraciones en español. Sin títulos.`

export async function POST(req: NextRequest) {
  let body: { date?: string; dayOfWeek?: string; hourBlock?: string; expand?: string } = {}
  try { body = await req.json() } catch {}

  const client = new Anthropic()
  const model  = process.env.ANTHROPIC_MODEL ?? 'claude-haiku-4-5-20251001'

  if (body.expand) {
    const response = await client.messages.create({
      model,
      max_tokens: 200,
      system: EXPAND_SYSTEM,
      messages: [{
        role: 'user',
        content: `Señal recibida: "${body.expand}". Fecha: ${body.date ?? 'desconocida'}. Hora del día: ${body.hourBlock ?? 'desconocida'}. Expande la lectura.`,
      }],
    })
    const block = response.content.find(b => b.type === 'text')
    if (!block || block.type !== 'text') {
      return NextResponse.json({ error: 'No text returned' }, { status: 500 })
    }
    return NextResponse.json({ quote: block.text.trim() })
  }

  const response = await client.messages.create({
    model,
    max_tokens: 150,
    system: ORACLE_SYSTEM,
    messages: [{
      role: 'user',
      content: `Fecha: ${body.date ?? new Date().toLocaleDateString('en-CA')}. Día: ${body.dayOfWeek ?? ''}. Hora del día: ${body.hourBlock ?? 'morning'}.`,
    }],
  })

  const block = response.content.find(b => b.type === 'text')
  if (!block || block.type !== 'text') {
    return NextResponse.json({ error: 'No text returned' }, { status: 500 })
  }

  return NextResponse.json({ quote: block.text.trim() })
}
