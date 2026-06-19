'use client'

import type { ReactNode } from 'react'
import TopRail from '@/components/TopRail'

const GLOWS = {
  home:
    'radial-gradient(60rem 40rem at 15% -10%, oklch(0.7 0.16 255 / 0.18), transparent 60%),' +
    'radial-gradient(50rem 40rem at 100% 0%, oklch(0.72 0.17 152 / 0.10), transparent 55%)',
  crm:
    'radial-gradient(60rem 40rem at 15% -10%, oklch(0.7 0.16 255 / 0.15), transparent 60%),' +
    'radial-gradient(50rem 40rem at 100% 20%, oklch(0.64 0.21 25 / 0.07), transparent 55%)',
  finance:
    'radial-gradient(60rem 40rem at 85% -10%, oklch(0.75 0.15 150 / 0.14), transparent 60%),' +
    'radial-gradient(50rem 35rem at 5% 40%, oklch(0.72 0.18 95 / 0.08), transparent 55%)',
  uptown:
    'radial-gradient(60rem 40rem at 20% -5%, oklch(0.78 0.16 55 / 0.14), transparent 60%),' +
    'radial-gradient(50rem 35rem at 90% 35%, oklch(0.70 0.14 30 / 0.08), transparent 55%)',
} as const

export default function Shell({
  children,
  glow = 'home',
}: {
  children: ReactNode
  glow?: keyof typeof GLOWS
}) {
  return (
    <div className="relative min-h-dvh bg-ink-0 text-ink-4">
      <div
        aria-hidden
        className="pointer-events-none fixed inset-0 -z-10"
        style={{ background: GLOWS[glow] }}
      />
      <TopRail />
      {children}
    </div>
  )
}
