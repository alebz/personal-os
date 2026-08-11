'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { mxn } from '@/components/Mxn'
import { useCajaFuerte } from '@/components/finance/useCajaFuerte'
import { FundLedger } from '@/components/finance/FundLedger'
import { FundMovementControl, type WalletOption } from '@/components/finance/FundMovementControl'
import type { Fund } from '@/components/finance/CajaFuerteSection'
import {
  COST_CATEGORIES, catDefaults, originLabel, ORIGIN_OPTIONS, CONTAINERS, OPERATING_CATEGORIES,
  type CostCategory, type OriginKey, type CostKind,
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

interface Venta { id: string; date: string; efectivo: number; tarjeta: number; note: string | null; source?: 'manual' | 'poster' }
interface Costo { id: string; date: string; category: CostCategory; cost_kind: CostKind | null; origin: OriginKey; amount: number; note: string | null }
interface Ingreso { id: string; date: string; concepto: string; amount: number; origin: OriginKey; note: string | null }

export default function PublicoContent() {
  const today = localDate()
  const [capDate, setCapDate] = useState(today)          // día que se está capturando (◀ hoy ▶)
  const month = capDate.slice(0, 7)
  const [ventas, setVentas] = useState<Venta[]>([])
  const [costos, setCostos] = useState<Costo[]>([])
  const [ingresos, setIngresos] = useState<Ingreso[]>([])
  const [tab, setTab] = useState<'captura' | 'socios' | 'direccion'>('captura')

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
  // ── Sincronización con Poster POS (heartbeat + import manual) ──
  const [sync, setSync] = useState<{ last_success_at: string | null; last_import_date: string | null; last_error: string | null } | null>(null)
  const [importing, setImporting] = useState(false)
  const loadSync = useCallback(async () => { const s = await fetch('/api/publico/poster/import').then((r) => r.json()).catch(() => null); if (s) setSync(s) }, [])
  useEffect(() => { void loadSync() }, [loadSync])
  async function importNow() {
    setImporting(true)
    try { await fetch('/api/publico/poster/import?days=14', { method: 'POST' }); await load(); await loadSync() }
    finally { setImporting(false) }
  }

  // ── Costo (adder burst) ──
  const [cAmt, setCAmt] = useState('')
  const [cCat, setCCat] = useState<CostCategory>('insumo')          // sticky
  const [cOrigin, setCOrigin] = useState<OriginKey>(catDefaults('insumo').defaultOrigin)
  const [cKind, setCKind] = useState<CostKind>(catDefaults('insumo').defaultKind ?? 'variable')
  const [cNote, setCNote] = useState('')
  const cAmtRef = useRef<HTMLInputElement>(null)

  // ── Otros ingresos (no-POS: subarriendo Ameno, etc.) ──
  const [iConcepto, setIConcepto] = useState('')
  const [iAmt, setIAmt] = useState('')
  const [iOrigin, setIOrigin] = useState<OriginKey>('clip')
  const iAmtRef = useRef<HTMLInputElement>(null)

  const load = useCallback(async () => {
    const r = await fetch(`/api/publico?month=${month}&today=${capDate}`).then((r) => r.json()).catch(() => null)
    if (!r) return
    setVentas(r.ventas ?? [])
    setCostos(r.costos ?? [])
    setIngresos(r.ingresos ?? [])
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
      body: JSON.stringify({ date: capDate, category: cCat, cost_kind: catDefaults(cCat).defaultKind === null ? null : cKind, origin: cOrigin, amount: a, note: note || null }),
    })
    await load()
    cAmtRef.current?.focus()             // burst: listo para el siguiente (categoría/origen quedan sticky)
  }

  async function delCosto(id: string) {
    await fetch(`/api/publico/costo?id=${id}`, { method: 'DELETE' }); await load()
  }

  async function addIngreso() {
    const a = parseFloat(iAmt)
    if (!iConcepto.trim() || !a || a <= 0) return
    const concepto = iConcepto.trim()
    setIConcepto(''); setIAmt('')         // limpia YA (antes del await): burst no concatena
    await fetch('/api/publico/ingreso', {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ date: capDate, concepto, amount: a, origin: iOrigin }),
    })
    await load()
    iAmtRef.current?.focus()
  }
  async function delIngreso(id: string) {
    await fetch(`/api/publico/ingreso?id=${id}`, { method: 'DELETE' }); await load()
  }

  // ── Totales del mes ──
  const ventasMes = ventas.reduce((s, v) => s + Number(v.efectivo) + Number(v.tarjeta), 0)
  const costosOper = costos.filter((c) => OPERATING_CATEGORIES.includes(c.category)).reduce((s, c) => s + Number(c.amount), 0)
  const reinversionMes = costos.filter((c) => c.category === 'reinversion').reduce((s, c) => s + Number(c.amount), 0)
  const rentaCondonadaMes = costos.filter((c) => c.category === 'renta_condonada').reduce((s, c) => s + Number(c.amount), 0)
  const otrosIngresosMes = ingresos.reduce((s, i) => s + Number(i.amount), 0)
  const utilidadOper = ventasMes - costosOper                            // limpia (food business); food cost % intacto
  const utilidadTotal = utilidadOper + otrosIngresosMes - rentaCondonadaMes  // no-operativos (arreglo Ameno netea 0)
  const costosHoy = costos.filter((c) => c.date === capDate)
  const ingresosHoy = ingresos.filter((i) => i.date === capDate)
  const hoyV = ventas.find((v) => v.date === capDate)                       // el día visto (para el badge de procedencia)
  const lastOk = sync?.last_success_at ? new Date(sync.last_success_at) : null
  const daysSince = lastOk ? Math.floor((Date.now() - lastOk.getTime()) / 86400000) : null
  const syncStale = !!sync?.last_error || daysSince == null || daysSince >= 2   // avisa si falló o lleva ≥2 días sin traer nada

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
          <button onClick={() => setTab('direccion')} style={chip(tab === 'direccion')}>Dirección</button>
          <button onClick={() => setTab('socios')} style={chip(tab === 'socios')}>Socios</button>
        </div>
      </header>

      {/* ── Sincronización con Poster POS: heartbeat visible + import manual (que no falle en silencio) ── */}
      <div className="flex items-center justify-between rounded-card border border-border bg-surface-2 px-3 py-1.5 text-label">
        <span className={syncStale ? 'text-danger' : 'text-fg-muted'}>
          {sync?.last_error
            ? `⚠ Import falló: ${sync.last_error}`
            : sync?.last_success_at
              ? `POS · último import ${daysSince === 0 ? 'hoy' : daysSince === 1 ? 'ayer' : `hace ${daysSince} días`}${syncStale ? ' — revisa' : ''}`
              : 'POS · sin importar aún'}
        </span>
        <button onClick={() => void importNow()} disabled={importing} className="shrink-0 rounded-control px-2 py-0.5 text-fg-muted transition-colors hover:text-accent disabled:opacity-50">{importing ? 'importando…' : 'importar ahora'}</button>
      </div>

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
            {hoyV && <span className={`rounded px-1.5 py-0.5 text-label font-medium ${hoyV.source === 'poster' ? 'bg-accent/15 text-accent' : 'bg-surface-active text-fg-muted'}`} title={hoyV.source === 'poster' ? 'Importado del POS' : 'Capturado a mano'}>{hoyV.source === 'poster' ? 'POS' : 'manual'}</span>}
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
          {ORIGIN_OPTIONS.map((ct) => (
            <button key={ct.label} onClick={() => setCOrigin(ct.key)} style={chip(cOrigin === ct.key)}>{ct.label}</button>
          ))}
          {catDefaults(cCat).defaultKind !== null && (
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
        <div className="mt-2 border-t border-border pt-2"><TicketFoto onSaved={load} defaultDate={capDate} /></div>
      </section>

      {/* ── OTROS INGRESOS (no-POS: subarriendo, etc.) — NUNCA cuentan como venta (food cost intacto) ── */}
      <section className="rounded-card border border-border bg-surface-2 p-3">
        <div className="mb-2 text-label font-bold uppercase tracking-widest text-fg-muted">Otros ingresos <span className="font-normal normal-case tracking-normal">(no-POS)</span></div>
        <div className="flex flex-wrap items-center gap-2">
          <input
            value={iConcepto} onChange={(e) => setIConcepto(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') void addIngreso() }}
            placeholder="Concepto (ej. Subarriendo Ameno)" style={{ ...numInput, flex: 1, minWidth: 160, fontSize: 14 }}
          />
          <input
            ref={iAmtRef} value={iAmt} onChange={(e) => setIAmt(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') void addIngreso() }}
            inputMode="decimal" placeholder="$ monto" style={{ ...numInput, width: 120, fontSize: 16 }}
          />
          <span className="text-label text-fg-muted">a</span>
          {ORIGIN_OPTIONS.map((ct) => (
            <button key={ct.label} onClick={() => setIOrigin(ct.key)} style={chip(iOrigin === ct.key)}>{ct.label}</button>
          ))}
          <button onClick={() => void addIngreso()} className="rounded-card border border-border px-3 py-2 font-medium">Agregar</button>
        </div>
        <div className="mt-1 text-label text-fg-muted">Suman a la utilidad, nunca a las ventas. El subarriendo que cubre la renta va con origen <b>Sin caja</b>.</div>
      </section>

      {/* ── HOY: lo capturado ── */}
      <section className="rounded-card border border-border p-3">
        <h2 className="mb-2 text-label font-bold uppercase tracking-widest text-fg-muted">{capDate === today ? 'Hoy' : dayLabel(capDate)}</h2>
        {costosHoy.length === 0 && ingresosHoy.length === 0 && <p className="text-secondary italic text-fg-muted">Sin costos ni otros ingresos este día.</p>}
        <div className="space-y-1">
          {ingresosHoy.map((i) => (
            <div key={i.id} className="group flex items-center gap-2 text-secondary">
              <span className="w-24 text-fg-muted">Otro ingreso</span>
              <span className="flex-1 truncate">{i.concepto} <span className="text-fg-muted">· {originLabel(i.origin)}</span></span>
              <span className="tabular-nums text-ok">+{mxn(Number(i.amount))}</span>
              <button onClick={() => void delIngreso(i.id)} className="opacity-0 transition-opacity group-hover:opacity-100 text-fg-muted hover:text-danger" aria-label="Borrar">✕</button>
            </div>
          ))}
          {costosHoy.map((c) => (
            <div key={c.id} className="group flex items-center gap-2 text-secondary">
              <span className="w-24 text-fg-muted">{catDefaults(c.category).label}</span>
              <span className="flex-1 truncate">{c.note || <span className="text-fg-muted">—</span>} <span className="text-fg-muted">· {originLabel(c.origin)}</span></span>
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
          <span className="font-medium text-fg">Utilidad operativa</span><span className={`text-right font-medium tabular-nums ${utilidadOper >= 0 ? 'text-ok' : 'text-danger'}`}>{mxn(utilidadOper)}</span>
          {(otrosIngresosMes > 0 || rentaCondonadaMes > 0) && (<>
            {otrosIngresosMes > 0 && <><span className="text-fg-muted">+ Otros ingresos</span><span className="text-right tabular-nums text-ok">+{mxn(otrosIngresosMes)}</span></>}
            {rentaCondonadaMes > 0 && <><span className="text-fg-muted">− Renta condonada</span><span className="text-right tabular-nums text-danger">−{mxn(rentaCondonadaMes)}</span></>}
            <span className="font-bold text-fg">Utilidad</span><span className={`text-right font-bold tabular-nums ${utilidadTotal >= 0 ? 'text-ok' : 'text-danger'}`}>{mxn(utilidadTotal)}</span>
          </>)}
        </div>
        {reinversionMes > 0 && (
          <div className="mt-2 flex justify-between border-t border-border pt-2 text-label text-fg-muted">
            <span>Reinversión (aparte, no resta utilidad)</span><span className="tabular-nums">{mxn(reinversionMes)}</span>
          </div>
        )}
      </section>

      <AliasManager />
      </>)}

      {tab === 'direccion' && (<><Direccion /><FoodCostPanel /></>)}

      {tab === 'socios' && (
        <Socios funds={socioFunds} handlers={socioHandlers} splitAlex={splitAlex} onSplit={saveSplit} utilidadOper={utilidadOper} />
      )}
    </div>
  )
}

// ── Dirección (F3): vista ejecutiva sobre dash.getTransactions (recibo por recibo) + menu.getProducts. Todo
// se agrupa por día natural CDMX vía el epoch date_close (ver lib/posterMetrics: date_close_date NO se usa).
// Denominador de cualquier promedio por día = días operados (con ≥1 recibo), nunca días de calendario. ──
type ProductStat = { id: string; name: string; units: number; revenue: number; cost: number; profit: number; margin: number }
type HourStat = { hour: number; receipts: number; revenue: number }
type DowStat = { dow: number; label: string; receipts: number; revenue: number }
type Metrics = {
  range: { from: string; to: string; calendarDays: number }
  daysOperated: number; receipts: number; ventaTotal: number; ticketPromedio: number
  ventaPorDiaOperado: number; guestsPromedio: number
  margin: { revenue: number; cost: number; profit: number; pct: number }
  topProducts: ProductStat[]; hours: HourStat[]; dow: DowStat[]
  guardian: { count: number; receipts: Array<{ id: string; date: string; time: string; sum: number }> }
}

function Bar({ value, max, label, right }: { value: number; max: number; label: string; right: string }) {
  const pct = max > 0 ? Math.max(2, (value / max) * 100) : 0
  return (
    <div className="flex items-center gap-2 text-secondary">
      <span className="w-10 shrink-0 text-fg-muted">{label}</span>
      <div className="h-4 flex-1 overflow-hidden rounded bg-surface-active">
        <div className="h-full rounded bg-[#c0392b]" style={{ width: `${pct}%` }} />
      </div>
      <span className="w-24 shrink-0 text-right tabular-nums text-fg-muted">{right}</span>
    </div>
  )
}

function Direccion() {
  const [m, setM] = useState<Metrics | null>(null)
  const [err, setErr] = useState<string | null>(null)
  const [sortBy, setSortBy] = useState<'revenue' | 'units'>('revenue')

  useEffect(() => {
    let alive = true
    fetch('/api/publico/poster/metrics')
      .then((r) => r.json())
      .then((d) => { if (!alive) return; if (d.error) setErr(d.error); else setM(d) })
      .catch(() => alive && setErr('No se pudo cargar el POS'))
    return () => { alive = false }
  }, [])

  if (err) return <div className="rounded-card border border-border bg-surface-2 p-3 text-secondary text-danger">⚠ {err}</div>
  if (!m) return <div className="rounded-card border border-border bg-surface-2 p-3 text-secondary text-fg-muted">Cargando dirección…</div>

  const products = [...m.topProducts].sort((a, b) => (sortBy === 'revenue' ? b.revenue - a.revenue : b.units - a.units)).slice(0, 8)
  const maxProd = Math.max(1, ...products.map((p) => (sortBy === 'revenue' ? p.revenue : p.units)))
  const hoursActive = m.hours.filter((h) => h.receipts > 0)
  const maxHour = Math.max(1, ...hoursActive.map((h) => h.receipts))
  const dowOrder = [1, 2, 3, 4, 5, 6, 0]           // lun…dom
  const maxDow = Math.max(1, ...m.dow.map((d) => d.receipts))
  const closedDays = m.range.calendarDays - m.daysOperated

  return (
    <>
      {/* ── GUARDIÁN: cierres después de medianoche rompen el supuesto de "día natural" ── */}
      {m.guardian.count > 0 && (
        <div className="rounded-card border-2 border-danger bg-danger/10 p-3 text-secondary">
          <div className="font-bold text-danger">⚠ {m.guardian.count} recibo(s) cerraron entre 00:00 y 06:00 CDMX</div>
          <div className="mt-1 text-fg-muted">El supuesto de “día natural = getPaymentsReport” asume que se cierra antes de medianoche. Estos cruzan ese límite — revisa si la operación cambió de horario:</div>
          <div className="mt-1 space-y-0.5">
            {m.guardian.receipts.map((r) => (
              <div key={r.id} className="flex justify-between tabular-nums"><span>#{r.id} · {r.date} {r.time}</span><span>{mxn(r.sum)}</span></div>
            ))}
          </div>
        </div>
      )}

      {/* ── RESUMEN ── */}
      <section className="rounded-card border border-border bg-surface-2 p-3">
        <div className="mb-2 flex items-baseline justify-between">
          <h2 className="text-label font-bold uppercase tracking-widest text-fg-muted">Dirección</h2>
          <span className="text-label text-fg-muted">{m.range.from} → {m.range.to}</span>
        </div>
        <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-secondary sm:grid-cols-4">
          <div><div className="text-label text-fg-muted">Ticket promedio</div><div className="text-lg font-bold tabular-nums">{mxn(m.ticketPromedio)}</div></div>
          <div><div className="text-label text-fg-muted">Venta / día operado</div><div className="text-lg font-bold tabular-nums">{mxn(m.ventaPorDiaOperado)}</div></div>
          <div><div className="text-label text-fg-muted">Recibos</div><div className="text-lg font-bold tabular-nums">{m.receipts}</div></div>
          <div><div className="text-label text-fg-muted">Comensales prom.</div><div className="text-lg font-bold tabular-nums">{m.guestsPromedio.toFixed(1)}</div></div>
        </div>
        <div className="mt-2 border-t border-border pt-2 text-label text-fg-muted">
          <b className="text-fg">{m.daysOperated}</b> días operados de {m.range.calendarDays} de calendario ({closedDays} cerrados). Los promedios por día usan los {m.daysOperated} operados, no el calendario.
        </div>
      </section>

      {/* ── MARGEN TEÓRICO (food cost de las recetas del POS) ── */}
      <section className="rounded-card border border-border bg-surface-2 p-3">
        <h2 className="mb-2 text-label font-bold uppercase tracking-widest text-fg-muted">Margen teórico</h2>
        <div className="grid grid-cols-2 gap-y-1 text-secondary">
          <span className="text-fg-muted">Venta</span><span className="text-right tabular-nums text-ok">{mxn(m.margin.revenue)}</span>
          <span className="text-fg-muted">Costo de receta (teórico)</span><span className="text-right tabular-nums text-danger">−{mxn(m.margin.cost)}</span>
          <span className="font-medium text-fg">Utilidad bruta teórica</span><span className="text-right font-medium tabular-nums text-ok">{mxn(m.margin.profit)}</span>
          <span className="font-bold text-fg">Margen</span><span className="text-right font-bold tabular-nums">{m.margin.pct.toFixed(1)}%</span>
        </div>
        <div className="mt-2 border-t border-border pt-2 text-label text-fg-muted">Teórico = product_cost de las recetas. El real (vs compras) llega en F4.</div>
      </section>

      {/* ── TOP PRODUCTOS ── */}
      <section className="rounded-card border border-border bg-surface-2 p-3">
        <div className="mb-2 flex items-center justify-between">
          <h2 className="text-label font-bold uppercase tracking-widest text-fg-muted">Top productos</h2>
          <div className="flex gap-1">
            <button onClick={() => setSortBy('revenue')} className={`rounded px-2 py-0.5 text-label ${sortBy === 'revenue' ? 'bg-[#c0392b] text-white' : 'text-fg-muted'}`}>facturación</button>
            <button onClick={() => setSortBy('units')} className={`rounded px-2 py-0.5 text-label ${sortBy === 'units' ? 'bg-[#c0392b] text-white' : 'text-fg-muted'}`}>unidades</button>
          </div>
        </div>
        <div className="space-y-1.5">
          {products.map((p) => (
            <div key={p.id} className="text-secondary">
              <div className="flex items-baseline justify-between">
                <span className="truncate pr-2">{p.name}</span>
                <span className="shrink-0 tabular-nums text-fg-muted">{p.units.toFixed(0)} uds · <span className="text-fg">{mxn(p.revenue)}</span> · {p.margin.toFixed(0)}%</span>
              </div>
              <div className="mt-0.5 h-1.5 overflow-hidden rounded bg-surface-active">
                <div className="h-full rounded bg-[#c0392b]" style={{ width: `${((sortBy === 'revenue' ? p.revenue : p.units) / maxProd) * 100}%` }} />
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* ── HORAS PICO ── */}
      <section className="rounded-card border border-border bg-surface-2 p-3">
        <h2 className="mb-2 text-label font-bold uppercase tracking-widest text-fg-muted">Horas pico <span className="font-normal normal-case tracking-normal text-fg-muted">(cierre, CDMX)</span></h2>
        <div className="space-y-1">
          {hoursActive.map((h) => (
            <Bar key={h.hour} label={`${String(h.hour).padStart(2, '0')}h`} value={h.receipts} max={maxHour} right={`${h.receipts} · ${mxn(h.revenue)}`} />
          ))}
        </div>
      </section>

      {/* ── DÍA DE LA SEMANA ── */}
      <section className="rounded-card border border-border bg-surface-2 p-3">
        <h2 className="mb-2 text-label font-bold uppercase tracking-widest text-fg-muted">Día de la semana</h2>
        <div className="space-y-1">
          {dowOrder.map((d) => {
            const row = m.dow[d]
            return <Bar key={d} label={row.label} value={row.receipts} max={maxDow} right={`${row.receipts} · ${mxn(row.revenue)}`} />
          })}
        </div>
      </section>
    </>
  )
}

// ── Food cost real vs teórico (F4). Métrica principal = GAP. Teórico por MES (siempre, 99% cobertura);
// real+gap SOLO en PERIODOS entre conteos físicos (no por mes: el ajuste del conteo se contabiliza el día
// del conteo). Prefiere decir "no confiable" a un número falso. ──
type FCMonth = { month: string; sales: number; theoreticalPct: number }
type FCPeriod = { from: string; to: string; kind: 'arranque' | 'confiable' | 'abierto'; sales: number; theoreticalPct: number; realPct: number | null; gapPct: number | null; startupAdjustment?: number; note?: string }
type FCData = { theoreticalByMonth: FCMonth[]; periods: FCPeriod[]; lastCountDate: string | null; daysSinceCount: number | null; countAlert: boolean; anyReliable: boolean; todayStatus: string }

const KIND_BADGE: Record<FCPeriod['kind'], { dot: string; label: string; cls: string }> = {
  confiable: { dot: '🟢', label: 'acotado por conteos', cls: 'text-ok' },
  arranque: { dot: '🟡', label: 'arranque del sistema', cls: 'text-warn' },
  abierto: { dot: '⚪', label: 'en curso · sin conteo', cls: 'text-fg-muted' },
}
const MESES = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic']
const monthLabel = (m: string) => { const [y, mm] = m.split('-'); return `${MESES[Number(mm) - 1]} ${y}` }
const dayLabelShort = (iso: string) => { const [, mm, dd] = iso.split('-'); return `${Number(dd)} ${MESES[Number(mm) - 1]}` }

function FoodCostPanel() {
  const [d, setD] = useState<FCData | null>(null)
  const [err, setErr] = useState<string | null>(null)
  useEffect(() => {
    let alive = true
    fetch('/api/publico/foodcost').then((r) => r.json())
      .then((j) => { if (!alive) return; if (j.error) setErr(j.error); else setD(j) })
      .catch(() => alive && setErr('No se pudo cargar el food cost'))
    return () => { alive = false }
  }, [])

  if (err) return <section className="rounded-card border border-border bg-surface-2 p-3 text-secondary text-danger">⚠ {err}</section>
  if (!d) return <section className="rounded-card border border-border bg-surface-2 p-3 text-secondary text-fg-muted">Cargando food cost…</section>

  return (
    <section className="rounded-card border border-border bg-surface-2 p-3">
      <h2 className="mb-2 text-label font-bold uppercase tracking-widest text-fg-muted">Food cost · real vs teórico</h2>

      {/* Estado de hoy, sin adornos */}
      <div className={`mb-2 rounded-card border p-2 text-label ${d.anyReliable ? 'border-border text-fg-muted' : 'border-warn text-warn'}`}>{d.todayStatus}</div>

      {/* Aviso de conteo accionable */}
      {d.countAlert && (
        <div className="mb-2 rounded-card border border-danger bg-danger/10 p-2 text-label text-danger">🧮 Último conteo físico hace {d.daysSinceCount} días ({d.lastCountDate}). Hacer un conteo desbloquea el food cost real de este periodo.</div>
      )}

      {/* Real por PERIODO entre conteos (la métrica) */}
      <div className="mb-1 text-label text-fg-muted">Real por periodo de conteo</div>
      <div className="space-y-2">
        {d.periods.map((p, i) => {
          const b = KIND_BADGE[p.kind]
          return (
            <div key={i} className="rounded-card border border-border p-2">
              <div className="flex items-center justify-between">
                <span className="font-medium text-fg">{dayLabelShort(p.from)} → {dayLabelShort(p.to)}</span>
                <span className={`text-label ${b.cls}`}>{b.dot} {b.label}</span>
              </div>
              <div className="mt-1 flex flex-wrap items-baseline gap-x-4 gap-y-1 text-secondary">
                <span className="text-fg-muted">ventas <span className="tabular-nums text-fg">{mxn(p.sales)}</span></span>
                <span className="text-fg-muted">teórico <span className="tabular-nums font-medium text-fg">{p.theoreticalPct.toFixed(1)}%</span></span>
                {p.kind === 'confiable' && p.realPct != null && p.gapPct != null && (<>
                  <span className="text-fg-muted">real <span className="tabular-nums font-medium text-fg">{p.realPct.toFixed(1)}%</span></span>
                  <span className={`font-bold ${p.gapPct > 3 ? 'text-danger' : p.gapPct < -3 ? 'text-warn' : 'text-ok'}`}>gap {p.gapPct > 0 ? '+' : ''}{p.gapPct.toFixed(1)} pts</span>
                </>)}
                {p.kind === 'arranque' && p.startupAdjustment != null && <span className="text-warn">write-down inicial {mxn(p.startupAdjustment)} · sin gap</span>}
                {p.kind === 'abierto' && <span className="italic text-fg-muted">real pendiente de conteo</span>}
              </div>
              {p.note && <div className="mt-1 text-label text-fg-muted">{p.note}</div>}
            </div>
          )
        })}
      </div>

      {/* Teórico por mes: baseline siempre visible */}
      <div className="mb-1 mt-3 text-label text-fg-muted">Teórico por mes <span className="normal-case">(línea base, cobertura de receta 99%)</span></div>
      <div className="space-y-0.5">
        {d.theoreticalByMonth.map((m) => (
          <div key={m.month} className="flex items-baseline justify-between text-secondary">
            <span className="text-fg-muted">{monthLabel(m.month)}</span>
            <span className="tabular-nums"><span className="text-fg-muted">{mxn(m.sales)} · </span><span className="font-medium text-fg">{m.theoreticalPct.toFixed(1)}%</span></span>
          </div>
        ))}
      </div>

      <div className="mt-2 border-t border-border pt-2 text-label text-fg-muted">El gap (real − teórico) es merma + sobre-porción + desperdicio + robo. Solo es legítimo en periodos 🟢 cerrados entre dos conteos físicos.</div>
    </section>
  )
}

// ── Captura por FOTO del ticket: la IA PROPONE un borrador, tú corriges y CONFIRMAS, y hasta entonces se
// guarda el gasto (roll-up de 1 línea en publico_costos + detalle itemizado). Tus correcciones enseñan a
// los alias (la próxima vez llega ya traducido). NUNCA escribe sin confirmar. Alcance: Público. ──
type FotoItem = { codigo: string | null; descripcion: string; descripcion_raw: string | null; cantidad: number | null; unidad: string | null; precio_unitario: number | null; importe: number; es_descuento: boolean; categoria?: string | null; aliased?: boolean }
type FotoDraft = { proveedor: string; proveedor_raw: string; proveedor_rfc: string | null; sucursal: string | null; fecha: string | null; moneda: string; subtotal: number | null; descuento: number | null; impuestos: number | null; total: number | null; legibilidad: 'alta' | 'media' | 'baja'; notas: string | null; items: FotoItem[]; proveedorAliased: boolean }

function TicketFoto({ onSaved, defaultDate }: { onSaved: () => Promise<void> | void; defaultDate: string }) {
  const [busy, setBusy] = useState<'extract' | 'confirm' | null>(null)
  const [err, setErr] = useState<string | null>(null)
  const [img, setImg] = useState<{ b64: string; media: string } | null>(null)
  const [raw, setRaw] = useState<unknown>(null)
  const [model, setModel] = useState<string | null>(null)
  const [d, setD] = useState<FotoDraft | null>(null)
  const [cat, setCat] = useState<CostCategory>('insumo')
  const [origin, setOrigin] = useState<OriginKey>(catDefaults('insumo').defaultOrigin)
  const [dateApproved, setDateApproved] = useState(false)   // aprobación explícita de una fecha fuera de rango
  const fileRef = useRef<HTMLInputElement>(null)

  // Guardián de fecha: futuro o >60 días atrás = sospechosa. Una fecha mal leída ensucia el food cost de
  // dos meses sin hacer ruido, así que no deja confirmar hasta que la corrijas o la apruebes.
  const todayLocal = localDate()
  const floor60 = addDays(todayLocal, -60)
  const dateSuspect = !!d?.fecha && (d.fecha > todayLocal || d.fecha < floor60)
  const dateBlocked = dateSuspect && !dateApproved

  function reset() { setImg(null); setRaw(null); setModel(null); setD(null); setErr(null); setBusy(null); setDateApproved(false); if (fileRef.current) fileRef.current.value = '' }

  async function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]; if (!file) return
    setErr(null); setBusy('extract'); setD(null)
    try {
      const dataUrl: string = await new Promise((res, rej) => { const r = new FileReader(); r.onload = () => res(String(r.result)); r.onerror = rej; r.readAsDataURL(file) })
      const b64 = dataUrl.split(',')[1]; const media = dataUrl.slice(5, dataUrl.indexOf(';'))
      setImg({ b64, media })
      const resp = await fetch('/api/publico/ticket/extract', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ imageBase64: b64, mediaType: media }) })
      const j = await resp.json()
      if (!resp.ok) { setErr(j.error ?? 'extracción falló'); setBusy(null); return }
      setRaw(j.raw); setModel(j.model)
      const draft: FotoDraft = j.draft
      if (!draft.fecha) draft.fecha = defaultDate
      setD(draft)
    } catch (e2) { setErr(e2 instanceof Error ? e2.message : 'no se pudo leer la foto') }
    finally { setBusy((b) => (b === 'extract' ? null : b)) }
  }

  function patch(p: Partial<FotoDraft>) { setD((cur) => (cur ? { ...cur, ...p } : cur)) }
  function patchItem(i: number, p: Partial<FotoItem>) { setD((cur) => (cur ? { ...cur, items: cur.items.map((it, k) => (k === i ? { ...it, ...p } : it)) } : cur)) }
  function delItem(i: number) { setD((cur) => (cur ? { ...cur, items: cur.items.filter((_, k) => k !== i) } : cur)) }

  const itemsSum = d ? d.items.reduce((s, it) => s + (it.es_descuento ? -1 : 1) * (Number(it.importe) || 0), 0) : 0
  const totalNum = d && d.total != null ? Number(d.total) : 0
  const mismatch = d && Math.abs(itemsSum - totalNum) > 0.5   // aviso suave si las líneas no suman al total

  async function confirm() {
    if (!d) return
    setBusy('confirm'); setErr(null)
    try {
      const resp = await fetch('/api/publico/ticket/confirm', {
        method: 'POST', headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          raw, model, proveedor: d.proveedor, proveedor_raw: d.proveedor_raw, fecha: d.fecha,
          subtotal: d.subtotal, descuento: d.descuento, impuestos: d.impuestos, total: d.total,
          legibilidad: d.legibilidad, notas: d.notas, category: cat, cost_kind: catDefaults(cat).defaultKind, origin,
          items: d.items, imageBase64: img?.b64, mediaType: img?.media, fecha_approved: dateApproved,
        }),
      })
      const j = await resp.json()
      if (!resp.ok) { setErr(j.error ?? 'no se pudo guardar'); setBusy(null); return }
      await onSaved()
      reset()
    } catch (e2) { setErr(e2 instanceof Error ? e2.message : 'no se pudo guardar'); setBusy(null) }
  }

  const legColor = d?.legibilidad === 'alta' ? 'text-ok' : d?.legibilidad === 'baja' ? 'text-danger' : 'text-fg-muted'
  const cell: React.CSSProperties = { padding: '4px 6px', fontSize: 13, borderRadius: 6, border: '1px solid var(--color-border, #cbd2e0)', background: 'var(--color-surface-base, #fff)', color: 'inherit' }
  const fotoChip = (on: boolean): React.CSSProperties => ({ padding: '2px 8px', borderRadius: 999, fontSize: 12, cursor: 'pointer', border: '1px solid', borderColor: on ? 'transparent' : 'var(--color-border, #cbd2e0)', background: on ? '#c0392b' : 'transparent', color: on ? '#fff' : 'inherit', whiteSpace: 'nowrap' })

  return (
    <div>
      <input ref={fileRef} type="file" accept="image/*" capture="environment" onChange={onFile} className="hidden" />
      {!d && (
        <div className="flex items-center gap-2">
          <button onClick={() => fileRef.current?.click()} disabled={busy === 'extract'} className="rounded-card border border-border px-3 py-1.5 text-secondary font-medium disabled:opacity-50">
            {busy === 'extract' ? 'leyendo el ticket…' : '📷 Capturar por foto del ticket'}
          </button>
          <span className="text-label text-fg-muted">la IA propone, tú confirmas</span>
        </div>
      )}
      {err && <div className="mt-2 text-secondary text-danger">⚠ {err}</div>}

      {d && (
        <div className="mt-1 space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-label font-bold uppercase tracking-widest text-fg-muted">Borrador del ticket <span className="font-normal normal-case tracking-normal">— revisa y confirma</span></span>
            <span className={`text-label ${legColor}`}>legibilidad {d.legibilidad}</span>
          </div>
          {d.notas && <div className="rounded-card border border-border bg-surface-2 p-2 text-label text-fg-muted">📝 {d.notas}</div>}

          {/* Proveedor + fecha */}
          <div className="flex flex-wrap items-end gap-2">
            <label className="flex-1">
              <span className="text-label text-fg-muted">Proveedor {d.proveedorAliased && <span className="text-ok">· alias aplicado</span>}{!d.proveedorAliased && d.proveedor_raw && <span className="text-fg-muted"> · IA: {d.proveedor_raw}</span>}</span>
              <input value={d.proveedor} onChange={(e) => patch({ proveedor: e.target.value })} style={{ ...cell, width: '100%', fontSize: 15 }} />
            </label>
            <label>
              <span className="text-label text-fg-muted">Fecha <span className="text-warn">· verifica</span></span>
              <input type="date" value={d.fecha ?? ''} onChange={(e) => { setDateApproved(false); patch({ fecha: e.target.value }) }} style={{ ...cell, fontSize: 15, borderColor: dateBlocked ? 'var(--color-danger)' : undefined }} />
            </label>
          </div>
          {dateSuspect && (
            <div className="flex items-center justify-between gap-2 rounded-card border border-danger bg-danger/10 p-2 text-label">
              <span className="text-danger">⚠ La fecha {d.fecha} está fuera de rango ({d.fecha! > todayLocal ? 'en el futuro' : 'más de 60 días atrás'}). Corrígela arriba, o apruébala si es correcta.</span>
              <button onClick={() => setDateApproved(true)} disabled={dateApproved} className="shrink-0 rounded-control border border-danger px-2 py-0.5 text-danger disabled:opacity-50">{dateApproved ? '✓ aprobada' : 'Aprobar fecha'}</button>
            </div>
          )}

          {/* Líneas */}
          <div className="space-y-1">
            {d.items.map((it, i) => (
              <div key={i} className="group flex items-center gap-1">
                <input value={it.descripcion} onChange={(e) => patchItem(i, { descripcion: e.target.value })} style={{ ...cell, flex: 1, minWidth: 100 }} title={it.descripcion_raw && it.descripcion_raw !== it.descripcion ? `IA: ${it.descripcion_raw}` : undefined} placeholder="descripción" />
                {it.aliased && <span className="text-ok" title="alias aplicado">✓</span>}
                <input value={it.cantidad ?? ''} onChange={(e) => patchItem(i, { cantidad: e.target.value === '' ? null : Number(e.target.value) })} inputMode="decimal" style={{ ...cell, width: 46, textAlign: 'right' }} placeholder="cant" />
                <input value={it.precio_unitario ?? ''} onChange={(e) => patchItem(i, { precio_unitario: e.target.value === '' ? null : Number(e.target.value) })} inputMode="decimal" style={{ ...cell, width: 64, textAlign: 'right' }} placeholder="P.U." />
                <input value={it.importe} onChange={(e) => patchItem(i, { importe: Number(e.target.value) })} inputMode="decimal" style={{ ...cell, width: 72, textAlign: 'right', fontVariantNumeric: 'tabular-nums' }} placeholder="importe" />
                <button onClick={() => patchItem(i, { es_descuento: !it.es_descuento })} style={fotoChip(it.es_descuento)} title="marca si es cupón/descuento">desc</button>
                <button onClick={() => delItem(i)} className="px-1 opacity-0 transition-opacity group-hover:opacity-100 text-fg-muted hover:text-danger" aria-label="Borrar línea">✕</button>
              </div>
            ))}
            <button onClick={() => setD((cur) => (cur ? { ...cur, items: [...cur.items, { codigo: null, descripcion: '', descripcion_raw: null, cantidad: null, unidad: null, precio_unitario: null, importe: 0, es_descuento: false }] } : cur))} className="text-label text-fg-muted hover:text-accent">＋ línea</button>
          </div>

          {/* Totales */}
          <div className="flex flex-wrap items-center justify-end gap-x-3 gap-y-1 border-t border-border pt-2 text-label">
            <label className="flex items-center gap-1"><span className="text-fg-muted">Subtotal</span><input value={d.subtotal ?? ''} onChange={(e) => patch({ subtotal: e.target.value === '' ? null : Number(e.target.value) })} inputMode="decimal" style={{ ...cell, width: 80, textAlign: 'right' }} /></label>
            <label className="flex items-center gap-1"><span className="text-fg-muted">Impuestos</span><input value={d.impuestos ?? ''} onChange={(e) => patch({ impuestos: e.target.value === '' ? null : Number(e.target.value) })} inputMode="decimal" style={{ ...cell, width: 80, textAlign: 'right' }} /></label>
            <label className="flex items-center gap-1"><span className="font-bold text-fg">Total</span><input value={d.total ?? ''} onChange={(e) => patch({ total: e.target.value === '' ? null : Number(e.target.value) })} inputMode="decimal" style={{ ...cell, width: 96, textAlign: 'right', fontSize: 15, fontWeight: 700 }} /></label>
          </div>
          {mismatch && <div className="text-right text-label text-warn">las líneas suman {mxn(itemsSum)} · total {mxn(totalNum)} — revisa</div>}

          {/* Categoría + origen del roll-up */}
          <div className="flex flex-wrap items-center gap-1.5 border-t border-border pt-2">
            <span className="text-label text-fg-muted">Categoría</span>
            {COST_CATEGORIES.filter((c) => c.key !== 'renta_condonada').map((c) => (
              <button key={c.key} onClick={() => { setCat(c.key); setOrigin(catDefaults(c.key).defaultOrigin) }} style={fotoChip(cat === c.key)}>{c.label}</button>
            ))}
            <span className="ml-2 text-label text-fg-muted">desde</span>
            {ORIGIN_OPTIONS.map((ct) => (<button key={ct.label} onClick={() => setOrigin(ct.key)} style={fotoChip(origin === ct.key)}>{ct.label}</button>))}
          </div>

          <div className="flex items-center justify-end gap-2 pt-1">
            <button onClick={reset} disabled={busy === 'confirm'} className="rounded-card px-3 py-1.5 text-secondary text-fg-muted hover:text-fg disabled:opacity-50">Descartar</button>
            <button onClick={() => void confirm()} disabled={busy === 'confirm' || dateBlocked} title={dateBlocked ? 'Corrige o aprueba la fecha fuera de rango' : undefined} className="rounded-card bg-[#c0392b] px-4 py-1.5 text-secondary font-bold text-white disabled:opacity-50">{busy === 'confirm' ? 'guardando…' : 'Confirmar gasto'}</button>
          </div>
        </div>
      )}
    </div>
  )
}

