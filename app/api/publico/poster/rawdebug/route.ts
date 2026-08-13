import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

export const runtime = 'nodejs'

// TEMPORAL (borrar): dumpea la respuesta cruda de dash.getPaymentsReport para un día, para inspeccionar
// TODOS los campos (¿trae propina? ¿payed_card la incluye?). GET ?date=2026-08-09
export async function GET(req: NextRequest) {
  const token = process.env.POSTER_TOKEN
  if (!token) return NextResponse.json({ error: 'sin token' }, { status: 400 })
  const date = (req.nextUrl.searchParams.get('date') ?? '2026-08-09').replace(/-/g, '')
  const url = `https://joinposter.com/api/dash.getPaymentsReport?format=json&token=${encodeURIComponent(token)}&date_from=${date}&date_to=${date}`
  const data = await fetch(url, { cache: 'no-store' }).then(r => r.json()).catch((e) => ({ fetchError: String(e) }))
  return NextResponse.json(data)
}
