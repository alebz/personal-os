import type { NextRequest } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import { createServerClient } from '@/lib/supabase'
import { SYNTHESIS_MODEL } from '@/lib/models'

export const runtime = 'nodejs'

// SUPRACONSCIENTE — genera un LOTE de líneas vivas para la cara de Cerebro. Proactivo (sin query):
// toma el contexto RECIENTE del usuario (memory_chunks: diario/notas/tareas/perfil), y en UNA llamada
// produce N líneas cortas y DISTINTAS, cada una un ángulo (conexión / recordatorio orgánico / patrón /
// eco del diario). Reusa la voz de Cerebro ya calibrada. Solo LEE — jamás escribe (regla dura de Cerebro).
// El cliente rota el lote client-side y regenera al agotarse (ver <Supraconsciente>).

// Voz de Cerebro (misma calibración que /api/ask): impersonal-descriptiva, cálida, texto plano.
const VOICE = [
  'Escribe como una mente constatando los hechos, no como asistente que reporta ni como voz que suplanta a Alex. Default a lo descriptivo e impersonal, con calidez; deja que un tono personal se cuele donde el contenido lo pida, sin forzar pronombres.',
  'Asume que Alex ya conoce a su gente, negocios y contexto — menciona nombres y lugares como quien ya los tiene presentes, sin explicar quién es quién.',
  'Texto plano: nada de markdown, negritas, títulos, comillas alrededor de la frase, ni listas.',
  'Usa ÚNICAMENTE la información del contexto. No cites fuentes ni números de referencia.',
  'Español.',
].join(' ')

const SUPRA_RULES = [
  'Cada mensaje es UNA sola línea, corta (idealmente < 120 caracteres), autocontenida.',
  'Tono NEUTRO-POSITIVO: acompaña, conecta, ilumina. NUNCA confrontes, regañes ni psicoanalices.',
  'Cada mensaje toma un ÁNGULO DISTINTO, aterrizado en el contexto real (nombres/fechas/eventos concretos):',
  '  · una conexión que Alex quizá no ha hecho (algo de hace tiempo con algo de ahora),',
  '  · un recordatorio orgánico (algo que dejó de mencionar / aparecer),',
  '  · una observación de patrón (cómo se repiten sus días/temas),',
  '  · un eco de su propio diario devuelto en el momento justo.',
  'Que NO suenen a plantilla ni a horóscopo genérico: la especificidad del contexto es lo que los hace suyos.',
  'Devuelve exactamente los mensajes pedidos, todos distintos entre sí.',
].join('\n')

// Voz de ALEX (mode 'yo') — el MENSAJE PERSONAL de MSN: lo que ÉL pone bajo su nombre para el mundo,
// en PRIMERA PERSONA, como si Alex mismo lo tecleara. NO le habla a Alex ni le aconseja: ES Alex hablando.
// Usa su contexto real como materia de lo que él declararía (su mood, en qué anda, qué trae en la cabeza).
const VOICE_YO = [
  'Escribe el MENSAJE PERSONAL de Alex: su estado de MSN, en PRIMERA PERSONA, como si Alex mismo lo hubiera tecleado bajo su nombre. Es lo que ÉL le dice al mundo — NO un mensaje dirigido a él, NO un consejo hacia él.',
  'El que habla ES Alex: su voz natural, casual, humana — un pensamiento, un ánimo, algo que trae en la cabeza, unas ganas, una queja ligera, un plan. Como los personal messages de MSN.',
  'Usa su contexto real (proyectos, personas, tareas, diario) como MATERIA de lo que él declararía, siempre como afirmación SUYA en primera persona.',
  'PROHIBIDO hablarle a Alex, usar su nombre, o dirigirte a él de "tú" ("oye Alex…", "tú deberías…", "la cafetera que tienes en la mira…"). El sujeto que habla es "yo" = Alex.',
  'Texto plano: nada de markdown, negritas, títulos, comillas alrededor de la frase. Un emoji ocasional al estilo MSN está bien.',
  'Español.',
].join(' ')

const YO_RULES = [
  'Cada mensaje es UNA sola línea corta (idealmente < 90 caracteres), como un personal message de MSN.',
  'PRIMERA PERSONA siempre: "hoy le entro a…", "ando…", "me late…", "tengo ganas de…", "pensando en…", "no me hallo sin…".',
  'Cada línea toma un ÁNGULO DISTINTO: en qué anda hoy, un mood, algo que trae entre manos (proyecto/tarea), unas ganas o antojo, un guiño a alguien de su gente, un pensamiento suelto.',
  'Aterrízalo en su contexto real (nombres/proyectos concretos) sin explicarlo — es SU status, ya sabe de qué habla.',
  'NADA de frases de taza ni horóscopo: que suene a algo que Alex realmente pondría de estado.',
  'Devuelve exactamente los mensajes pedidos, todos distintos entre sí.',
].join('\n')

