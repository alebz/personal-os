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
      <form onSubmit={onSubmit} className="w-full max-w-xs">
        <input
          id="password"
          name="password"
          type="password"
          autoComplete="current-password"
          placeholder="Contraseña"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          disabled={loading}
          className="w-full rounded-card border border-border bg-surface-1 px-5 py-3.5 text-center text-body text-fg placeholder:text-fg-faint outline-none backdrop-blur-md transition-colors focus:border-border-strong focus:ring-1 focus:ring-border disabled:opacity-50"
        />
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
