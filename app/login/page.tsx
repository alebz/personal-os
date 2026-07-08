'use client'

import { Suspense, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'

function LoginForm() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password }),
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

  return (
    <main className="flex min-h-dvh items-center justify-center p-6">
      <form
        onSubmit={onSubmit}
        className="w-full max-w-sm rounded-3xl border border-ink-4/10 bg-ink-1/70 p-8 shadow-2xl shadow-black/40 backdrop-blur-xl dashboard-card"
      >
        <div className="mb-7 text-center">
          <div className="mx-auto mb-4 grid h-12 w-12 place-items-center rounded-2xl border border-ink-4/10 bg-ink-0/40 text-2xl">🛰️</div>
          <h1 className="text-2xl font-bold tracking-tight text-ink-4">personal OS</h1>
          <p className="mt-1.5 text-sm text-ink-3">Introduce tu contraseña para entrar</p>
        </div>

        <input
          id="password"
          name="password"
          type="password"
          autoFocus
          autoComplete="current-password"
          placeholder="Contraseña"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="w-full rounded-xl border border-ink-4/15 bg-ink-0/50 px-4 py-3 text-sm text-ink-4 placeholder:text-ink-2/60 outline-none transition-colors focus:border-accent/50 focus:ring-1 focus:ring-accent/20"
        />

        {error && <p className="mt-2.5 text-center text-xs text-red-400">{error}</p>}

        <button
          type="submit"
          disabled={loading || !password}
          className="mt-5 w-full rounded-xl bg-accent px-4 py-3 text-sm font-semibold text-white transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40"
        >
          {loading ? 'Entrando…' : 'Entrar'}
        </button>
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
