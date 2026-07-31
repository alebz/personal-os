'use client'

import { useCallback, useEffect, useState } from 'react'
import { MONEY, MoneyBar, MoneyModal, MoneyBtn, MoneyInput, fmtMxn } from './MoneyChrome'

// CAJA FUERTE (apartados) en estilo MSN Money. Autocontenido: lee /api/finance/funds?scope=personal y
// hace todas las ops de fondo (crear, aportar[flow out], retirar[flow in], editar meta/nombre, archivar,
// restaurar, eliminar, libreta). onChange refresca los movimientos del padre (Historial + saldos vivos).

const num = (v: unknown) => Number(v ?? 0) || 0
const todayStr = () => { const d = new Date(); return [d.getFullYear(), String(d.getMonth() + 1).padStart(2, '0'), String(d.getDate()).padStart(2, '0')].join('-') }

interface Move { id: string; date: string; description: string; amount: number; flow: 'in' | 'out'; category: string; metodo: string | null }
interface Fund { id: string; key: string | null; label: string; target: number | null; archived: boolean; saved: number; movements: Move[] }

async function post(url: string, body: unknown) { const r = await fetch(url, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) }); if (!r.ok) throw new Error(await r.text()); return r.json() }
async function patch(url: string, body: unknown) { const r = await fetch(url, { method: 'PATCH', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) }); if (!r.ok) throw new Error(await r.text()); return r.json() }

