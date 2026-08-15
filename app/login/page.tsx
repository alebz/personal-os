'use client'

import { Suspense, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'

function LoginForm() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  async function submit(pw: string) {
    if (loading || !pw) return
    setError('')
    setLoading(true)
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password: pw }),
      })
      if (res.ok) {
        const next = searchParams.get('next') || '/'
        router.replace(next)
        router.refresh()
      } else {
        const data = await res.json().catch(() => ({}))
        setError(data.error || 'Contraseña incorrecta.')
        setLoading(false)
      }
    } catch {
      setError('Algo salió mal. Intenta de nuevo.')
      setLoading(false)
    }
  }

  function onSubmit(e: React.FormEvent) {
    e.preventDefault()
    void submit(password)
  }

  // El autofill de iOS (FaceID/Keychain) rellena la contraseña de GOLPE, no letra por letra: el input event
  // no trae inputType de tecleo ('insertText'/'deleteContentBackward'). Cuando detectamos ese relleno, enviamos
  // solo — así el flujo en móvil es abrir → FaceID → dentro, sin tener que enfocar el campo ni picar Enter.
  function onChange(e: React.ChangeEvent<HTMLInputElement>) {
    const val = e.target.value
    setPassword(val)
    const it = (e.nativeEvent as InputEvent).inputType
    if (val.length > 1 && it !== 'insertText' && it !== 'deleteContentBackward') {
      void submit(val)
    }
  }

  return (
    <main className="flex min-h-dvh items-center justify-center p-6">
      <form onSubmit={onSubmit} className="w-full max-w-xs">
        <input
          id="password"
          name="password"
          type="password"
          autoComplete="current-password"
          placeholder="Contraseña"
          enterKeyHint="go"
          value={password}
          onChange={onChange}
          disabled={loading}
          className="w-full rounded-card border border-border bg-surface-1 px-5 py-3.5 text-center text-body text-fg placeholder:text-fg-faint outline-none backdrop-blur-md transition-colors focus:border-border-strong focus:ring-1 focus:ring-border disabled:opacity-50"
        />
        <button
          type="submit"
          disabled={loading || !password}
          className="mt-3 w-full rounded-card border border-border bg-surface-1 px-5 py-3.5 text-body font-bold text-fg backdrop-blur-md transition-colors hover:border-border-strong disabled:opacity-40"
        >
          {loading ? 'Entrando…' : 'Entrar'}
        </button>
        {error && <p className="mt-3 text-center text-secondary text-red-400/90">{error}</p>}
      </form>
    </main>
  )
}

export default function LoginPage() {
  return (
    <Suspense>
      <LoginForm />
    </Suspense>
  )
}
