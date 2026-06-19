// Shared auth helpers. Uses the Web Crypto API (crypto.subtle) so the same code
// runs in both the Edge runtime (middleware) and the Node runtime (route handlers).

export const SESSION_COOKIE = 'session'

// Session lifetime: 30 days.
const SESSION_TTL_SECONDS = 60 * 60 * 24 * 30

function getSecret(): string {
  const secret = process.env.AUTH_SECRET
  if (!secret) {
    throw new Error('Missing AUTH_SECRET environment variable.')
  }
  return secret
}

// --- base64url helpers (no Buffer; Edge-safe) --------------------------------

function base64urlEncode(bytes: Uint8Array): string {
  let str = ''
  for (const b of bytes) str += String.fromCharCode(b)
  return btoa(str).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

function base64urlEncodeString(input: string): string {
  return base64urlEncode(new TextEncoder().encode(input))
}

// --- HMAC --------------------------------------------------------------------

async function importKey(secret: string): Promise<CryptoKey> {
  return crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  )
}

async function hmac(payload: string): Promise<string> {
  const key = await importKey(getSecret())
  const sig = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(payload))
  return base64urlEncode(new Uint8Array(sig))
}

// Constant-time string comparison.
function safeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false
  let diff = 0
  for (let i = 0; i < a.length; i++) {
    diff |= a.charCodeAt(i) ^ b.charCodeAt(i)
  }
  return diff === 0
}

// --- Session token: `<payload>.<signature>` ----------------------------------

/** Create a signed session token valid for SESSION_TTL_SECONDS. */
export async function createSessionToken(): Promise<string> {
  const now = Math.floor(Date.now() / 1000)
  const payload = base64urlEncodeString(
    JSON.stringify({ iat: now, exp: now + SESSION_TTL_SECONDS })
  )
  const sig = await hmac(payload)
  return `${payload}.${sig}`
}

/** Verify a session token's signature and expiry. */
export async function verifySessionToken(token: string | undefined): Promise<boolean> {
  if (!token) return false
  const dot = token.lastIndexOf('.')
  if (dot <= 0) return false

  const payload = token.slice(0, dot)
  const sig = token.slice(dot + 1)

  const expected = await hmac(payload)
  if (!safeEqual(sig, expected)) return false

  try {
    const decoded = JSON.parse(atob(payload.replace(/-/g, '+').replace(/_/g, '/')))
    if (typeof decoded.exp !== 'number') return false
    if (Math.floor(Date.now() / 1000) >= decoded.exp) return false
    return true
  } catch {
    return false
  }
}

/** Check the x-api-secret header for programmatic access. */
export function verifyApiSecret(headerValue: string | null | undefined): boolean {
  const expected = process.env.AUTH_SECRET
  if (!expected || !headerValue) return false
  return safeEqual(headerValue, expected)
}

export const SESSION_MAX_AGE = SESSION_TTL_SECONDS