export default function MoneyCaja({ month, onChange, scope = 'personal', excludeKeys = [], createPlaceholder = 'Vacaciones, colchón…' }: { month: string; onChange: () => void; scope?: string; excludeKeys?: string[]; createPlaceholder?: string }) {
  const [funds, setFunds] = useState<Fund[]>([])
  const [showArchived, setShowArchived] = useState(false)
  const [open, setOpen] = useState<string | null>(null)   // fund id cuya libreta está abierta
  const [creating, setCreating] = useState(false)

  const load = useCallback(() => {
    fetch(`/api/finance/funds?scope=${scope}&archived=1`).then((r) => r.json()).then((d) => {
      if (Array.isArray(d)) setFunds(d.filter((f) => !f.key || !excludeKeys.includes(f.key)).map((f) => ({ ...f, saved: num(f.saved), target: f.target == null ? null : num(f.target), movements: (f.movements ?? []).map((m: Move) => ({ ...m, amount: num(m.amount) })) })))
    }).catch(() => {})
  }, [scope, excludeKeys])
  useEffect(() => { load() }, [load])

  const refresh = () => { load(); onChange() }

  async function aportaRetira(id: string, flow: 'in' | 'out', description: string, amount: number) {
    await post('/api/finance/movements', { month, date: todayStr(), description, amount, flow, category: 'fondo', commitment_id: null, envelope_id: id, metodo: null })
    refresh()
  }
  async function createFund(label: string, target: number | null) { await post('/api/finance/envelopes', { label, target, scope }); setCreating(false); refresh() }
  async function updateFund(id: string, body: Record<string, unknown>) { await patch(`/api/finance/envelopes/${id}`, body); refresh() }
  async function deleteFund(id: string) { await fetch(`/api/finance/envelopes/${id}`, { method: 'DELETE' }); setOpen(null); refresh() }

  const active = funds.filter((f) => !f.archived)
  const archived = funds.filter((f) => f.archived)
  const total = active.reduce((s, f) => s + f.saved, 0)
  const openFund = funds.find((f) => f.id === open) || null

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', marginBottom: 9 }}>
        <span style={{ fontSize: 14, fontWeight: 700, color: MONEY.blue, flex: 1 }}>Caja Fuerte · apartados</span>
        <MoneyBtn onClick={() => setCreating(true)} primary>+ Nuevo apartado</MoneyBtn>
      </div>

      <MoneyBar right={fmtMxn(total)}>Total guardado</MoneyBar>
      <div style={{ border: `1px solid ${MONEY.rule}`, borderTop: 'none', background: '#fff' }}>
        {active.length === 0 && <div style={{ padding: '8px 9px', color: '#8a93a8', fontStyle: 'italic' }}>Sin fondos.</div>}
        {active.map((f) => <FundRow key={f.id} fund={f} onOpen={() => setOpen(f.id)} onRename={(label) => updateFund(f.id, { label })} onMeta={(target) => updateFund(f.id, { target })} onArchive={() => updateFund(f.id, { archived: true })} onDelete={() => deleteFund(f.id)} />)}
      </div>

      {archived.length > 0 && (
        <div style={{ marginTop: 11 }}>
          <button onClick={() => setShowArchived((v) => !v)} style={{ border: 0, background: 'none', cursor: 'pointer', color: MONEY.link, fontSize: 11, fontFamily: 'inherit', padding: 0 }}>
            {showArchived ? '▾' : '▸'} Archivados ({archived.length})
          </button>
          {showArchived && (
            <div style={{ border: `1px solid ${MONEY.rule}`, marginTop: 4, background: '#fff' }}>
              {archived.map((f) => (
                <div key={f.id} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '4px 9px', borderBottom: '1px solid #eef2f8' }}>
                  <span style={{ flex: 1, color: '#6a7690' }}>{f.label}</span>
                  <span style={{ color: '#6a7690' }}>{fmtMxn(f.saved)}</span>
                  <MoneyBtn onClick={() => updateFund(f.id, { archived: false })}>Restaurar</MoneyBtn>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {creating && <CreateFundModal placeholder={createPlaceholder} onClose={() => setCreating(false)} onCreate={createFund} />}
      {openFund && <LibretaModal fund={openFund} onClose={() => setOpen(null)} onAporta={(d, a) => aportaRetira(openFund.id, 'out', d, a)} onRetira={(d, a) => aportaRetira(openFund.id, 'in', d, a)} onDelete={() => deleteFund(openFund.id)} />}
    </div>
  )
}

function FundRow({ fund, onOpen, onRename, onMeta, onArchive, onDelete }: {
  fund: Fund; onOpen: () => void; onRename: (l: string) => void; onMeta: (t: number | null) => void; onArchive: () => void; onDelete: () => void
}) {
  const [editName, setEditName] = useState(false)
  const [name, setName] = useState(fund.label)
  const [editMeta, setEditMeta] = useState(false)
  const [meta, setMeta] = useState(fund.target != null ? String(fund.target) : '')
  const [armDel, setArmDel] = useState(false)
  useEffect(() => { if (!armDel) return; const t = setTimeout(() => setArmDel(false), 3000); return () => clearTimeout(t) }, [armDel])

  const pct = fund.target && fund.target > 0 ? Math.max(0, Math.min(1, fund.saved / fund.target)) : 0
  const foundational = fund.key != null
  const canDelete = !foundational && fund.movements.length === 0

  return (
    <div style={{ padding: '5px 9px', borderBottom: '1px solid #eef2f8' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        {editName ? (
          <input autoFocus value={name} onChange={(e) => setName(e.target.value)} onBlur={() => { setEditName(false); if (name.trim() && name !== fund.label) onRename(name.trim()) }}
            onKeyDown={(e) => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur() }}
            style={{ flex: 1, border: `1px solid ${MONEY.rule}`, borderRadius: 3, padding: '1px 5px', fontSize: 11, fontFamily: 'inherit', outline: 'none' }} />
        ) : (
          <span onClick={() => setEditName(true)} title="Renombrar" style={{ flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', cursor: 'text', fontWeight: 600 }}>{fund.label}</span>
        )}
        <span style={{ color: fund.saved >= 0 ? MONEY.ink : MONEY.down, fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}>{fmtMxn(fund.saved)}</span>
      </div>
      {fund.target != null && fund.target > 0 && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 3 }}>
          <div style={{ flex: 1, height: 8, background: '#e6edf7', borderRadius: 2, border: '1px solid #cdd8e8', overflow: 'hidden' }}>
            <div style={{ width: `${pct * 100}%`, height: '100%', background: `linear-gradient(${MONEY.barFrom},${MONEY.barTo})` }} />
          </div>
          <span style={{ fontSize: 10, color: '#8a93a8' }}>{Math.round(pct * 100)}% de {fmtMxn(fund.target)}</span>
        </div>
      )}
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 4 }}>
        <MoneyBtn onClick={onOpen}>Libreta →</MoneyBtn>
        {editMeta ? (
          <span style={{ display: 'inline-flex', gap: 4, alignItems: 'center' }}>
            <input autoFocus type="number" value={meta} onChange={(e) => setMeta(e.target.value)} placeholder="meta"
              style={{ width: 74, border: `1px solid ${MONEY.rule}`, borderRadius: 3, padding: '1px 5px', fontSize: 11, fontFamily: 'inherit', outline: 'none' }} />
            <MoneyBtn onClick={() => { setEditMeta(false); onMeta(meta.trim() === '' ? null : num(meta)) }}>ok</MoneyBtn>
          </span>
        ) : (
          <button onClick={() => setEditMeta(true)} style={linkBtn}>{fund.target != null ? 'Cambiar meta' : 'Poner meta'}</button>
        )}
        <span style={{ flex: 1 }} />
        {!foundational && <button onClick={onArchive} style={linkBtn}>Archivar</button>}
        {canDelete && (
          <button onClick={() => { if (armDel) { setArmDel(false); onDelete() } else setArmDel(true) }} style={{ ...linkBtn, color: armDel ? '#c31212' : '#a9b0be', fontWeight: armDel ? 700 : 400 }}>
            {armDel ? '¿eliminar?' : 'Eliminar'}
          </button>
        )}
      </div>
    </div>
  )
}
const linkBtn: React.CSSProperties = { border: 0, background: 'none', cursor: 'pointer', color: MONEY.link, fontSize: 10.5, fontFamily: 'inherit', padding: 0, textDecoration: 'underline', textUnderlineOffset: 2 }

function CreateFundModal({ onClose, onCreate, placeholder }: { onClose: () => void; onCreate: (label: string, target: number | null) => void; placeholder: string }) {
  const [label, setLabel] = useState('')
  const [target, setTarget] = useState('')
  return (
    <MoneyModal title="Nuevo apartado" onClose={onClose}
      footer={<><MoneyBtn onClick={onClose}>Cancelar</MoneyBtn><MoneyBtn primary disabled={!label.trim()} onClick={() => label.trim() && onCreate(label.trim(), target.trim() === '' ? null : num(target))}>Crear</MoneyBtn></>}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        <label style={lbl}>Nombre<MoneyInput autoFocus value={label} onChange={(e) => setLabel(e.target.value)} placeholder={placeholder} /></label>
        <label style={lbl}>Meta (opcional)<MoneyInput type="number" value={target} onChange={(e) => setTarget(e.target.value)} placeholder="sin meta" /></label>
      </div>
    </MoneyModal>
  )
}
const lbl: React.CSSProperties = { display: 'flex', flexDirection: 'column', gap: 3, fontSize: 10.5, color: '#5a6a86' }

function LibretaModal({ fund, onClose, onAporta, onRetira, onDelete }: {
  fund: Fund; onClose: () => void; onAporta: (d: string, a: number) => void; onRetira: (d: string, a: number) => void; onDelete: () => void
}) {
  const [desc, setDesc] = useState('')
  const [amount, setAmount] = useState('')
  const [desc2, setDesc2] = useState(true)   // orden fecha desc
  const canDelete = fund.key == null && fund.movements.length === 0

  function doMove(fn: (d: string, a: number) => void) {
    const a = num(amount); if (a <= 0) return
    fn(desc.trim() || (fn === onAporta ? 'Aportación' : 'Retiro'), a)
    setDesc(''); setAmount('')
  }

  // saldo corrido cronológico (out = entrada +, in = salida −)
  const chron = [...fund.movements].sort((a, b) => a.date.localeCompare(b.date))
  let run = 0
  const rows = chron.map((m) => { run += m.flow === 'out' ? m.amount : -m.amount; return { ...m, run } })
  const view = desc2 ? [...rows].reverse() : rows

  return (
    <MoneyModal title={`Libreta · ${fund.label}`} width={420} onClose={onClose}
      footer={canDelete ? <MoneyBtn danger onClick={onDelete}>Eliminar apartado</MoneyBtn> : undefined}>
      <div style={{ display: 'flex', alignItems: 'flex-end', gap: 6, marginBottom: 9 }}>
        <label style={{ ...lbl, flex: 1 }}>Concepto<MoneyInput value={desc} onChange={(e) => setDesc(e.target.value)} placeholder="opcional" /></label>
        <label style={{ ...lbl, width: 92 }}>Monto<MoneyInput type="number" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="0" /></label>
        <MoneyBtn primary onClick={() => doMove(onAporta)}>Aportar</MoneyBtn>
        <MoneyBtn onClick={() => doMove(onRetira)}>Retirar</MoneyBtn>
      </div>
      <div style={{ border: `1px solid ${MONEY.rule}`, maxHeight: 210, overflowY: 'auto' }}>
        <div style={{ display: 'flex', background: `linear-gradient(${MONEY.barFrom},${MONEY.barTo})`, color: '#fff', fontWeight: 700, fontSize: 10, padding: '2px 7px', position: 'sticky', top: 0 }}>
          <span onClick={() => setDesc2((v) => !v)} style={{ width: 58, cursor: 'pointer' }}>Fecha {desc2 ? '▾' : '▴'}</span>
          <span style={{ flex: 1 }}>Concepto</span>
          <span style={{ width: 66, textAlign: 'right' }}>Entrada</span>
          <span style={{ width: 66, textAlign: 'right' }}>Salida</span>
          <span style={{ width: 74, textAlign: 'right' }}>Saldo</span>
        </div>
        {view.length === 0 && <div style={{ padding: '7px', color: '#8a93a8', fontStyle: 'italic' }}>Sin movimientos.</div>}
        {view.map((m) => (
          <div key={m.id} style={{ display: 'flex', fontSize: 10.5, padding: '2px 7px', borderBottom: '1px solid #eef2f8' }}>
            <span style={{ width: 58, color: '#6a7690' }}>{m.date.slice(5)}</span>
            <span style={{ flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{m.description}</span>
            <span style={{ width: 66, textAlign: 'right', color: MONEY.up }}>{m.flow === 'out' ? fmtMxn(m.amount) : ''}</span>
            <span style={{ width: 66, textAlign: 'right', color: MONEY.down }}>{m.flow === 'in' ? fmtMxn(m.amount) : ''}</span>
            <span style={{ width: 74, textAlign: 'right', fontWeight: 600, fontVariantNumeric: 'tabular-nums' }}>{fmtMxn(m.run)}</span>
          </div>
        ))}
      </div>
    </MoneyModal>
  )
}
