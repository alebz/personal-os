'use client'

import type { ReactNode } from 'react'
import TopRail from '@/components/TopRail'

export default function Shell({ children }: { children: ReactNode }) {
  return (
    <div className="relative min-h-dvh bg-ink-0 text-ink-4">
      <TopRail />
      {children}
    </div>
  )
}
