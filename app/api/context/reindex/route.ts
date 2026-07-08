import { NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase'
import { reindexContext } from '@/lib/contextIndex'

export const runtime = 'nodejs'
export const maxDuration = 300

// POST /api/context/reindex — force a full re-ingest of context/contexto-alex.md into the "perfil"
// RAG layer (delete all kind='perfil' chunks, re-insert per section/bullet). Idempotent. Normally you
// don't call this by hand — /api/context/sync auto-runs it when the doc changes.
export async function POST() {
  const supabase = createServerClient()
  const r = await reindexContext(supabase)
  if ('error' in r) return NextResponse.json({ error: r.error }, { status: r.error.includes('not found') ? 404 : 500 })
  return NextResponse.json({ ok: true, indexed: r.indexed, cleared: r.cleared })
}
