'use client'

import { useState } from 'react'

// Aportar (out, money set aside → saved up) / Retirar (in → saved down) for any fund. Manual, no
// source_key. Es una TRANSFERENCIA: lleva el MÉTODO (origen/destino) para que baje/suba de esa wallet.
// Shared across the Caja Fuerte sections of Finanzas Alex and Uptown.
export function FundMovementControl({ onSubmit }: {
  onSubmit: (flow: 'in' | 'out', desc: string, amount: number, metodo: 'efectivo' | 'tarjeta') => void
}) {
  const [desc, setDesc] = useState('')
  const [amt,  setAmt]  = useState('')
  const [metodo, setMetodo] = useState<'efectivo' | 'tarjeta'>('efectivo')   // origen/destino VISIBLE
  const ready = !!desc.trim() && !!amt

  function submit(flow: 'in' | 'out') {
    const a = parseFloat(amt)
    if (!desc.trim() || !a || a <= 0) return
    onSubmit(flow, desc.trim(), a, metodo); setDesc(''); setAmt('')
  }

  return (
    <div className="flex flex-col gap-2">
      {/* Origen/destino VISIBLE: de dónde sale (aportar) o a dónde entra (retirar) el dinero. */}
      <div className="flex items-center gap-2 text-body text-fg-faint">
        <span>Cuenta:</span>
        {(['efectivo', 'tarjeta'] as const).map(w => (
          <button key={w} onClick={() => setMetodo(w)}
            className={`rounded-card border px-2.5 py-1 ${metodo === w ? 'border-accent bg-accent/15 text-accent font-medium' : 'border-border bg-surface-2 text-fg-faint'}`}>
            {w === 'efectivo' ? '💵 Efectivo' : '💳 Tarjeta'}
          </button>
        ))}
        <span className="ml-auto italic opacity-70">Aportar sale · Retirar entra</span>
      </div>
      <div className="flex gap-2">
        <input
          value={desc} onChange={e => setDesc(e.target.value)} onKeyDown={e => e.key === 'Enter' && submit('out')}
          placeholder="Concepto…"
          className="min-w-0 flex-1 rounded-card border border-border bg-surface-2 px-3 py-2 text-body text-fg placeholder:text-fg-faint/50 outline-none focus:border-accent/50"
        />
        <input
          type="number" value={amt} onChange={e => setAmt(e.target.value)} onKeyDown={e => e.key === 'Enter' && submit('out')}
          placeholder="$"
          className="w-24 rounded-card border border-border bg-surface-2 px-3 py-2 text-body text-fg placeholder:text-fg-faint/50 outline-none focus:border-accent/50"
        />
        <button onClick={() => submit('out')} disabled={!ready} title="Aportar al fondo"
          className="rounded-card bg-ok/20 px-3 py-2 text-body font-medium text-ok hover:bg-ok/30 disabled:opacity-30">Aportar</button>
        <button onClick={() => submit('in')} disabled={!ready} title="Retirar del fondo"
          className="rounded-card bg-danger/15 px-3 py-2 text-body font-medium text-danger hover:bg-danger/25 disabled:opacity-30">Retirar</button>
      </div>
    </div>
  )
}
