import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { SESSION_COOKIE, getSessionScope, verifyApiSecret } from '@/lib/auth'

// Paths that never require auth.
const PUBLIC_PATHS = [
  '/login',
  '/api/auth', // /api/auth/login, /api/auth/logout, /api/auth/captura (magic link de Andrés)
  '/api/webhooks', // inbound webhooks authenticate themselves
  '/api/telegram/webhook', // verified via x-telegram-bot-api-secret-token
  '/api/publico/poster/cron', // Vercel Cron: se autentica sola via Bearer $CRON_SECRET (Vercel no manda cookie ni x-api-secret). SOLO esta ruta exacta; /import y /status siguen detrás del middleware.
  '/api/publico/facturas/inbound', // Apps Script del Gmail de Público: self-auth via Bearer $FACTURA_INBOUND_SECRET.
  '/api/publico/clip/aviso', // Mismo Apps Script (avisos de movimientos de Clip): self-auth con el mismo Bearer.
]

// Lo ÚNICO que una sesión de scope 'captura' (Andrés) puede tocar — y CON QUÉ MÉTODO. Mínimo privilegio:
// una sesión de captura crea y lee, pero NUNCA destruye (los magic links se reenvían, los teléfonos se pierden).
// Por eso el gate es por (ruta, método), no solo por ruta. /api/auth va aparte: es público (logout no se gatea).
const CAPTURA_RULES: { prefix: string; methods: string[] }[] = [
  { prefix: '/captura',                    methods: ['GET'] },          // la app de captura (páginas)
  { prefix: '/api/publico/ticket',         methods: ['POST'] },         // upload-url · extract · confirm (crear)
  { prefix: '/api/publico/costo',          methods: ['POST'] },         // gasto a mano: CREAR, nunca borrar (DELETE fuera)
  { prefix: '/api/publico/poster/catalog', methods: ['GET'] },          // catálogo (lectura)
  { prefix: '/api/publico/proveedores',    methods: ['GET'] },          // autocompletar (lectura)
  { prefix: '/api/publico/dia',            methods: ['GET'] },          // lo del día (lectura)
  { prefix: '/api/publico/contenedores',   methods: ['GET', 'POST'] },  // corte de caja: leer saldos + cuadrar (crear snapshot, nunca borrar)
]

function isPublic(pathname: string): boolean {
  return PUBLIC_PATHS.some((p) => pathname === p || pathname.startsWith(p + '/'))
}
function isCapturaAllowed(pathname: string, method: string): boolean {
  return CAPTURA_RULES.some((r) => (pathname === r.prefix || pathname.startsWith(r.prefix + '/')) && r.methods.includes(method))
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
  const scope = await getSessionScope(token)
  if (scope) {
    // Sesión de CAPTURA (Andrés): fuera de su allowlist (ruta+método), se bloquea (API 403, página → /captura).
    if (scope === 'captura' && !isCapturaAllowed(pathname, req.method)) {
      if (pathname.startsWith('/api/')) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
      return NextResponse.redirect(new URL('/captura', req.url))
    }
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
  // Run on everything except Next internals and /public static assets. Without the file-extension
  // exclusion, auth would 307-redirect image/font requests (e.g. the sim sprites) to /login for
  // unauthenticated visitors — so they'd break on the login page.
  matcher: ['/((?!_next/static|_next/image|favicon.ico|.*\\.(?:png|jpg|jpeg|gif|svg|webp|avif|ico|woff2?|ttf|otf|mp3|mp4|webm)$).*)'],
}