export async function POST(req: NextRequest) {
  let body: { count?: number; exclude?: string[]; topics?: string[]; mode?: string }
  try { body = await req.json() } catch { return new Response('Invalid JSON', { status: 400 }) }

  const mode = body.mode === 'yo' ? 'yo' : 'supra'
  const count = Math.max(1, Math.min(10, body.count ?? 6))
  const exclude = Array.isArray(body.exclude) ? body.exclude.slice(0, 40) : []

  // Contexto por RECENCIA (sin query): los chunks más nuevos, con muestreo aleatorio para variar el
  // lote. memory_chunks cubre notas/diario/perfil/capturas (tareas incluidas).
  const supabase = createServerClient()
  const { data: rows, error } = await supabase
    .from('memory_chunks')
    .select('content, metadata, created_at')
    .order('created_at', { ascending: false })
    .limit(60)
  if (error) return new Response(error.message, { status: 500 })

  const recent = (rows ?? []) as { content: string; metadata: Record<string, unknown>; created_at: string }[]
  // El supra del arcade EXIGE contexto (constata su vida). El status en 1ª persona puede hablar sin él.
  if (recent.length === 0 && mode !== 'yo') return Response.json({ messages: [] })

  // Sesga a lo reciente pero baraja para que dos lotes seguidos no converjan.
  const pool = recent.slice(0, 45).sort(() => Math.random() - 0.5).slice(0, 30)
  const context = pool.map((c, i) => {
    const kind = String(c.metadata?.kind ?? 'nota')
    const date = c.created_at ? new Date(c.created_at).toLocaleDateString('es-MX', { day: 'numeric', month: 'short' }) : '?'
    return `[${i + 1}] [${kind} · ${date}]: ${c.content}`
  }).join('\n\n')

  const excludeBlock = exclude.length
    ? `\n\nNO repitas ni parafrasees estas líneas ya mostradas hoy:\n${exclude.map(e => `- ${e}`).join('\n')}`
    : ''

  const system = mode === 'yo' ? `${VOICE_YO}\n\n${YO_RULES}` : `${VOICE}\n\n${SUPRA_RULES}`
  const userMsg = mode === 'yo'
    ? (context
        ? `Tu vida ahora (Alex), como materia para TU propio estado — es lo que tú declararías, NO algo que alguien te dice:\n\n${context}${excludeBlock}\n\nComo Alex, en primera persona, escribe ${count} mensajes personales de MSN, todos distintos.`
        : `Sin contexto reciente; pon tu estado desde tu propio ánimo.${excludeBlock}\n\nComo Alex, en primera persona, escribe ${count} mensajes personales de MSN, todos distintos.`)
    : `Contexto reciente:\n\n${context}${excludeBlock}\n\nGenera ${count} mensajes del supraconsciente.`

  const anthropic = new Anthropic()
  let messages: string[] = []
  try {
    const res = await anthropic.messages.create({
      model: SYNTHESIS_MODEL,
      max_tokens: 1024,
      system,
      tools: [{
        name: 'supraconsciente',
        description: 'Emitir los mensajes del supraconsciente.',
        input_schema: {
          type: 'object',
          properties: { messages: { type: 'array', items: { type: 'string' }, minItems: count, maxItems: count } },
          required: ['messages'],
        },
      }],
      tool_choice: { type: 'tool', name: 'supraconsciente' },
      messages: [{ role: 'user', content: userMsg }],
    })
    const block = res.content.find(b => b.type === 'tool_use')
    if (block && block.type === 'tool_use') {
      const out = (block.input as { messages?: unknown }).messages
      if (Array.isArray(out)) messages = out.filter((m): m is string => typeof m === 'string' && m.trim().length > 0)
    }
  } catch (err) {
    return new Response(`Generation failed: ${String(err)}`, { status: 502 })
  }

  // El shape lleva topic: 'supra' (arcade) | 'nino' (mensaje personal de Cerebro Messenger).
  return Response.json({ messages: messages.map(text => ({ text: text.trim(), topic: mode })) })
}
