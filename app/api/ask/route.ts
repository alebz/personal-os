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
      'Eres el asistente personal de Alex. Responde ÚNICAMENTE usando el contexto numerado que se te proporciona.',
      'Cita las fuentes usando el número entre corchetes, por ejemplo: [1] o [2, 4].',
      'Si el contexto no contiene suficiente información para responder con seguridad, dilo claramente.',
      'Responde en el mismo idioma que la pregunta. Sé conciso y directo.',
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
