import { NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase'
import { readContextDoc, indexedContextHash, reindexContext } from '@/lib/contextIndex'

export const runtime = 'nodejs'
export const maxDuration = 300

// POST /api/context/sync — cheap idempotent guard. Compares the doc's content hash to what's indexed;
// re-ingests ONLY if it changed (or nothing is indexed yet). The client fires this on load, so the
// "perfil" layer stays fresh automatically — no manual reindex, and no embed cost when unchanged.
export async function POST() {
  const supabase = createServerClient()

  const doc = await readContextDoc()
  if (!doc) return NextResponse.json({ ok: false, error: 'context/contexto-alex.md not found' }, { status: 404 })

  const current = await indexedContextHash(supabase)
  if (current === doc.hash) return NextResponse.json({ ok: true, upToDate: true })

  const r = await reindexContext(supabase)
  if ('error' in r) return NextResponse.json({ ok: false, error: r.error }, { status: 500 })
  return NextResponse.json({ ok: true, reindexed: true, indexed: r.indexed, cleared: r.cleared })
}
