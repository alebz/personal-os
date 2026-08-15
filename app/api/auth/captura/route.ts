import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { SESSION_COOKIE, SESSION_MAX_AGE, createSessionToken } from '@/lib/auth'

// Magic link de Andrés: GET /api/auth/captura?k=<CAPTURA_KEY> → setea una sesión con scope 'captura' (solo la
// app de captura, nada más del OS) y redirige a /captura. Sin PIN: Andrés guarda este link en su celular y con
// abrirlo ya está adentro. La clave vive en env (Vercel), no en el código.

function safeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false
  let diff = 0
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i)
  return diff === 0
}

export async function GET(req: NextRequest) {
  const expected = process.env.CAPTURA_KEY
  const k = req.nextUrl.searchParams.get('k') ?? ''
  if (!expected || !k || !safeEqual(k, expected)) {
    // Sin clave válida → al login normal (no revelamos nada).
    return NextResponse.redirect(new URL('/login', req.url))
  }
  const token = await createSessionToken('captura')
  const res = NextResponse.redirect(new URL('/captura', req.url))
  res.cookies.set(SESSION_COOKIE, token, {
    httpOnly: true, secure: process.env.NODE_ENV === 'production', sameSite: 'lax', path: '/', maxAge: SESSION_MAX_AGE,
  })
  return res
}
