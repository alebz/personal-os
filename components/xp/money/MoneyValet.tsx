'use client'

import { useCallback, useEffect, useState } from 'react'
import { MONEY, MoneyBar, MoneyModal, MoneyBtn, MoneyInput, fmtMxn } from './MoneyChrome'

// VALET en estilo MSN Money. Autocontenido: config (/api/uptown/valet), pagos de inquilinos
// (/api/uptown/valet/payment → cobro al fondo valet_nu), proveedor (movimiento valet_prov en valet_nu),
// y conciliación de la Cuenta Nu. onLedgerChange refresca la Caja Fuerte del padre.

const VALET_TENANTS = [
  { id: 'publico_gourmet', name: 'Público Gourmet', pts: 3 },
  { id: 'barbajan', name: 'Barbaján', pts: 3 },
  { id: 'maison_zozoaga', name: 'Maison Zozoaga', pts: 3 },
  { id: 'maricel', name: "Maricel's Room", pts: 3 },
  { id: 'arko', name: 'Arko', pts: 2 },
  { id: 'connect', name: 'Connect', pts: 2 },
  { id: 'east_garden', name: 'The East Garden', pts: 1 },
] as const
const VALET_TOTAL_PTS = VALET_TENANTS.reduce((s, t) => s + t.pts, 0)   // 17
const VALET_PROVIDER_WEEK = 2800
const num = (v: unknown) => Number(v ?? 0) || 0

function saturdayDatesInMonth(month: string): string[] {
  const [y, mo] = month.split('-').map(Number)
  const d = new Date(y, mo - 1, 1)
  while (d.getDay() !== 6) d.setDate(d.getDate() + 1)
  const out: string[] = []
  while (d.getMonth() === mo - 1) { out.push([d.getFullYear(), String(d.getMonth() + 1).padStart(2, '0'), String(d.getDate()).padStart(2, '0')].join('-')); d.setDate(d.getDate() + 7) }
  return out
}
const dLabel = (iso: string) => new Date(iso + 'T12:00:00').toLocaleDateString('es-MX', { day: 'numeric', month: 'short' })

interface Payment { week_date: string; tenant_id: string; status: 'pending' | 'paid' }
interface Move { id: string; date: string; description: string; amount: number; flow: 'in' | 'out'; source_key: string | null }
interface Config { num_weeks: number; week1_date: string | null; price_per_point: number }

async function post(url: string, b: unknown) { const r = await fetch(url, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(b) }); if (!r.ok) throw new Error(await r.text()); return r.json().catch(() => ({})) }
async function del(url: string) { await fetch(url, { method: 'DELETE' }) }

function Check({ on, onClick }: { on: boolean; onClick: () => void }) {
  return <span onClick={onClick} style={{ cursor: 'pointer', display: 'inline-flex', width: 14, height: 14, flexShrink: 0, borderRadius: 2, border: `1px solid ${on ? MONEY.up : '#a9b4c6'}`, background: on ? MONEY.up : '#fff', alignItems: 'center', justifyContent: 'center', color: '#fff', fontSize: 10, lineHeight: 1 }}>{on ? '✓' : ''}</span>
}

