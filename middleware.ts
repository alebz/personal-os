import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { SESSION_COOKIE, verifySessionToken, verifyApiSecret } from '@/lib/auth'

// Paths that never require auth.
const PUBLIC_PATHS = [
  '/login',
  '/api/auth', // /api/auth/login, /api/auth/logout
  '/api/webhooks', // inbound webhooks authenticate themselves
  '/api/telegram/webhook', // verified via x-telegram-bot-api-secret-token
]

function isPublic(pathname: string): boolean {
  return PUBLIC_PATHS.some(
    (p) => pathname === p || pathname.startsWith(p + '/')
  )
}

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl

  if (isPublic(pathname)) {
    return NextResponse.next()
  }

  // Programmatic access: API routes accept a shared secret header.
  if (pathname.startsWith('/api/')) {
    if (verifyApiSecret(req.headers.get('x-api-secret'))) {
      return NextResponse.next()
    }
  }

  // Cookie-based session for everything else.
  const token = req.cookies.get(SESSION_COOKIE)?.value
  if (await verifySessionToken(token)) {
    return NextResponse.next()
  }

  // Unauthenticated: 401 for API, redirect to /login for pages.
  if (pathname.startsWith('/api/')) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const loginUrl = req.nextUrl.clone()
  loginUrl.pathname = '/login'
  loginUrl.search = ''
  if (pathname !== '/') {
    loginUrl.searchParams.set('next', pathname)
  }
  return NextResponse.redirect(loginUrl)
}

export const config = {
  // Run on everything except Next internals and static assets.
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
}
