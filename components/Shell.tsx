'use client'

import type { ReactNode } from 'react'
import TopRail from '@/components/TopRail'

export default function Shell({ children }: { children: ReactNode }) {
  return (
    <div className="relative min-h-dvh text-ink-4" style={{ background: 'transparent' }}>
      <TopRail />
      {children}
    </div>
  )
}
