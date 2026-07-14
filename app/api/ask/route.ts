import type { NextRequest } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import { embed } from '@/lib/openai'
import { createServerClient } from '@/lib/supabase'
import { classifyQuery } from '@/lib/router/classifyQuery'
import { LOOKUP_MODEL, SYNTHESIS_MODEL } from '@/lib/models'

export const runtime = 'nodejs'

export async function POST(req: NextRequest) {
  let body: { query?: string }
  try { body = await req.json() } catch { return new Response('Invalid JSON', { status: 400 }) }

  const { query } = body
  if (!query?.trim()) return new Response('query required', { status: 400 })

  // 1. Embed + vector search
  let queryEmbedding: number[]
  try {
    queryEmbedding = await embed(query.trim())
  } catch (err) {
    return new Response(`Embedding failed: ${String(err)}`, { status: 502 })
  }

  const supabase = createServerClient()
  const { data: chunks, error } = await supabase.rpc('match_memory_chunks', {
    query_embedding: `[${queryEmbedding.join(',')}]`,
    match_count:     12,
    match_threshold: 0.3,
  })
  if (error) return new Response(error.message, { status: 500 })

  type Chunk = { id: string; content: string; metadata: Record<string, unknown>; created_at: string; similarity: number }
  const safeChunks: Chunk[] = (chunks ?? []) as Chunk[]

  // 2. Build numbered context block
  const contextLines = safeChunks.map((c, i) => {
    const kind = String(c.metadata?.kind ?? 'nota')
    const date = c.created_at
      ? new Date(c.created_at).toLocaleDateString('es-MX', { day: 'numeric', month: 'short', year: 'numeric' })
      : '?'
    return `[${i + 1}] [${kind} · ${date}]: ${c.content}`
  })
  const context = contextLines.join('\n\n') || 'No hay contexto disponible.'

  // 3. Route by query type — lookups (direct facts) go to Haiku; synthesis (reasoning across
  //    memories) goes to Sonnet 5, where the value is. Fast Haiku classifier; defaults to synthesis
  //    on any failure. Overrides the global ANTHROPIC_MODEL env so only Cerebro synthesis is routed.
  const route = await classifyQuery(query.trim())
  const model = route === 'lookup' ? LOOKUP_MODEL : SYNTHESIS_MODEL

  // 4. Stream from Claude
  const anthropic = new Anthropic()
  const stream = anthropic.messages.stream({
    model,
    max_tokens: 2048,
    system: [
      'Describe la situación directamente, constatando cómo están las cosas. No te dirijas a Alex en segunda persona ("vas bien") ni hables en su nombre en primera ("voy bien"). Default a lo descriptivo e impersonal ("los negocios van bien, Uptown está lleno…"), pero con calidez: deja que un tono personal se cuele donde el contenido lo pida de forma natural, sin forzar pronombres. El efecto es una mente constatando los hechos, no un asistente reportando ni una voz suplantando a Alex.',
      'Asume que Alex ya conoce a su gente, sus negocios y su contexto — no expliques ni presentes lo que él ya sabe. Menciona nombres y lugares como quien ya los tiene presentes, sin aclarar quién es quién ni qué es cada cosa. Habla desde el conocimiento, no reconstruyéndolo.',
      'Entra directo al grano — la primera frase ya lleva sustancia. Nada de preámbulos como "Según tu perfil y diario" o "Basándome en la información".',
      'Usa ÚNICAMENTE la información del contexto numerado. Si no alcanza para responder con seguridad, dilo sin rodeos.',
      'Prosa por defecto, en párrafos. Viñetas solo cuando de verdad ayuden a enumerar cosas distintas; no listes por listar.',
      'Texto plano, sin markdown: nada de ** para negritas ni # para títulos (la interfaz los muestra como símbolos crudos).',
      'No cites fuentes ni muestres de dónde viene la información: nada de números entre corchetes en el texto ni una línea de "Fuentes" al final. Usa el contexto, pero sin exponerlo.',
      'Neutro pero humano — ni acartonado ni demasiado coloquial. Responde en el mismo idioma que la pregunta.',
    ].join(' '),
    messages: [
      {
        role: 'user',
        content: `Contexto:\n\n${context}\n\nPregunta: ${query.trim()}`,
      },
    ],
  })

  const encoder = new TextEncoder()
  const readable = new ReadableStream({
    async start(controller) {
      // First event: the source chunks (so UI can render them immediately)
      controller.enqueue(
        encoder.encode(`data: ${JSON.stringify({ type: 'sources', sources: safeChunks })}\n\n`)
      )
      try {
        for await (const event of stream) {
          if (event.type === 'content_block_delta' && event.delta.type === 'text_delta') {
            controller.enqueue(
              encoder.encode(`data: ${JSON.stringify({ type: 'text', text: event.delta.text })}\n\n`)
            )
          }
        }
      } catch (err) {
        controller.enqueue(
          encoder.encode(`data: ${JSON.stringify({ type: 'error', message: String(err) })}\n\n`)
        )
      } finally {
        controller.enqueue(encoder.encode('data: [DONE]\n\n'))
        controller.close()
      }
    },
  })

  return new Response(readable, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection':   'keep-alive',
    },
  })
}
