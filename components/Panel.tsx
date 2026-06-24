import type { ReactNode } from 'react'

type PanelProps = {
  title?: string
  children?: ReactNode
  className?: string
}

/**
 * Glassmorphism surface: translucent ink fill, backdrop blur, thin border.
 * Used for every card on the dashboard.
 */
export default function Panel({ title, children, className = '' }: PanelProps) {
  return (
    <section
      className={
        'rounded-2xl border border-ink-4/10 bg-ink-1/85 p-5 shadow-xl shadow-black/20 backdrop-blur-xl ' +
        className
      }
    >
      {title && (
        <h2 className="mb-3 text-xs font-medium uppercase tracking-wider text-ink-3">
          {title}
        </h2>
      )}
      {children}
    </section>
  )
}
