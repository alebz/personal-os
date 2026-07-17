'use client'

import { useState } from 'react'

// Aportar (out, money set aside → saved up) / Retirar (in → saved down) for any fund. Manual, no
// source_key. Shared across the Caja Fuerte sections of Finanzas Alex and Uptown.
export function FundMovementControl({ onSubmit }: {
  onSubmit: (flow: 'in' | 'out', desc: string, amount: number) => void
}) {
  const [desc, setDesc] = useState('')
  const [amt,  setAmt]  = useState('')
  const ready = !!desc.trim() && !!amt

  function submit(flow: 'in' | 'out') {
    const a = parseFloat(amt)
    if (!desc.trim() || !a || a <= 0) return
    onSubmit(flow, desc.trim(), a); setDesc(''); setAmt('')
  }

  return (
    <div className="flex gap-2">
      <input
        value={desc} onChange={e => setDesc(e.target.value)} onKeyDown={e => e.key === 'Enter' && submit('out')}
        placeholder="Concepto…"
        className="min-w-0 flex-1 rounded-card border border-border bg-surface-2 px-3 py-2 text-body text-fg placeholder-ink-3/50 outline-none focus:border-accent/50"
      />
      <input
        type="number" value={amt} onChange={e => setAmt(e.target.value)} onKeyDown={e => e.key === 'Enter' && submit('out')}
        placeholder="$"
        className="w-24 rounded-card border border-border bg-surface-2 px-3 py-2 text-body text-fg placeholder-ink-3/50 outline-none focus:border-accent/50"
      />
      <button onClick={() => submit('out')} disabled={!ready} title="Aportar al fondo"
        className="rounded-card bg-ok/20 px-3 py-2 text-body font-medium text-ok hover:bg-ok/30 disabled:opacity-30">Aportar</button>
      <button onClick={() => submit('in')} disabled={!ready} title="Retirar del fondo"
        className="rounded-card bg-danger/15 px-3 py-2 text-body font-medium text-danger hover:bg-danger/25 disabled:opacity-30">Retirar</button>
    </div>
  )
}
