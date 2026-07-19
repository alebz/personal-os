import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import { createServerClient } from '@/lib/supabase'

export const runtime = 'nodejs'

const anthropic = new Anthropic()

const BUFFER_KEEP = 16   // mensajes que se quedan verbatim (corto plazo)
const COMPRESS_AT = 22   // cuando el buffer pasa esto, comprimimos lo más viejo

type Msg = { role: 'user' | 'assistant'; content: string }
interface MemoryRow { buffer: Msg[]; summary: string; facts: string }

async function loadMemory(): Promise<MemoryRow> {
  try {
    const supabase = createServerClient()
    const { data } = await supabase
      .from('lolo_memory')
      .select('buffer, summary, facts')
      .eq('id', 'default')
      .maybeSingle()
    return {
      buffer:  Array.isArray(data?.buffer) ? (data!.buffer as Msg[]) : [],
      summary: typeof data?.summary === 'string' ? data!.summary : '',
      facts:   typeof data?.facts   === 'string' ? data!.facts   : '',
    }
  } catch {
    return { buffer: [], summary: '', facts: '' }
  }
}

async function saveMemory(mem: MemoryRow): Promise<void> {
  try {
    const supabase = createServerClient()
    await supabase.from('lolo_memory').upsert({
      id: 'default',
      buffer: mem.buffer,
      summary: mem.summary,
      facts: mem.facts,
      updated_at: new Date().toISOString(),
    })
  } catch { /* ignore */ }
}

// Funde los mensajes viejos en el resumen y extrae hechos durables (una llamada a Haiku)
async function compress(prevSummary: string, prevFacts: string, old: Msg[]): Promise<{ summary: string; facts: string }> {
  const convo = old.map(m => `${m.role === 'user' ? 'Alex' : 'Lolo'}: ${m.content}`).join('\n')
  const prompt = `RESUMEN PREVIO (memoria de mediano plazo):
${prevSummary || '(vacío)'}

HECHOS IMPORTANTES PREVIOS (memoria de largo plazo):
${prevFacts || '(vacío)'}

MENSAJES VIEJOS que salen de la memoria reciente (fúndelos):
${convo}

Devuelve SOLO un objeto JSON, sin markdown ni texto extra, con dos campos:
- "summary": funde los mensajes viejos en el resumen previo. Conciso, tercera persona, en español, sobre la relación entre Alex y Lolo y lo que ha pasado. Si el resumen crece mucho, comprime y difumina lo más viejo o trivial, como la memoria humana. Máximo ~8 oraciones.
- "facts": toma los hechos previos y agrega SOLO cosas durables e importantes que aparezcan (decisiones, proyectos en curso, preferencias, personas, compromisos). Nada trivial ni efímero. Bullets cortos con "-". No repitas lo que ya está.

No inventes nada que no esté en el material.`

  try {
    const msg = await anthropic.messages.create({
      model: process.env.ANTHROPIC_MODEL ?? 'claude-haiku-4-5-20251001',
      max_tokens: 1024,
      messages: [{ role: 'user', content: prompt }],
    })
    const raw = msg.content[0]?.type === 'text' ? msg.content[0].text.trim() : ''
    const clean = raw.replace(/```json|```/g, '').trim()
    const parsed = JSON.parse(clean)
    return {
      summary: typeof parsed.summary === 'string' ? parsed.summary : prevSummary,
      facts:   typeof parsed.facts   === 'string' ? parsed.facts   : prevFacts,
    }
  } catch {
    // Si la compresión falla, no perdemos nada: conservamos lo previo
    return { summary: prevSummary, facts: prevFacts }
  }
}

// GET → carga la memoria (buffer reciente + resumen + hechos)
export async function GET() {
  const mem = await loadMemory()
  return NextResponse.json(mem)
}

// POST { buffer } → guarda el buffer; si se desbordó, comprime lo viejo al resumen/hechos
export async function POST(req: NextRequest) {
  let body: { buffer?: Msg[] }
  try { body = await req.json() } catch { return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }) }

  const incoming = Array.isArray(body.buffer)
    ? body.buffer.filter(m => m && (m.role === 'user' || m.role === 'assistant') && typeof m.content === 'string')
    : []

  const current = await loadMemory()
  let buffer  = incoming
  let summary = current.summary
  let facts   = current.facts

  if (buffer.length > COMPRESS_AT) {
    const overflow = buffer.slice(0, buffer.length - BUFFER_KEEP)
    buffer = buffer.slice(-BUFFER_KEEP)
    const compressed = await compress(summary, facts, overflow)
    summary = compressed.summary
    facts   = compressed.facts
  }

  const mem = { buffer, summary, facts }
  await saveMemory(mem)
  return NextResponse.json(mem)
}