export default function MoneyValet({ month, onLedgerChange }: { month: string; onLedgerChange: () => void }) {
  const [config, setConfig] = useState<Config>({ num_weeks: 4, week1_date: null, price_per_point: 176 })
  const [payments, setPayments] = useState<Payment[]>([])
  const [nu, setNu] = useState<{ saved: number; movements: Move[] }>({ saved: 0, movements: [] })
  const [nuOpen, setNuOpen] = useState(false)

  const loadValet = useCallback(() => fetch(`/api/uptown/valet?month=${month}`).then((r) => r.json()).then((d) => { if (d) { if (d.config) setConfig({ num_weeks: num(d.config.num_weeks) || 4, week1_date: d.config.week1_date ?? null, price_per_point: num(d.config.price_per_point) || 176 }); if (Array.isArray(d.payments)) setPayments(d.payments) } }).catch(() => {}), [month])
  const loadNu = useCallback(() => fetch('/api/finance/funds?scope=uptown&archived=1').then((r) => r.json()).then((d) => { if (Array.isArray(d)) { const f = d.find((x) => x.key === 'valet_nu'); if (f) setNu({ saved: num(f.saved), movements: (f.movements ?? []).map((m: Move) => ({ ...m, amount: num(m.amount) })) }) } }).catch(() => {}), [])
  useEffect(() => { loadValet() }, [loadValet])
  useEffect(() => { loadNu() }, [loadNu])
  const refresh = () => { loadValet(); loadNu(); onLedgerChange() }

  const ppt = config.price_per_point
  const weeks = saturdayDatesInMonth(month)
  const numWeeks = weeks.length
  const isPaid = (date: string, tid: string) => payments.some((p) => p.week_date === date && p.tenant_id === tid && p.status === 'paid')
  const providerMov = (date: string) => nu.movements.find((m) => m.source_key === `valet_prov:${date}`)

  const cobrado = weeks.reduce((s, wk) => s + VALET_TENANTS.reduce((ws, t) => ws + (isPaid(wk, t.id) ? t.pts * ppt : 0), 0), 0)
  const esperado = numWeeks * VALET_TOTAL_PTS * ppt
  const proveedorPagado = weeks.reduce((s, wk) => s + (providerMov(wk) ? num(providerMov(wk)!.amount) : 0), 0)
  const proveedorTotal = numWeeks * VALET_PROVIDER_WEEK

  async function toggleTenant(date: string, tenantId: string, paid: boolean) {
    setPayments((ps) => { const o = ps.filter((p) => !(p.week_date === date && p.tenant_id === tenantId)); return [...o, { week_date: date, tenant_id: tenantId, status: paid ? 'paid' : 'pending' }] })
    await post('/api/uptown/valet/payment', { week_date: date, tenant_id: tenantId, status: paid ? 'paid' : 'pending' })
    refresh()
  }
  async function toggleProvider(date: string, paid: boolean) {
    if (paid) { const ex = providerMov(date); await post('/api/finance/funds/movement', { key: 'valet_nu', flow: 'in', amount: ex ? num(ex.amount) : VALET_PROVIDER_WEEK, description: `Pago proveedor · ${date}`, month: date.slice(0, 7), date, source_key: `valet_prov:${date}` }) }
    else { await del(`/api/finance/funds/movement?source_key=valet_prov:${date}`) }
    refresh()
  }
  async function setProviderAmount(date: string, amount: number) {
    if (!providerMov(date)) return
    await post('/api/finance/funds/movement', { key: 'valet_nu', flow: 'in', amount, description: `Pago proveedor · ${date}`, month: date.slice(0, 7), date, source_key: `valet_prov:${date}` })
    refresh()
  }
  const saveConfig = (patch: Partial<Config>) => post('/api/uptown/valet/config', { month, ...patch }).then(() => loadValet())
  async function nuCuadrar(bank: number) { const delta = Math.round(bank - nu.saved); if (Math.abs(delta) < 0.01) return; await post('/api/finance/funds/movement', { key: 'valet_nu', flow: delta > 0 ? 'out' : 'in', amount: Math.abs(delta), description: 'Ajuste de conciliación', month }); refresh() }

  return (
    <div>
      <div style={{ fontSize: 14, fontWeight: 700, color: MONEY.blue, marginBottom: 9 }}>Valet</div>

      {/* Resumen + config */}
      <div style={{ display: 'flex', gap: 9, marginBottom: 11, flexWrap: 'wrap' }}>
        <div style={{ flex: 1, minWidth: 190, border: `1px solid ${MONEY.rule}`, borderRadius: 3, padding: '7px 10px', background: 'linear-gradient(#fff,#f2f7fd)' }}>
          <ProgressLine label="Cobrado" a={cobrado} b={esperado} />
          <div style={{ height: 6 }} />
          <ProgressLine label="Proveedor" a={proveedorPagado} b={proveedorTotal} down />
        </div>
        <div style={{ flex: 1, minWidth: 190, border: `1px solid ${MONEY.rule}`, borderRadius: 3, padding: '7px 10px', background: 'linear-gradient(#fff,#f2f7fd)', display: 'flex', flexDirection: 'column', gap: 5 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 10.5, color: '#5a6a86' }}>Semanas<span style={{ marginLeft: 'auto', fontWeight: 700, color: MONEY.ink }}>{numWeeks}</span></div>
          <ConfigRow label="1er sábado" type="date" value={config.week1_date ?? weeks[0] ?? ''} onSave={(v) => saveConfig({ week1_date: v })} />
          <ConfigRow label="Monto / punto" type="number" value={String(ppt)} onSave={(v) => saveConfig({ price_per_point: num(v) })} />
        </div>
      </div>

      {/* Cuenta Nu */}
      <MoneyBar right={fmtMxn(nu.saved)}>Cuenta Nu (operación valet)</MoneyBar>
      <div style={{ border: `1px solid ${MONEY.rule}`, borderTop: 'none', background: '#fff', padding: '5px 9px', display: 'flex', alignItems: 'center', gap: 8 }}>
        <span style={{ flex: 1, color: '#5a6a86' }}>Saldo en la cuenta</span>
        <MoneyBtn onClick={() => setNuOpen(true)}>Libreta →</MoneyBtn>
      </div>

      {/* Semanas */}
      <div style={{ marginTop: 11, display: 'flex', flexDirection: 'column', gap: 9 }}>
        {weeks.length === 0 && <div style={{ color: '#8a93a8', fontStyle: 'italic' }}>Sin sábados este mes.</div>}
        {weeks.map((wk, i) => {
          const pMov = providerMov(wk)
          const provPaid = !!pMov
          const weekCobrado = VALET_TENANTS.reduce((s, t) => s + (isPaid(wk, t.id) ? t.pts * ppt : 0), 0)
          const complete = VALET_TENANTS.every((t) => isPaid(wk, t.id)) && provPaid
          return (
            <div key={wk} style={{ border: `1px solid ${complete ? MONEY.up : MONEY.rule}`, borderRadius: 3, overflow: 'hidden' }}>
              <MoneyBar right={`${fmtMxn(weekCobrado)} / ${fmtMxn(VALET_TOTAL_PTS * ppt)}`}>Semana {i + 1} · {dLabel(wk)}</MoneyBar>
              <div style={{ background: complete ? '#f2fbf3' : '#fff' }}>
                {VALET_TENANTS.map((t) => (
                  <div key={t.id} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '3px 9px', borderBottom: '1px solid #eef2f8' }}>
                    <Check on={isPaid(wk, t.id)} onClick={() => toggleTenant(wk, t.id, !isPaid(wk, t.id))} />
                    <span style={{ flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{t.name}<span style={{ color: '#8a93a8' }}> · {t.pts}pt</span></span>
                    <span style={{ color: isPaid(wk, t.id) ? MONEY.up : '#8a93a8', fontVariantNumeric: 'tabular-nums' }}>{fmtMxn(t.pts * ppt)}</span>
                  </div>
                ))}
                {/* Proveedor */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '3px 9px', background: '#f7f9fc' }}>
                  <Check on={provPaid} onClick={() => toggleProvider(wk, !provPaid)} />
                  <span style={{ flex: 1 }}>Proveedor</span>
                  {provPaid ? (
                    <ProviderAmount value={num(pMov!.amount)} onSave={(v) => setProviderAmount(wk, v)} />
                  ) : (
                    <span style={{ color: MONEY.down }}>−{fmtMxn(VALET_PROVIDER_WEEK)}</span>
                  )}
                </div>
              </div>
            </div>
          )
        })}
      </div>

      {nuOpen && <NuModal saved={nu.saved} movements={nu.movements} onClose={() => setNuOpen(false)} onCuadrar={nuCuadrar} />}
    </div>
  )
}

