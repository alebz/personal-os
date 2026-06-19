'use client'

import { useEffect, useState } from 'react'

/**
 * Live date/time for the top rail. Rendered client-side only to avoid a
 * server/client hydration mismatch on the timestamp.
 */
export default function Clock() {
  const [now, setNow] = useState<Date | null>(null)

  useEffect(() => {
    setNow(new Date())
    const id = setInterval(() => setNow(new Date()), 1000)
    return () => clearInterval(id)
  }, [])

  // Reserve space before mount so the rail doesn't shift on hydration.
  if (!now) {
    return <div className="h-8 w-36" aria-hidden />
  }

  const date = now.toLocaleDateString(undefined, {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  })
  const time = now.toLocaleTimeString(undefined, {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  })

  return (
    <div className="text-right leading-tight">
      <div className="text-sm font-medium text-ink-4 tabular-nums">{time}</div>
      <div className="text-xs text-ink-3">{date}</div>
    </div>
  )
}
