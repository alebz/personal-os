import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { createServerClient } from '@/lib/supabase'

export const runtime = 'nodejs'

// POST /api/publico/ticket/upload-url  body: { ext } → URL de subida FIRMADA para que el cliente suba la foto
// DIRECTO a Supabase Storage, sin pasar por el body de la función (evita el límite de 4.5 MB de Vercel → adiós
// al 413 con HEIC grande). La imagen entra a `drafts/…`; al confirmar se mueve a su carpeta por fecha, y las
// que nunca se confirman las barre el cron (huérfanas). El server luego la baja con service role.
export async function POST(req: NextRequest) {
  try {
    let b: { ext?: string }
    try { b = await req.json() } catch { b = {} }
    const ext = (b.ext ?? 'jpg').toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 5) || 'jpg'
    const supabase = createServerClient()
    await supabase.storage.createBucket('ticket-scans', { public: false }).catch(() => {})   // idempotente
    const path = `drafts/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`
    const { data, error } = await supabase.storage.from('ticket-scans').createSignedUploadUrl(path)
    if (error || !data) return NextResponse.json({ error: error?.message ?? 'no se pudo firmar la subida' }, { status: 500 })
    return NextResponse.json({ path: data.path, token: data.token, signedUrl: data.signedUrl })
  } catch (e) {
    return NextResponse.json({ error: `error inesperado: ${e instanceof Error ? e.message : String(e)}` }, { status: 500 })
  }
}