function ProgressLine({ label, a, b, down }: { label: string; a: number; b: number; down?: boolean }) {
  const pct = b > 0 ? Math.max(0, Math.min(1, a / b)) : 0
  return (
    <div>
      <div style={{ display: 'flex', fontSize: 10.5, color: '#5a6a86' }}><span style={{ flex: 1 }}>{label}</span><span style={{ color: down ? MONEY.down : MONEY.up, fontWeight: 700 }}>{fmtMxn(a)}</span><span style={{ color: '#8a93a8' }}>&nbsp;/ {fmtMxn(b)}</span></div>
      <div style={{ height: 8, background: '#e6edf7', borderRadius: 2, border: '1px solid #cdd8e8', overflow: 'hidden', marginTop: 2 }}><div style={{ width: `${pct * 100}%`, height: '100%', background: `linear-gradient(${MONEY.barFrom},${MONEY.barTo})` }} /></div>
    </div>
  )
}

function ConfigRow({ label, type, value, onSave }: { label: string; type: string; value: string; onSave: (v: string) => void }) {
  const [v, setV] = useState(value)
  useEffect(() => { setV(value) }, [value])
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 10.5, color: '#5a6a86' }}>
      <span style={{ flex: 1 }}>{label}</span>
      <input type={type} value={v} onChange={(e) => setV(e.target.value)} onBlur={() => v !== value && onSave(v)} onKeyDown={(e) => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur() }}
        style={{ width: type === 'date' ? 120 : 66, border: `1px solid ${MONEY.rule}`, borderRadius: 3, padding: '1px 5px', fontSize: 11, fontFamily: 'inherit', outline: 'none' }} />
    </div>
  )
}
function ProviderAmount({ value, onSave }: { value: number; onSave: (v: number) => void }) {
  const [v, setV] = useState(String(value))
  useEffect(() => { setV(String(value)) }, [value])
  return <input type="number" value={v} onChange={(e) => setV(e.target.value)} onBlur={() => { const n = num(v); if (n > 0 && n !== value) onSave(n) }}
    style={{ width: 82, textAlign: 'right', border: `1px solid ${MONEY.rule}`, borderRadius: 3, padding: '1px 4px', fontSize: 11, fontFamily: 'inherit', outline: 'none', color: MONEY.down, fontWeight: 700 }} />
}

