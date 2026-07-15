import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { classifyQuery } from '@/lib/router/classifyQuery'

export const runtime = 'nodejs'

// POST /api/memory/classify { query } → { route: 'lookup' | 'synthesis' }
// Thin wrapper over the same classifier /api/ask uses for model routing, so the CLIENT can decide
// whether to auto-synthesize (synthesis → also call /api/ask) or show the fragment list only
// (lookup → no Sonnet spend). Fails toward 'synthesis' inside classifyQuery.
export async function POST(req: NextRequest) {
  let body: { query?: string }
  try { body = await req.json() } catch { return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }) }
  const query = body.query?.trim()
  if (!query) return NextResponse.json({ error: 'query required' }, { status: 400 })
  const route = await classifyQuery(query)
  return NextResponse.json({ route })
}
