'use client'

import { useEffect, useState } from 'react'
import Mxn from '@/components/Mxn'
import DrumModal from '@/components/DrumModal'
import { FundLedger, type FundMovement } from '@/components/finance/FundLedger'
import { FundMovementControl } from '@/components/finance/FundMovementControl'

// A fund = a finance_envelopes row with its flow-aware balance + ledger, from /api/finance/funds.
// Shared by both scopes (Finanzas Alex 'personal', Uptown 'uptown').
export interface Fund {
  id: string
  key: string | null            // keyed = foundational (caja_fuerte / mantenimiento) → not archivable/deletable
  label: string
  target: number | null
  archived: boolean
  saved: number
  movements: FundMovement[]
}

export interface FundHandlers {
  onAportaRetira: (id: string, flow: 'in' | 'out', desc: string, amount: number) => void
  onUpdateTarget: (id: string, target: number | null) => void
  onUpdateLabel:  (id: string, label: string) => void
  onArchive:      (id: string) => void
  onRestore:      (id: string) => void
  onDelete:       (id: string) => void
  onCreate:       (label: string, target: number | null) => void
}

// ─── FundCard ─────────────────────────────────────────────────────────────────
// One apartado. target=null → colchón/asset (no meta, no bar); target=number → savings goal with bar.
// Libreta + aportar/retirar live in a DrumModal. The card stays compact.
function FundCard({
  fund, onAportaRetira, onUpdateTarget, onUpdateLabel, onArchive, onDelete,
}: { fund: Fund } & Pick<FundHandlers, 'onAportaRetira' | 'onUpdateTarget' | 'onUpdateLabel' | 'onArchive' | 'onDelete'>) {
  const saved  = Number(fund.saved)
  const target = fund.target != null ? Number(fund.target) : null
  const pct    = target && target > 0 ? Math.min((saved / target) * 100, 100) : 0
  const [editingMeta, setEditingMeta] = useState(false)
  const [metaDraft, setMetaDraft]     = useState(target != null ? String(target) : '')
  const [editingName, setEditingName] = useState(false)
  const [nameDraft, setNameDraft]     = useState(fund.label)
  const [modalOpen, setModalOpen]     = useState(false)
  const foundational = fund.key != null   // caja_fuerte / mantenimiento — never archived or deleted

  useEffect(() => { setMetaDraft(fund.target != null ? String(Number(fund.target)) : '') }, [fund.target])
  useEffect(() => { setNameDraft(fund.label) }, [fund.label])

  function saveMeta() {
    const t = metaDraft.trim() === '' ? null : parseFloat(metaDraft)
    onUpdateTarget(fund.id, t != null && t > 0 ? t : null)
    setEditingMeta(false)
  }
  function saveName() {
    const n = nameDraft.trim()
    if (n && n !== fund.label) onUpdateLabel(fund.id, n)
    setEditingName(false)
  }

  return (
    <div className="rounded-card border border-border bg-surface-1 p-5 shadow-xl shadow-black/20 backdrop-blur-xl dashboard-card">
      <div className="mb-3 flex items-start justify-between gap-3">
        <div className="group min-w-0 flex-1">
          {editingName ? (
            <input
              value={nameDraft} autoFocus onChange={e => setNameDraft(e.target.value)}
              onBlur={saveName}
              onKeyDown={e => { if (e.key === 'Enter') e.currentTarget.blur(); if (e.key === 'Escape') { setNameDraft(fund.label); setEditingName(false) } }}
              className="w-full rounded border border-border bg-surface-2 px-2 py-0.5 text-subhead font-bold text-fg outline-none focus:border-accent/50"
            />
          ) : (
            <div className="flex items-center gap-2">
              <button onClick={() => setEditingName(true)} title="Editar nombre"
                className="truncate text-subhead font-bold text-fg decoration-dotted underline-offset-4 hover:underline">{fund.label}</button>
              {!foundational && (
                <span className="hidden shrink-0 items-center gap-2 text-label group-hover:flex">
                  <button onClick={() => onArchive(fund.id)} className="text-fg-muted hover:text-fg" title="Archivar (conserva la libreta)">archivar</button>
                  {fund.movements.length === 0 && (
                    <button onClick={() => onDelete(fund.id)} className="text-fg-muted/40 hover:text-danger" title="Eliminar (solo fondos vacíos)">eliminar</button>
                  )}
                </span>
              )}
            </div>
          )}
        </div>
        <div className="shrink-0 text-right">
          <p className={`text-heading font-black ${saved < 0 ? 'text-danger' : 'text-ok'}`}><Mxn v={saved} /></p>
          {target != null && <p className="text-secondary text-fg-muted">de <Mxn v={target} /></p>}
        </div>
      </div>

      {target != null && (
        <>
          <div className="mb-1 h-2.5 overflow-hidden rounded-pill bg-surface-2">
            <div className="h-full rounded-pill bg-ok transition-all duration-500" style={{ width: `${pct}%` }} />
          </div>
          <p className="mb-3 text-right text-label text-fg-muted">
            {pct.toFixed(1)}% · faltan <Mxn v={Math.max(0, target - saved)} />
          </p>
        </>
      )}

      <div className="flex items-center justify-between gap-2">
        {editingMeta ? (
          <div className="flex flex-1 gap-2">
            <input
              type="number" value={metaDraft} autoFocus placeholder="Meta (vacío = sin meta)"
              onChange={e => setMetaDraft(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') saveMeta(); if (e.key === 'Escape') setEditingMeta(false) }}
              className="flex-1 rounded-card border border-border bg-surface-2 px-3 py-1.5 text-secondary text-fg outline-none focus:border-accent/50"
            />
            <button onClick={saveMeta} className="rounded-card bg-accent/20 px-3 py-1.5 text-label font-medium text-accent hover:bg-accent/30">OK</button>
            <button onClick={() => setEditingMeta(false)} className="text-label text-fg-muted hover:text-fg">✕</button>
          </div>
        ) : (
          <button onClick={() => setEditingMeta(true)} className="text-secondary text-fg-muted underline-offset-2 hover:text-fg hover:underline">
            {target != null ? <>Cambiar meta (<Mxn v={target} />)</> : 'Poner meta'}
          </button>
        )}
        {!editingMeta && (
          <button onClick={() => setModalOpen(true)}
            className="shrink-0 rounded-card border border-border px-3 py-1.5 text-secondary font-medium text-fg-muted transition-colors hover:text-fg">
            Ver libreta →
          </button>
        )}
      </div>

      <DrumModal open={modalOpen} onClose={() => setModalOpen(false)} ariaLabel={`Libreta · ${fund.label}`}>
        <div className="mb-4 flex items-baseline justify-between gap-3">
          <h3 className="text-subhead font-bold text-fg">{fund.label}</h3>
          <p className={`text-heading font-black ${saved < 0 ? 'text-danger' : 'text-ok'}`}><Mxn v={saved} /></p>
        </div>
        <div className="mb-4">
          <FundMovementControl onSubmit={(flow, desc, amount) => onAportaRetira(fund.id, flow, desc, amount)} />
        </div>
        {fund.movements.length > 0
          ? <FundLedger movements={fund.movements} />
          : <p className="py-6 text-center text-body italic text-fg-muted">Sin movimientos todavía</p>}
      </DrumModal>
    </div>
  )
}

// ─── CajaFuerteSection ─────────────────────────────────────────────────────────
// The section where every apartado/asset of a scope lives. `funds` arrives already scoped (the
// endpoint filters by scope) — no by-key blacklist here. Includes the create input + archived list.
export function CajaFuerteSection({
  funds, createPlaceholder = 'Nuevo apartado (retiro, joya, obra…)',
  onAportaRetira, onUpdateTarget, onUpdateLabel, onArchive, onRestore, onDelete, onCreate,
}: { funds: Fund[]; createPlaceholder?: string } & FundHandlers) {
  const [name, setName] = useState('')
  const [meta, setMeta] = useState('')
  const [showArchived, setShowArchived] = useState(false)
  const section  = funds.filter(f => !f.archived)   // active apartados
  const archived = funds.filter(f => f.archived)     // soft-deleted, ledger preserved
  const total    = section.reduce((s, f) => s + Number(f.saved), 0)

  function create() {
    if (!name.trim()) return
    const t = meta.trim() === '' ? null : parseFloat(meta)
    onCreate(name.trim(), t != null && t > 0 ? t : null)
    setName(''); setMeta('')
  }

  return (
    <div className="space-y-5">
      {/* Total guardado + create apartado */}
      <div className="rounded-card border border-border bg-surface-1 p-4 shadow-xl shadow-black/20 backdrop-blur-xl dashboard-card">
        <div className="mb-3 flex items-center justify-between">
          <p className="text-label font-bold uppercase tracking-widest text-fg-muted">Total guardado</p>
          <p className={`text-subhead font-black tabular-nums ${total < 0 ? 'text-danger' : 'text-ok'}`}><Mxn v={total} /></p>
        </div>
        <div className="flex gap-2">
          <input
            value={name} onChange={e => setName(e.target.value)} onKeyDown={e => e.key === 'Enter' && create()}
            placeholder={createPlaceholder}
            className="min-w-0 flex-1 rounded-card border border-border bg-surface-2 px-3 py-2 text-body text-fg placeholder-ink-3/50 outline-none focus:border-accent/50"
          />
          <input
            type="number" value={meta} onChange={e => setMeta(e.target.value)} onKeyDown={e => e.key === 'Enter' && create()}
            placeholder="Meta (opcional)"
            className="w-36 rounded-card border border-border bg-surface-2 px-3 py-2 text-body text-fg placeholder-ink-3/50 outline-none focus:border-accent/50"
          />
          <button onClick={create} disabled={!name.trim()}
            className="rounded-card bg-accent/20 px-4 py-2 text-body font-medium text-accent hover:bg-accent/30 disabled:opacity-30">Crear</button>
        </div>
      </div>

      {section.length === 0 ? (
        <p className="py-10 text-center text-body italic text-fg-muted">Sin apartados todavía</p>
      ) : (
        <div className="grid gap-5 lg:grid-cols-2">
          {section.map(f => (
            <FundCard key={f.id} fund={f} onAportaRetira={onAportaRetira} onUpdateTarget={onUpdateTarget} onUpdateLabel={onUpdateLabel} onArchive={onArchive} onDelete={onDelete} />
          ))}
        </div>
      )}

      {/* Archived apartados — soft-deleted, ledger preserved, restorable (mirrors HabitTracker) */}
      {archived.length > 0 && (
        <div className="rounded-card border border-border bg-surface-1 dashboard-card">
          <button
            onClick={() => setShowArchived(s => !s)}
            className="flex w-full items-center justify-between px-4 py-3 text-secondary font-semibold uppercase tracking-wider text-fg-muted transition-colors hover:text-fg"
          >
            <span>Archivados ({archived.length})</span>
            <span aria-hidden className="text-fg-muted/60">{showArchived ? '▲' : '▼'}</span>
          </button>
          {showArchived && (
            <div className="divide-y divide-border border-t border-border">
              {archived.map(f => (
                <div key={f.id} className="flex items-center gap-3 px-4 py-2.5">
                  <span className="min-w-0 flex-1 truncate text-body text-fg-muted">{f.label}</span>
                  <span className="shrink-0 text-secondary tabular-nums text-fg-muted/70"><Mxn v={Number(f.saved)} /></span>
                  <button onClick={() => onRestore(f.id)} className="shrink-0 text-label font-medium text-accent hover:underline">Restaurar</button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
