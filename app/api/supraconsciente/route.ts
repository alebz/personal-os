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

// SANKALPA (mode 'sankalpa') — el MENSAJE PERSONAL de MSN como INTENCIÓN que Alex ELIGE para guiarse,
// en primera persona. NO es reporte de su vida ni recuento de pendientes: NO lee sus datos
// (tareas/notas/diario) — sale de su ser, no de su sistema. Es dirección, no reporte. NO es Cerebro.
const VOICE_SANKALPA = [
  'Escribes el SANKALPA de Alex: su mensaje personal, pero como una INTENCIÓN que él ELIGE para guiarse, en primera persona. No es reporte de lo que hizo ni de sus pendientes; es una dirección que se pone a sí mismo.',
  'PROHIBIDO usar datos de su vida (proyectos, personas, negocios, tareas, lugares, nombres). No sale de su sistema ni de su agenda: sale de su ser.',
  'Tono intencional e inspirador PERO ATERRIZADO, con el registro real de Alex (mexicano, cálido, sencillo, nada solemne ni etéreo); cabe una imagen linda ocasional, pero nunca etérea.',
  'Primera persona. VARÍA LA ESTRUCTURA: NO todas empiezan con "Hoy"; algunas sí, otras arrancan con el verbo o la imagen, otras ni marcan el día. Que en un lote no se repita el mismo arranque.',
  'Español. Texto plano, sin comillas, sin markdown, sin emojis.',
].join(' ')

const SANKALPA_RULES = [
  'Cada mensaje es UNA línea corta (idealmente < 82 caracteres).',
  'Es una INTENCIÓN/dirección, no un logro cumplido ni un recordatorio de tareas.',
  'REGLA DE ORO (lo que separa intención de póster): CADA sankalpa DEBE llevar O una IMAGEN CONCRETA (algo que se pueda ver o sentir: manos que se abren, un paso, los hombros que se sueltan, un respiro) O una VULNERABILIDAD ADMITIDA (aunque tiemble, aunque salga chueco, aunque no sepa, aunque adentro traiga tormenta). PROHIBIDA la nobleza abstracta sin cuerpo ("compañera fiel de mi jornada", "el ritmo de las cosas", "la luz de mi ser").',
  'Prohibidas las palabras de retiro espiritual: jornada, sendero, universo, esencia, ser interior.',
  'Evita el cliché de taza ("cree en ti", "todo es posible"). Que suene a algo que Alex de verdad se diría.',
  'Ángulos variados: presencia, valentía, ternura consigo mismo, enfoque, soltar, paciencia, paso firme.',
  'Devuelve exactamente los pedidos, todos distintos, con ARRANQUES distintos entre sí.',
].join('\n')

export async function POST(req: NextRequest) {
  let body: { count?: number; exclude?: string[]; topics?: string[]; mode?: string }
  try { body = await req.json() } catch { return new Response('Invalid JSON', { status: 400 }) }

  const mode = body.mode === 'sankalpa' ? 'sankalpa' : 'supra'
  const count = Math.max(1, Math.min(10, body.count ?? 6))
  const exclude = Array.isArray(body.exclude) ? body.exclude.slice(0, 40) : []
  const excludeBlock = exclude.length
    ? `\n\nNO repitas ni parafrasees estas líneas ya mostradas:\n${exclude.map(e => `- ${e}`).join('\n')}`
    : ''

  let system: string
  let userMsg: string
  if (mode === 'sankalpa') {
    // SANKALPA: intención pura, SIN RAG — jamás lee tareas/notas/diario. Sale de su ser, no del sistema.
    system = `${VOICE_SANKALPA}\n\n${SANKALPA_RULES}`
    userMsg = `Sin ningún contexto de su vida. Como Alex, en primera persona, escribe ${count} sankalpas (intenciones con imagen concreta o vulnerabilidad admitida), con arranques VARIADOS, todos distintos.${excludeBlock}`
  } else {
    // SUPRA (arcade): constata su vida real → EXIGE contexto por recencia (memory_chunks: notas/diario/
    // perfil/capturas). Muestreo aleatorio para que dos lotes seguidos no converjan.
    const supabase = createServerClient()
    const { data: rows, error } = await supabase
      .from('memory_chunks')
      .select('content, metadata, created_at')
      .order('created_at', { ascending: false })
      .limit(60)
    if (error) return new Response(error.message, { status: 500 })
    const recent = (rows ?? []) as { content: string; metadata: Record<string, unknown>; created_at: string }[]
    if (recent.length === 0) return Response.json({ messages: [] })
    const pool = recent.slice(0, 45).sort(() => Math.random() - 0.5).slice(0, 30)
    const context = pool.map((c, i) => {
      const kind = String(c.metadata?.kind ?? 'nota')
      const date = c.created_at ? new Date(c.created_at).toLocaleDateString('es-MX', { day: 'numeric', month: 'short' }) : '?'
      return `[${i + 1}] [${kind} · ${date}]: ${c.content}`
    }).join('\n\n')
    system = `${VOICE}\n\n${SUPRA_RULES}`
    userMsg = `Contexto reciente:\n\n${context}${excludeBlock}\n\nGenera ${count} mensajes del supraconsciente.`
  }

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
