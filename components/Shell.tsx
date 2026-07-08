'use client'

import { useEffect, useState, type ReactNode } from 'react'
import TopRail from '@/components/TopRail'

export default function Shell({ children }: { children: ReactNode }) {
  // The section content is fully client-interactive (portals to document.body, live sims, etc.), so
  // render it only after mount — never during SSR/prerender, where `document` doesn't exist.
  const [mounted, setMounted] = useState(false)
  useEffect(() => setMounted(true), [])

  return (
    <div className="relative min-h-dvh text-ink-4" style={{ background: 'transparent' }}>
      <TopRail />
      {mounted ? children : null}
    </div>
  )
}
