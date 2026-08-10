import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import { createServerClient } from '@/lib/supabase'

export const runtime = 'nodejs'

const anthropic = new Anthropic()

const BUFFER_KEEP = 16   // mensajes que se quedan verbatim (corto plazo)
const COMPRESS_AT = 22   // cuando el buffer pasa esto, comprimimos lo más viejo

type Msg = { role: 'user' | 'assistant'; content: string }
// La capa `facts` (largo plazo) se retiró: nunca acumuló nada y, con lolo_messages guardando todo
// permanente (F1), el registro durable ES la historia completa. Solo queda `summary` (mediano plazo:
// el arco de lo más viejo que ya no cabe en la ventana).
interface MemoryRow { buffer: Msg[]; summary: string }

async function loadMemory(): Promise<MemoryRow> {
  try {
    const supabase = createServerClient()
    const { data } = await supabase
      .from('lolo_memory')
      .select('buffer, summary')
      .eq('id', 'default')
      .maybeSingle()
    return {
      buffer:  Array.isArray(data?.buffer) ? (data!.buffer as Msg[]) : [],
      summary: typeof data?.summary === 'string' ? data!.summary : '',
    }
  } catch {
    return { buffer: [], summary: '' }
  }
}

async function saveMemory(mem: MemoryRow): Promise<void> {
  try {
    const supabase = createServerClient()
    await supabase.from('lolo_memory').upsert({
      id: 'default',
      buffer: mem.buffer,
      summary: mem.summary,
      updated_at: new Date().toISOString(),
    })
  } catch { /* ignore */ }
}

// F1 — memoria larga: archiva PERMANENTE cada mensaje nuevo en lolo_messages (append-only, con fecha,
// sin compresión) — nunca se pierde nada. Best-effort e independiente del buffer vivo: si esto falla, el
// chat no se rompe. AISLADO: SOLO Lolo — jamás se indexa a memory_chunks ni lo lee Cerebro.
async function archiveMessages(msgs: Msg[]): Promise<void> {
  if (!msgs.length) return
  try {
    const supabase = createServerClient()
    await supabase.from('lolo_messages').insert(msgs.map(m => ({ role: m.role, content: m.content })))
  } catch { /* ignore — el registro vivo no depende de esto */ }
}

// Funde los mensajes viejos en el resumen de mediano plazo (una llamada a Haiku). El verbatim NO se
// pierde: vive permanente en lolo_messages (F1); esto es solo el arco de lo que ya no cabe en la ventana.
async function compress(prevSummary: string, old: Msg[]): Promise<string> {
  const convo = old.map(m => `${m.role === 'user' ? 'Alex' : 'Lolo'}: ${m.content}`).join('\n')
  const prompt = `RESUMEN PREVIO (memoria de mediano plazo):
${prevSummary || '(vacío)'}

MENSAJES VIEJOS que salen de la memoria reciente (fúndelos):
${convo}

Devuelve SOLO el texto del resumen actualizado, sin markdown ni comillas. Funde los mensajes viejos en el resumen previo: conciso, tercera persona, en español, sobre la relación entre Alex y Lolo y lo que ha pasado. Si crece mucho, comprime y difumina lo más viejo o trivial, como la memoria humana. Máximo ~8 oraciones. No inventes nada que no esté en el material.`

  try {
    const msg = await anthropic.messages.create({
      model: process.env.ANTHROPIC_MODEL ?? 'claude-haiku-4-5-20251001',
      max_tokens: 1024,
      messages: [{ role: 'user', content: prompt }],
    })
    const raw = msg.content[0]?.type === 'text' ? msg.content[0].text.trim() : ''
    return raw ? raw.replace(/```/g, '').trim() : prevSummary
  } catch {
    // Si la compresión falla, no perdemos nada: conservamos lo previo
    return prevSummary
  }
}

// GET → carga la memoria (buffer reciente + resumen + hechos)
export async function GET() {
  const mem = await loadMemory()
  return NextResponse.json(mem)
}

const validMsgs = (arr: unknown): Msg[] =>
  Array.isArray(arr) ? arr.filter((m): m is Msg => !!m && (m.role === 'user' || m.role === 'assistant') && typeof m.content === 'string') : []

// POST { append } → AGREGA su delta al buffer actual (atómico server-side: dos voces —chat + heartbeat
// proactivo, o arcade↔XP— no se pisan; la memoria es la única fuente de verdad del hilo).
// POST { buffer } → (legacy) reemplaza el buffer completo. En ambos casos: si se desbordó, comprime.
export async function POST(req: NextRequest) {
  let body: { buffer?: Msg[]; append?: Msg[] }
  try { body = await req.json() } catch { return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }) }

  const current = await loadMemory()
  // Los mensajes NUEVOS de esta llamada = el delta append (la vía viva; el buffer-replace es legacy y no
  // trae deltas identificables, así que no se archiva por ahí). Se guardan permanentes antes de tocar el
  // buffer rodante — el archivo largo nunca depende de la compresión.
  const appended = Array.isArray(body.append) ? validMsgs(body.append) : []
  await archiveMessages(appended)

  let buffer  = Array.isArray(body.append) ? [...current.buffer, ...validMsgs(body.append)] : validMsgs(body.buffer)
  let summary = current.summary

  if (buffer.length > COMPRESS_AT) {
    const overflow = buffer.slice(0, buffer.length - BUFFER_KEEP)
    buffer = buffer.slice(-BUFFER_KEEP)
    summary = await compress(summary, overflow)
  }

  const mem = { buffer, summary }
  await saveMemory(mem)
  return NextResponse.json(mem)
}
