import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import OpenAI from 'openai'
import { embed } from '@/lib/openai'
import { createServerClient } from '@/lib/supabase'

export const runtime = 'nodejs'

const anthropic = new Anthropic()
const openai    = new OpenAI()

interface MemoryChunk  { content: string; metadata: Record<string, unknown> }
interface JournalEntry { entry_date: string; mood: string | null; content: string | null; summary: string | null }

async function searchBrain(query: string, limit = 5): Promise<MemoryChunk[]> {
  try {
    const embedding = await embed(query)
    const supabase  = createServerClient()
    const { data }  = await supabase.rpc('match_memory_chunks', {
      query_embedding: `[${embedding.join(',')}]`,
      match_count:     limit,
      match_threshold: 0.3,
    })
    return (data ?? []) as MemoryChunk[]
  } catch {
    return []
  }
}

async function recentJournal(limit = 5): Promise<JournalEntry[]> {
  try {
    const supabase = createServerClient()
    const { data } = await supabase
      .from('journal_entries')
      .select('entry_date, mood, content, summary')
      .order('created_at', { ascending: false })
      .limit(limit)
    return (data ?? []) as JournalEntry[]
  } catch {
    return []
  }
}

const MOOD_LABEL: Record<string, string> = {
  excelente: 'excelente 🌟', bien: 'bien 😊', regular: 'regular 😐',
  bajo: 'bajo 😔', caotico: 'caótico 🌪️',
}

function formatBrainContext(chunks: MemoryChunk[]): string {
  if (!chunks.length) return ''
  const lines = chunks.map((c, i) => {
    const kind = c.metadata?.kind ? `[${c.metadata.kind}] ` : ''
    return `${i + 1}. ${kind}${c.content}`
  })
  return '\n\nMEMORIAS RELEVANTES (brain del OS):\n' + lines.join('\n')
}

function formatJournalContext(entries: JournalEntry[]): string {
  if (!entries.length) return ''
  const lines = entries.map(e => {
    const mood = e.mood ? ` [mood: ${MOOD_LABEL[e.mood] ?? e.mood}]` : ''
    const body = e.content?.trim() || e.summary?.trim() || '(sin contenido)'
    return `${e.entry_date}${mood}: ${body}`
  })
  return '\n\nJOURNAL DE ALEX (entradas recientes):\n' + lines.join('\n')
}

export async function POST(req: NextRequest) {
  let body: { messages?: Array<{ role: string; content: string }>; system?: string; provider?: string }
  try { body = await req.json() } catch { return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }) }

  const { messages, system, provider = 'anthropic' } = body
  if (!messages?.length) return NextResponse.json({ error: 'messages required' }, { status: 400 })

  const lastUserMsg = [...messages].reverse().find(m => m.role === 'user')?.content ?? ''

  // Brain search and journal fetch run in parallel
  const [brainChunks, journalEntries] = await Promise.all([
    lastUserMsg ? searchBrain(lastUserMsg) : Promise.resolve([]),
    recentJournal(5),
  ])

  const fullSystem = (system ?? '') + formatJournalContext(journalEntries) + formatBrainContext(brainChunks)

  let text = ''

  if (provider === 'openai') {
    const sysMsg = fullSystem ? [{ role: 'system' as const, content: fullSystem }] : []
    const res = await openai.chat.completions.create({
      model: process.env.OPENAI_MODEL ?? 'gpt-4o-mini',
      max_tokens: 1024,
      messages: [...sysMsg, ...messages] as Array<{ role: 'user' | 'assistant' | 'system'; content: string }>,
    })
    text = res.choices[0]?.message?.content?.trim() ?? ''
  } else {
    const msg = await anthropic.messages.create({
      model: process.env.ANTHROPIC_MODEL ?? 'claude-haiku-4-5-20251001',
      max_tokens: 1024,
      ...(fullSystem ? { system: fullSystem } : {}),
      messages: messages as Array<{ role: 'user' | 'assistant'; content: string }>,
    })
    text = msg.content[0].type === 'text' ? msg.content[0].text.trim() : ''
  }

  return NextResponse.json({ text: text.replace(/^["']|["']$/g, '') })
}
