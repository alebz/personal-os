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
        'rounded-card border border-border bg-surface-1 p-5 shadow-xl shadow-black/20 dashboard-card ' +
        className
      }
    >
      {title && (
        <h2 className="mb-3 text-secondary font-medium uppercase tracking-wider text-fg-muted">
          {title}
        </h2>
      )}
      {children}
    </section>
  )
}