// ── Alias aprendidos del capturador: verlos, editarlos o borrarlos. Una corrección tuya pudo enseñar un
// error; aquí se arregla. raw_norm (la llave de match) es de solo lectura — para re-mapear, borra y re-aprende. ──
type SupAlias = { raw_norm: string; proveedor: string }
type ProdAlias = { raw_norm: string; descripcion: string; categoria: string | null; unidad: string | null }

function AliasManager() {
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [sup, setSup] = useState<SupAlias[]>([])
  const [prod, setProd] = useState<ProdAlias[]>([])

  const loadAliases = useCallback(async () => {
    setLoading(true)
    try { const j = await fetch('/api/publico/ticket/aliases').then((r) => r.json()); setSup(j.suppliers ?? []); setProd(j.products ?? []) }
    finally { setLoading(false) }
  }, [])
  useEffect(() => { if (open) void loadAliases() }, [open, loadAliases])

  async function saveSup(a: SupAlias) {
    await fetch('/api/publico/ticket/aliases', { method: 'PATCH', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ type: 'supplier', ...a }) })
    await loadAliases()
  }
  async function saveProd(a: ProdAlias) {
    await fetch('/api/publico/ticket/aliases', { method: 'PATCH', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ type: 'product', ...a }) })
    await loadAliases()
  }
  async function del(type: 'supplier' | 'product', raw_norm: string) {
    await fetch(`/api/publico/ticket/aliases?type=${type}&raw_norm=${encodeURIComponent(raw_norm)}`, { method: 'DELETE' })
    await loadAliases()
  }

  const total = sup.length + prod.length
  const cell: React.CSSProperties = { padding: '3px 6px', fontSize: 13, borderRadius: 6, border: '1px solid var(--color-border, #cbd2e0)', background: 'var(--color-surface-base, #fff)', color: 'inherit' }

  return (
    <section className="rounded-card border border-border p-3">
      <button onClick={() => setOpen((o) => !o)} className="flex w-full items-center justify-between text-label font-bold uppercase tracking-widest text-fg-muted">
        <span>🏷 Alias aprendidos {open && total > 0 && <span className="font-normal normal-case tracking-normal">· {total}</span>}</span>
        <span>{open ? '▲' : '▼'}</span>
      </button>
      {open && (
        <div className="mt-2 space-y-3">
          {loading && <p className="text-secondary italic text-fg-muted">Cargando…</p>}
          {!loading && total === 0 && <p className="text-secondary italic text-fg-muted">Aún no hay alias. Se aprenden cuando corriges un ticket.</p>}

          {sup.length > 0 && (<div>
            <div className="mb-1 text-label text-fg-muted">Proveedores ({sup.length})</div>
            <div className="space-y-1">
              {sup.map((a) => (
                <div key={a.raw_norm} className="group flex items-center gap-1">
                  <span className="w-40 shrink-0 truncate text-label text-fg-muted" title={a.raw_norm}>{a.raw_norm}</span>
                  <span className="text-fg-muted">→</span>
                  <input defaultValue={a.proveedor} onBlur={(e) => { if (e.target.value.trim() && e.target.value !== a.proveedor) void saveSup({ raw_norm: a.raw_norm, proveedor: e.target.value.trim() }) }} style={{ ...cell, flex: 1 }} />
                  <button onClick={() => void del('supplier', a.raw_norm)} className="px-1 text-fg-muted opacity-0 transition-opacity group-hover:opacity-100 hover:text-danger" aria-label="Borrar">✕</button>
                </div>
              ))}
            </div>
          </div>)}

          {prod.length > 0 && (<div>
            <div className="mb-1 text-label text-fg-muted">Productos ({prod.length})</div>
            <div className="space-y-1">
              {prod.map((a) => (
                <div key={a.raw_norm} className="group flex items-center gap-1">
                  <span className="w-32 shrink-0 truncate text-label text-fg-muted" title={a.raw_norm}>{a.raw_norm}</span>
                  <span className="text-fg-muted">→</span>
                  <input defaultValue={a.descripcion} onBlur={(e) => { if (e.target.value.trim() && e.target.value !== a.descripcion) void saveProd({ ...a, descripcion: e.target.value.trim() }) }} style={{ ...cell, flex: 1, minWidth: 90 }} />
                  <input defaultValue={a.unidad ?? ''} onBlur={(e) => { if ((e.target.value.trim() || null) !== a.unidad) void saveProd({ ...a, unidad: e.target.value.trim() || null }) }} placeholder="unidad" style={{ ...cell, width: 64 }} />
                  <button onClick={() => void del('product', a.raw_norm)} className="px-1 text-fg-muted opacity-0 transition-opacity group-hover:opacity-100 hover:text-danger" aria-label="Borrar">✕</button>
                </div>
              ))}
            </div>
          </div>)}
        </div>
      )}
    </section>
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
            <FundMovementControl accounts={SOCIO_ACCOUNTS} hint="Aportar entra · Retirar sale" onSubmit={(flow, desc, amount, metodo) => handlers.onAportaRetira(f.id, flow, desc, amount, metodo)} />
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
