import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { createServerClient } from '@/lib/supabase'
import { extractTicket } from '@/lib/ticketExtract'

export const runtime = 'nodejs'
export const maxDuration = 60   // la extracción con visión puede tardar ~15-20s

// POST /api/publico/ticket/extract  body: { imageBase64, mediaType } — la IA PROPONE un borrador (con los
// alias aprendidos ya aplicados). NO escribe ningún gasto ni scan: solo lee. El gasto se crea en /confirm.
export async function POST(req: NextRequest) {
  let b: { imageBase64?: string; mediaType?: string }
  try { b = await req.json() } catch { return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }) }
  if (!b.imageBase64) return NextResponse.json({ error: 'imageBase64 requerido' }, { status: 400 })

  const supabase = createServerClient()
  const r = await extractTicket(supabase, b.imageBase64, b.mediaType ?? 'image/jpeg')
  if (!r.ok) return NextResponse.json({ error: r.error }, { status: r.status })
  return NextResponse.json({ model: r.model, raw: r.raw, draft: r.draft })
}
