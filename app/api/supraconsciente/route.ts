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

// SANKALPA (mode 'sankalpa') — el MENSAJE PERSONAL de MSN entendido como en el YOGA NIDRA: una
// resolución breve que Alex sostiene como YA VERDADERA (primera persona, presente, afirmativa, digna).
// NO es reporte, consejo ni anécdota; NO lee sus datos (cero RAG) — es intención pura. NO es Cerebro.
const VOICE_SANKALPA = [
  'Escribes el SANKALPA de Alex: su mensaje personal, entendido como en el yoga nidra — una RESOLUCIÓN breve que él sostiene como YA VERDADERA. No es reporte, ni consejo, ni anécdota: es una intención declarada como hecho presente.',
  'Ejemplos de la forma correcta: "Estoy en el camino correcto", "Atraigo y soy abundancia", "Confío en mi intuición", "Habito mi cuerpo con calma", "Mi trabajo florece".',
  'Español. Texto plano, una línea cada uno, sin comillas, sin markdown, sin emojis, sin punto final.',
].join(' ')

const SANKALPA_RULES = [
  'FORMA — cada sankalpa cumple las CINCO reglas, sin excepción:',
  '1. Primera persona, tiempo PRESENTE, declarado como ya cierto. Nunca futuro ("voy a…"), nunca condicional, nunca imperativo ("cree…", "recuerda…").',
  '2. Afirmativo. Cero negaciones. La palabra "sin" está PROHIBIDA (di lo que SÍ es, no la ausencia de lo malo): "Mi creatividad fluye libre", nunca "sin límites"; "Estoy en calma", nunca "No me estreso".',
  '3. Breve: 3 a 8 palabras. UNA sola frase. Sin comas encadenadas, sin anécdota, sin explicación.',
  '4. Universal y atemporal: una verdad que sostengo, no algo de hoy. Nunca "Hoy…"; cero contexto de su día, tareas, proyectos, datos ni personas.',
  '5. Digno, no coloquial: sin slang, sin chiste, sin guiño. Es una intención, no un chat.',
  'PROHIBIDO: anécdotas u observaciones; consejos o imperativos dirigidos a él; cualquier "imagen concreta" o "vulnerabilidad admitida"; datos de su vida o sistema (cero RAG).',
  'TEMAS (rota entre ellos, no repitas en un lote): confianza/intuición, abundancia, calma/presencia, propósito y camino, apertura a recibir, fuerza, gratitud, creatividad, amor propio, salud.',
  'Devuelve exactamente los pedidos, todos distintos, con arranques variados entre sí.',
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
    userMsg = `Sin ningún contexto de su vida ni de su sistema. Como Alex, en primera persona, escribe ${count} sankalpas que cumplan las CINCO reglas de forma, con arranques VARIADOS, todos distintos.${excludeBlock}`
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

  // SANKALPA: red de seguridad server-side para las reglas MECÁNICAS de forma (el modelo resbala ~1/10,
  // p.ej. "sin límites"). Auto-quita el punto final y descarta las que violen: coma, negación/"sin", o
  // largo fuera de 3–8 palabras. Así JAMÁS llega una malformada a la UI (las reglas sutiles —presente,
  // digno— las cubre el prompt). Puede devolver <count; el caller rota/reabastece, no pasa nada.
  if (mode === 'sankalpa') {
    const badForm = (s: string) => /,/.test(s) || /\b(no|sin|nunca|jamás|tampoco)\b/i.test(s) || s.split(/\s+/).length < 3 || s.split(/\s+/).length > 8
    messages = messages.map(t => t.trim().replace(/[.]+$/, '')).filter(s => s.length > 0 && !badForm(s))
  }

  // El shape lleva topic: 'supra' (arcade) | 'nino' (mensaje personal de Cerebro Messenger).
  return Response.json({ messages: messages.map(text => ({ text: text.trim(), topic: mode })) })
}
