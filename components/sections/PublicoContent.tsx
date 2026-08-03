'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { mxn } from '@/components/Mxn'
import { useCajaFuerte } from '@/components/finance/useCajaFuerte'
import { FundLedger } from '@/components/finance/FundLedger'
import { FundMovementControl, type WalletOption } from '@/components/finance/FundMovementControl'
import type { Fund } from '@/components/finance/CajaFuerteSection'
import {
  COST_CATEGORIES, catDefaults, containerLabel, CONTAINERS, OPERATING_CATEGORIES,
  type CostCategory, type ContainerKey, type CostKind,
} from '@/lib/publico'

// Los 3 contenedores como cuentas para aportar/retirar de socios → captura el ORIGEN (metodo) desde el
// día 1, para que F5 (cuadre) pueda conciliar de dónde entró/salió cada aportación/distribución.
const SOCIO_ACCOUNTS: WalletOption[] = CONTAINERS.map((c) => ({ value: c.key, label: c.label }))

// ── Público Gourmet · FASE 1 ────────────────────────────────────────────────────────────────────
// Capa ejecutiva sobre el POS. El corazón NO son gráficas: es un formulario de captura <30s. Bloque
// fijo arriba, autofocus en ventas, Enter avanza/guarda, defaults inteligentes por categoría (sticky),
// cero navegación. Ventas desglosadas efectivo/tarjeta (origen: efectivo→Caja POS, tarjeta→CLIP).
// Cada costo trae su contenedor. Utilidad OPERATIVA = ventas − (insumo+nómina+gasto_fijo). Un solo
// componente adaptivo (tambor + ventana XP vía tokens de tema); el reskin MSN-Money es polish futuro.

const localDate = (d = new Date()) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
const addDays = (iso: string, n: number) => { const d = new Date(iso + 'T12:00:00'); d.setDate(d.getDate() + n); return localDate(d) }
const dayLabel = (iso: string) => {
  const d = new Date(iso + 'T12:00:00')
  return d.toLocaleDateString('es-MX', { weekday: 'short', day: '2-digit', month: 'short' })
}

interface Venta { id: string; date: string; efectivo: number; tarjeta: number; note: string | null }
interface Costo { id: string; date: string; category: CostCategory; cost_kind: CostKind | null; origin: ContainerKey; amount: number; note: string | null }