function NuModal({ saved, movements, onClose, onCuadrar }: { saved: number; movements: Move[]; onClose: () => void; onCuadrar: (bank: number) => void }) {
  const [bank, setBank] = useState('')
  const chron = [...movements].sort((a, b) => a.date.localeCompare(b.date))
  let run = 0
  const rows = chron.map((m) => { run += m.flow === 'out' ? m.amount : -m.amount; return { ...m, run } }).reverse()
  const dif = bank.trim() === '' ? null : num(bank) - saved
  return (
    <MoneyModal title="Libreta · Cuenta Nu" width={430} onClose={onClose}>
      <div style={{ display: 'flex', alignItems: 'flex-end', gap: 6, marginBottom: 9 }}>
        <label style={{ display: 'flex', flexDirection: 'column', gap: 3, fontSize: 10.5, color: '#5a6a86', flex: 1 }}>¿Qué dice Nu?<MoneyInput type="number" value={bank} onChange={(e) => setBank(e.target.value)} placeholder={fmtMxn(saved)} /></label>
        {dif !== null && dif !== 0 && <span style={{ fontSize: 10.5, color: dif > 0 ? MONEY.up : MONEY.down, paddingBottom: 4 }}>{dif > 0 ? 'sobra ' : 'falta '}{fmtMxn(Math.abs(dif))}</span>}
        <MoneyBtn primary disabled={dif === null || dif === 0} onClick={() => bank.trim() !== '' && onCuadrar(num(bank))}>Cuadrar</MoneyBtn>
      </div>
      <div style={{ border: `1px solid ${MONEY.rule}`, maxHeight: 220, overflowY: 'auto' }}>
        <div style={{ display: 'flex', background: `linear-gradient(${MONEY.barFrom},${MONEY.barTo})`, color: '#fff', fontWeight: 700, fontSize: 10, padding: '2px 7px', position: 'sticky', top: 0 }}>
          <span style={{ width: 52 }}>Fecha</span><span style={{ flex: 1 }}>Concepto</span><span style={{ width: 62, textAlign: 'right' }}>Entra</span><span style={{ width: 62, textAlign: 'right' }}>Sale</span><span style={{ width: 72, textAlign: 'right' }}>Saldo</span>
        </div>
        {rows.length === 0 && <div style={{ padding: 7, color: '#8a93a8', fontStyle: 'italic' }}>Sin movimientos.</div>}
        {rows.map((m) => (
          <div key={m.id} style={{ display: 'flex', fontSize: 10.5, padding: '2px 7px', borderBottom: '1px solid #eef2f8' }}>
            <span style={{ width: 52, color: '#6a7690' }}>{m.date.slice(5)}</span>
            <span style={{ flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{m.description}</span>
            <span style={{ width: 62, textAlign: 'right', color: MONEY.up }}>{m.flow === 'out' ? fmtMxn(m.amount) : ''}</span>
            <span style={{ width: 62, textAlign: 'right', color: MONEY.down }}>{m.flow === 'in' ? fmtMxn(m.amount) : ''}</span>
            <span style={{ width: 72, textAlign: 'right', fontWeight: 600 }}>{fmtMxn(m.run)}</span>
          </div>
        ))}
      </div>
    </MoneyModal>
  )
}
