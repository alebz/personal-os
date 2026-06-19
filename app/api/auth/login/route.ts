import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import {
  SESSION_COOKIE,
  SESSION_MAX_AGE,
  createSessionToken,
} from '@/lib/auth'

// Constant-time string comparison to avoid leaking the password via timing.
function safeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false
  let diff = 0
  for (let i = 0; i < a.length; i++) {
    diff |= a.charCodeAt(i) ^ b.charCodeAt(i)
  }
  return diff === 0
}

export async function POST(req: NextRequest) {
  const expected = process.env.DASHBOARD_PASSWORD
  if (!expected) {
    return NextResponse.json(
      { error: 'Server is not configured for auth.' },
      { status: 500 }
    )
  }

  let password = ''
  try {
    const body = await req.json()
    password = typeof body?.password === 'string' ? body.password : ''
  } catch {
    return NextResponse.json({ error: 'Invalid request body.' }, { status: 400 })
  }

  if (!password || !safeEqual(password, expected)) {
    return NextResponse.json({ error: 'Incorrect password.' }, { status: 401 })
  }

  const token = await createSessionToken()
  const res = NextResponse.json({ ok: true })
  res.cookies.set(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: SESSION_MAX_AGE,
  })
  return res
}
