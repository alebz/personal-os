import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import OpenAI from 'openai'

export const runtime = 'nodejs'

const anthropic = new Anthropic()
const openai    = new OpenAI()

export async function POST(req: NextRequest) {
  let body: { messages?: Array<{ role: string; content: string }>; provider?: string }
  try { body = await req.json() } catch { return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }) }

  const { messages, provider = 'anthropic' } = body
  if (!messages?.length) return NextResponse.json({ error: 'messages required' }, { status: 400 })

  let text = ''

  if (provider === 'openai') {
    const res = await openai.chat.completions.create({
      model: process.env.OPENAI_MODEL ?? 'gpt-4o-mini',
      max_tokens: 150,
      messages: messages as Array<{ role: 'user' | 'assistant' | 'system'; content: string }>,
    })
    text = res.choices[0]?.message?.content?.trim() ?? ''
  } else {
    const msg = await anthropic.messages.create({
      model: process.env.ANTHROPIC_MODEL ?? 'claude-haiku-4-5-20251001',
      max_tokens: 150,
      messages: messages as Array<{ role: 'user' | 'assistant'; content: string }>,
    })
    text = msg.content[0].type === 'text' ? msg.content[0].text.trim() : ''
  }

  return NextResponse.json({ text: text.replace(/^["']|["']$/g, '') })
}