export default function PublicoContent() {
  const today = localDate()
  const [capDate, setCapDate] = useState(today)          // día que se está capturando (◀ hoy ▶)
  const month = capDate.slice(0, 7)
  const [ventas, setVentas] = useState<Venta[]>([])
  const [costos, setCostos] = useState<Costo[]>([])
  const [tab, setTab] = useState<'captura' | 'socios'>('captura')

  // Socios (F2): libretas Alex/Andrés = fondos scope 'publico' reusados. % de reparto en config aparte.
  const { funds: socioFunds, handlers: socioHandlers } = useCajaFuerte('publico', month)
  const [splitAlex, setSplitAlex] = useState(50)
  useEffect(() => { fetch('/api/publico/config').then((r) => r.json()).then((d) => setSplitAlex(Number(d.split_alex ?? 50))).catch(() => {}) }, [])
  async function saveSplit(v: number) {
    const s = Math.max(0, Math.min(100, Math.round(v)))
    setSplitAlex(s)
    await fetch('/api/publico/config', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ split_alex: s }) })
  }

  // ── Ventas (cierre del día) ──
  const [efectivo, setEfectivo] = useState('')
  const [tarjeta, setTarjeta] = useState('')
  const [savedFlash, setSavedFlash] = useState(false)
  const efectivoRef = useRef<HTMLInputElement>(null)
  const tarjetaRef = useRef<HTMLInputElement>(null)

  // ── Costo (adder burst) ──
  const [cAmt, setCAmt] = useState('')
  const [cCat, setCCat] = useState<CostCategory>('insumo')          // sticky
  const [cOrigin, setCOrigin] = useState<ContainerKey>(catDefaults('insumo').defaultOrigin)
  const [cKind, setCKind] = useState<CostKind>(catDefaults('insumo').defaultKind ?? 'variable')
  const [cNote, setCNote] = useState('')
  const cAmtRef = useRef<HTMLInputElement>(null)

  const load = useCallback(async () => {
    const r = await fetch(`/api/publico?month=${month}&today=${capDate}`).then((r) => r.json()).catch(() => null)
    if (!r) return
    setVentas(r.ventas ?? [])
    setCostos(r.costos ?? [])
    const hoy: Venta | null = r.ventas?.find((v: Venta) => v.date === capDate) ?? null
    setEfectivo(hoy && hoy.efectivo ? String(hoy.efectivo) : '')
    setTarjeta(hoy && hoy.tarjeta ? String(hoy.tarjeta) : '')
  }, [month, capDate])

  useEffect(() => { void load() }, [load])
  useEffect(() => { efectivoRef.current?.focus() }, [])   // autofocus al abrir: el cierre es lo que haces siempre

  // Al cambiar categoría, resetea origen+naturaleza a los defaults de ESA categoría (sticky después).
  function pickCat(cat: CostCategory) {
    const d = catDefaults(cat)
    setCCat(cat); setCOrigin(d.defaultOrigin); setCKind(d.defaultKind ?? 'variable')
    cAmtRef.current?.focus()
  }

  async function saveVenta() {
    const ef = parseFloat(efectivo || '0'), ta = parseFloat(tarjeta || '0')
    if ((!ef && !ta) || ef < 0 || ta < 0) return
    await fetch('/api/publico/venta', {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ date: capDate, efectivo: ef || 0, tarjeta: ta || 0 }),
    })
    setSavedFlash(true); setTimeout(() => setSavedFlash(false), 1400)
    await load()
  }

  async function addCosto() {
    const a = parseFloat(cAmt)
    if (!a || a <= 0) return
    const note = cNote
    setCAmt(''); setCNote('')            // limpia YA (antes del await): tecleo rápido en burst NO concatena montos
    await fetch('/api/publico/costo', {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ date: capDate, category: cCat, cost_kind: cCat === 'reinversion' ? null : cKind, origin: cOrigin, amount: a, note: note || null }),
    })
    await load()
    cAmtRef.current?.focus()             // burst: listo para el siguiente (categoría/origen quedan sticky)
  }

  async function delCosto(id: string) {
    await fetch(`/api/publico/costo?id=${id}`, { method: 'DELETE' }); await load()
  }

  // ── Totales del mes ──
  const ventasMes = ventas.reduce((s, v) => s + Number(v.efectivo) + Number(v.tarjeta), 0)
  const costosOper = costos.filter((c) => OPERATING_CATEGORIES.includes(c.category)).reduce((s, c) => s + Number(c.amount), 0)
  const reinversionMes = costos.filter((c) => c.category === 'reinversion').reduce((s, c) => s + Number(c.amount), 0)
  const utilidadOper = ventasMes - costosOper
  const costosHoy = costos.filter((c) => c.date === capDate)

  const chip = (on: boolean): React.CSSProperties => ({
    padding: '3px 9px', borderRadius: 999, fontSize: 12, cursor: 'pointer', border: '1px solid',
    borderColor: on ? 'transparent' : 'var(--color-border, #cbd2e0)',
    background: on ? '#c0392b' : 'transparent', color: on ? '#fff' : 'inherit', whiteSpace: 'nowrap',
  })
  const numInput: React.CSSProperties = {
    width: '100%', padding: '8px 10px', fontSize: 18, fontVariantNumeric: 'tabular-nums',
    borderRadius: 8, border: '1px solid var(--color-border, #cbd2e0)', background: 'var(--color-surface-base, #fff)', color: 'inherit',
  }

  return (
    <div data-theme-scope="publico" className="mx-auto flex max-w-2xl flex-col gap-4 p-4 text-fg">
      <header className="flex items-baseline justify-between">
        <h1 className="text-xl font-bold">Público Gourmet</h1>
        <div className="flex gap-1">
          <button onClick={() => setTab('captura')} style={chip(tab === 'captura')}>Captura</button>
          <button onClick={() => setTab('socios')} style={chip(tab === 'socios')}>Socios</button>
        </div>
      </header>

      {tab === 'captura' && (<>
      {/* ── CIERRE DE HOY ── */}
      <section className="rounded-card border border-border bg-surface-2 p-3">
        <div className="mb-2 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-label font-bold uppercase tracking-widest text-fg-muted">Cierre</span>
            <button onClick={() => setCapDate((d) => addDays(d, -1))} className="px-1 text-fg-muted hover:text-fg" aria-label="Día anterior">◀</button>
            <button onClick={() => setCapDate(today)} className={`text-secondary ${capDate === today ? 'font-bold text-fg' : 'text-fg-muted'}`}>
              {capDate === today ? 'hoy' : dayLabel(capDate)}
            </button>
            <button onClick={() => setCapDate((d) => addDays(d, +1) > today ? today : addDays(d, +1))} className="px-1 text-fg-muted hover:text-fg" aria-label="Día siguiente">▶</button>
          </div>
          {savedFlash && <span className="text-secondary font-medium text-ok">✓ guardado</span>}
        </div>
        <div className="flex items-end gap-3">
          <label className="flex-1">
            <span className="text-label text-fg-muted">Efectivo</span>
            <input
              ref={efectivoRef} value={efectivo} onChange={(e) => setEfectivo(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') tarjetaRef.current?.focus() }}
              inputMode="decimal" placeholder="0" style={numInput}
            />
          </label>
          <label className="flex-1">
            <span className="text-label text-fg-muted">Tarjeta</span>
            <input
              ref={tarjetaRef} value={tarjeta} onChange={(e) => setTarjeta(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') void saveVenta() }}
              inputMode="decimal" placeholder="0" style={numInput}
            />
          </label>
          <button onClick={() => void saveVenta()} className="rounded-card bg-[#c0392b] px-4 py-2 font-bold text-white">Guardar</button>
        </div>
        <div className="mt-1 text-right text-label text-fg-muted">
          Total {mxn((parseFloat(efectivo || '0') || 0) + (parseFloat(tarjeta || '0') || 0))}
        </div>
      </section>

      {/* ── AGREGAR COSTO ── */}
      <section className="rounded-card border border-border bg-surface-2 p-3">
        <div className="mb-2 flex flex-wrap items-center gap-1.5">
          {COST_CATEGORIES.map((c) => (
            <button key={c.key} onClick={() => pickCat(c.key)} style={chip(cCat === c.key)}>{c.label}</button>
          ))}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <input
            ref={cAmtRef} value={cAmt} onChange={(e) => setCAmt(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') void addCosto() }}
            inputMode="decimal" placeholder="$ monto" style={{ ...numInput, width: 120, fontSize: 16 }}
          />
          <span className="text-label text-fg-muted">desde</span>
          {CONTAINERS.map((ct) => (
            <button key={ct.key} onClick={() => setCOrigin(ct.key)} style={chip(cOrigin === ct.key)}>{ct.label}</button>
          ))}
          {cCat !== 'reinversion' && (
            <button
              onClick={() => setCKind((k) => (k === 'fijo' ? 'variable' : 'fijo'))}
              className="text-label text-fg-muted underline decoration-dotted"
              title="fijo/variable (para el punto de equilibrio); tap para cambiar"
            >{cKind}</button>
          )}
          <input
            value={cNote} onChange={(e) => setCNote(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') void addCosto() }}
            placeholder="nota (opc)" style={{ ...numInput, flex: 1, minWidth: 90, fontSize: 14 }}
          />
          <button onClick={() => void addCosto()} className="rounded-card border border-border px-3 py-2 font-medium">Agregar</button>
        </div>
      </section>

      {/* ── HOY: lo capturado ── */}
      <section className="rounded-card border border-border p-3">
        <h2 className="mb-2 text-label font-bold uppercase tracking-widest text-fg-muted">{capDate === today ? 'Hoy' : dayLabel(capDate)}</h2>
        {costosHoy.length === 0 && <p className="text-secondary italic text-fg-muted">Sin costos capturados este día.</p>}
        <div className="space-y-1">
          {costosHoy.map((c) => (
            <div key={c.id} className="group flex items-center gap-2 text-secondary">
              <span className="w-24 text-fg-muted">{catDefaults(c.category).label}</span>
              <span className="flex-1 truncate">{c.note || <span className="text-fg-muted">—</span>} <span className="text-fg-muted">· {containerLabel(c.origin)}</span></span>
              <span className="tabular-nums text-danger">−{mxn(Number(c.amount))}</span>
              <button onClick={() => void delCosto(c.id)} className="opacity-0 transition-opacity group-hover:opacity-100 text-fg-muted hover:text-danger" aria-label="Borrar">✕</button>
            </div>
          ))}
        </div>
      </section>

      {/* ── MES: totales simples (F1) ── */}
      <section className="rounded-card border border-border bg-surface-2 p-3">
        <h2 className="mb-2 text-label font-bold uppercase tracking-widest text-fg-muted">Mes · {month}</h2>
        <div className="grid grid-cols-2 gap-y-1 text-secondary">
          <span className="text-fg-muted">Ventas</span><span className="text-right tabular-nums text-ok">{mxn(ventasMes)}</span>
          <span className="text-fg-muted">Costos operativos</span><span className="text-right tabular-nums text-danger">−{mxn(costosOper)}</span>
          <span className="font-bold text-fg">Utilidad operativa</span><span className={`text-right font-bold tabular-nums ${utilidadOper >= 0 ? 'text-ok' : 'text-danger'}`}>{mxn(utilidadOper)}</span>
        </div>
        {reinversionMes > 0 && (
          <div className="mt-2 flex justify-between border-t border-border pt-2 text-label text-fg-muted">
            <span>Reinversión (aparte, no resta utilidad)</span><span className="tabular-nums">{mxn(reinversionMes)}</span>
          </div>
        )}
      </section>
      </>)}

      {tab === 'socios' && (
        <Socios funds={socioFunds} handlers={socioHandlers} splitAlex={splitAlex} onSplit={saveSplit} utilidadOper={utilidadOper} />
      )}
    </div>
  )
}

// ── Socios (F2): las dos libretas (reusan FundLedger/FundMovementControl) + % de reparto configurable
// + reparto sugerido de la utilidad (SOLO LECTURA — guía, no crea asientos; el % es provisional). El
// origen (contenedor) se captura en cada aportación/retiro para el cuadre de F5. ──
function Socios({ funds, handlers, splitAlex, onSplit, utilidadOper }: {
  funds: Fund[]
  handlers: ReturnType<typeof useCajaFuerte>['handlers']
  splitAlex: number
  onSplit: (v: number) => void
  utilidadOper: number
}) {
  const socios = [{ key: 'socio_alex', pct: splitAlex }, { key: 'socio_andres', pct: 100 - splitAlex }]
  return (
    <>
      {socios.map(({ key }) => {
        const f = funds.find((x) => x.key === key)
        if (!f) return <p key={key} className="text-secondary italic text-fg-muted">Falta el fondo {key} — ¿corriste la migración 0053?</p>
        return (
          <section key={key} className="rounded-card border border-border bg-surface-2 p-3">
            <div className="mb-2 flex items-baseline justify-between">
              <h2 className="text-base font-bold">{f.label}</h2>
              <span className="text-secondary text-fg-muted">saldo <span className="font-bold tabular-nums text-fg">{mxn(f.saved)}</span></span>
            </div>
            <FundMovementControl accounts={SOCIO_ACCOUNTS} onSubmit={(flow, desc, amount, metodo) => handlers.onAportaRetira(f.id, flow, desc, amount, metodo)} />
            <div className="mt-3"><FundLedger movements={f.movements} /></div>
          </section>
        )
      })}

      <section className="rounded-card border border-border p-3">
        <h2 className="mb-2 text-label font-bold uppercase tracking-widest text-fg-muted">Reparto</h2>
        <div className="flex items-center gap-2 text-secondary">
          <span>Alex</span>
          <input
            type="number" min={0} max={100} value={splitAlex} onChange={(e) => onSplit(Number(e.target.value))}
            className="w-16 rounded border border-border bg-surface-base px-2 py-1 text-right tabular-nums"
          />
          <span className="text-fg-muted">% · Andrés {100 - splitAlex}%</span>
        </div>
        <div className="mt-2 border-t border-border pt-2 text-secondary">
          <div className="text-label text-fg-muted">Reparto sugerido de la utilidad del mes ({mxn(utilidadOper)}) — guía, no crea asientos:</div>
          <div className="mt-1 flex justify-between"><span>Alex ({splitAlex}%)</span><span className="tabular-nums">{mxn(utilidadOper * splitAlex / 100)}</span></div>
          <div className="flex justify-between"><span>Andrés ({100 - splitAlex}%)</span><span className="tabular-nums">{mxn(utilidadOper * (100 - splitAlex) / 100)}</span></div>
        </div>
      </section>
    </>
  )
}
