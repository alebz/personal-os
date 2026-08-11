import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { createServerClient } from '@/lib/supabase'
import { runPosterImport } from '@/lib/posterImport'

export const runtime = 'nodejs'

// POST /api/publico/poster/import?days=14 — dispara el import (botón "importar ahora" del panel).
export async function POST(req: NextRequest) {
  const days = Number(req.nextUrl.searchParams.get('days')) || 14
  const r = await runPosterImport(days)
  if (!r.ok) return NextResponse.json({ error: r.error }, { status: r.status })
  return NextResponse.json(r)
}

// GET — estado del heartbeat para el panel (último import + error).
export async function GET() {
  const supabase = createServerClient()
  const { data } = await supabase.from('publico_poster_sync').select('last_success_at, last_import_date, last_error').eq('id', 'default').maybeSingle()
  return NextResponse.json(data ?? { last_success_at: null, last_import_date: null, last_error: null })
}
