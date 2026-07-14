'use client'

import DrumModal from '@/components/DrumModal'
import BrainIndex from '@/components/BrainIndex'

// The "ver todo" browse index as a modal overlay over the drum. Just the shared DrumModal shell
// (portal to <body>, backdrop, Esc/click/X, arrow-key trap) wrapping the BrainIndex content.
export default function BrainIndexModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  return (
    <DrumModal open={open} onClose={onClose} ariaLabel="Índice de memoria">
      <BrainIndex onNavigate={onClose} />
    </DrumModal>
  )
}
