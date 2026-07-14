'use client'

import { useEffect, type ReactNode } from 'react'
import { createPortal } from 'react-dom'

// Shared overlay shell for modals that float OVER the drum. Portals to <body> so it (a) escapes the
// drum face's preserve-3d transform (fixed positioning works against the viewport) and (b) lands as a
// sibling of `.os-scene`, so OSDrum's wheel/pointer listeners never see events over it — the drum
// can't rotate/drag underneath, and the panel's own internal scroll is a legitimate layer-apart
// exception (like TaskDrawer). Used by BrainIndexModal ("ver todo") and CerebroResults (Consultar).
export default function DrumModal({
  open,
  onClose,
  ariaLabel,
  children,
}: {
  open: boolean
  onClose: () => void
  ariaLabel?: string
  children: ReactNode
}) {
  // Freeze the background while open: Esc closes, arrow keys are swallowed in the capture phase
  // (before OSDrum's window-bubble keydown listener) so the drum doesn't spin behind the modal.
  useEffect(() => {
    if (!open) return
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') { onClose(); return }
      if (e.key === 'ArrowUp' || e.key === 'ArrowDown' || e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
        e.stopPropagation()   // beats OSDrum's listener; no preventDefault so modal scroll/inputs still use arrows
      }
    }
    window.addEventListener('keydown', onKey, true)   // capture phase → fires before OSDrum's bubble listener
    return () => window.removeEventListener('keydown', onKey, true)
  }, [open, onClose])

  if (!open || typeof document === 'undefined') return null

  return createPortal(
    <div
      className="fixed inset-0 z-[10050] flex items-start justify-center bg-black/60 p-4 backdrop-blur-[2px] sm:p-6"
      onClick={onClose}   // backdrop click closes
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label={ariaLabel}
        onClick={e => e.stopPropagation()}   // clicks inside never close
        className="relative mt-[4vh] w-[min(92vw,46rem)] max-h-[88vh] overflow-y-auto rounded-2xl border border-ink-4/10 bg-ink-0/95 p-6 pr-8 shadow-2xl shadow-black/60 backdrop-blur-xl dashboard-card"
      >
        <button
          onClick={onClose}
          aria-label="Cerrar"
          className="absolute right-3 top-3 z-10 flex h-7 w-7 items-center justify-center rounded-full text-ink-3 transition-colors hover:bg-ink-4/[0.08] hover:text-ink-4"
        >
          <svg viewBox="0 0 20 20" fill="none" className="h-4 w-4" stroke="currentColor" strokeWidth={1.8}>
            <path d="M5 5l10 10M15 5L5 15" strokeLinecap="round" />
          </svg>
        </button>
        {children}
      </div>
    </div>,
    document.body,
  )
}
