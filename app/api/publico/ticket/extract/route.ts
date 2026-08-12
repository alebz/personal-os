import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { createServerClient } from '@/lib/supabase'
import { extractTicket } from '@/lib/ticketExtract'

export const runtime = 'nodejs'
export const maxDuration = 60   // la extracción con visión puede tardar ~15-20s

// POST /api/publico/ticket/extract  body: { imageBase64, mediaType } — la IA PROPONE un borrador (con los
// alias aprendidos ya aplicados). NO escribe ningún gasto ni scan: solo lee. El gasto se crea en /confirm.
export async function POST(req: NextRequest) {
  // TODO el handler va en try/catch: pase lo que pase, la ruta responde JSON legible, nunca body vacío (#5).
  try {
    let b: { imageBase64?: string; mediaType?: string; storagePath?: string }
    try { b = await req.json() } catch { return NextResponse.json({ error: 'Cuerpo inválido (¿imagen demasiado grande? el límite de subida es ~4.5 MB)' }, { status: 400 }) }
    const supabase = createServerClient()

    // Vía nueva (sin límite): la foto ya está en Storage; la bajamos con service role y la convertimos aquí.
    // HEIC incluido — no depende de que el navegador la sepa decodificar. Vía vieja (base64) sigue como fallback.
    let imageBase64 = b.imageBase64
    let mediaType = b.mediaType ?? 'image/jpeg'
    if (b.storagePath) {
      const { data, error } = await supabase.storage.from('ticket-scans').download(b.storagePath)
      if (error || !data) return NextResponse.json({ error: `no se pudo leer la imagen subida: ${error?.message ?? 'no encontrada'}` }, { status: 400 })
      imageBase64 = Buffer.from(await data.arrayBuffer()).toString('base64')
      mediaType = data.type || mediaType
    }
    if (!imageBase64) return NextResponse.json({ error: 'falta la imagen (storagePath o imageBase64)' }, { status: 400 })

    const r = await extractTicket(supabase, imageBase64, mediaType)
    if (!r.ok) return NextResponse.json({ error: r.error }, { status: r.status })
    return NextResponse.json({ model: r.model, raw: r.raw, draft: r.draft, aliasWarning: r.aliasWarning })
  } catch (e) {
    return NextResponse.json({ error: `Error inesperado en la extracción: ${e instanceof Error ? e.message : String(e)}` }, { status: 500 })
  }
}
