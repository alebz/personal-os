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
import { TicketFoto } from './publico/TicketFoto'
import { AliasManager } from './publico/AliasManager'
import { TicketsArchive } from './publico/TicketsArchive'
import { Previstos } from './publico/Previstos'
import { Contenedores } from './publico/Contenedores'
import { localDate, addDays, dayLabel, dayMonth, monthName } from './publico/util'
import { dayColor, crtDayColor } from '@/lib/weekdayColors'
import { useOSSettings } from '@/components/OSSettingsContext'

// Los 3 contenedores como cuentas para aportar/retirar de socios → captura el ORIGEN (metodo) desde el
// día 1, para que F5 (cuadre) pueda conciliar de dónde entró/salió cada aportación/distribución.
const SOCIO_ACCOUNTS: WalletOption[] = CONTAINERS.map((c) => ({ value: c.key, label: c.label }))

// ── Público Gourmet · FASE 1 ────────────────────────────────────────────────────────────────────
// Capa ejecutiva sobre el POS. El corazón NO son gráficas: es un formulario de captura <30s. Bloque
// fijo arriba, autofocus en ventas, Enter avanza/guarda, defaults inteligentes por categoría (sticky),
// cero navegación. Ventas desglosadas efectivo/tarjeta (origen: efectivo→Caja POS, tarjeta→CLIP).
// Cada costo trae su contenedor. Utilidad OPERATIVA = ventas − (insumo+nómina+gasto_fijo). Un solo
// componente adaptivo (tambor + ventana XP vía tokens de tema); el reskin MSN-Money es polish futuro.

interface Venta { id: string; date: string; efectivo: number; tarjeta: number; note: string | null; source?: 'manual' | 'poster' }
interface Costo { id: string; date: string; category: CostCategory; cost_kind: CostKind | null; origin: OriginKey; amount: number; note: string | null; source?: string }
interface Ingreso { id: string; date: string; concepto: string; amount: number; origin: OriginKey; note: string | null }

export default function PublicoContent() {
  const today = localDate()
  const [capDate, setCapDate] = useState(today)          // día que se está capturando (◀ hoy ▶)
  const month = capDate.slice(0, 7)
  const [ventas, setVentas] = useState<Venta[]>([])
  const [costos, setCostos] = useState<Costo[]>([])
  const [ingresos, setIngresos] = useState<Ingreso[]>([])
  const [tab, setTab] = useState<'panel' | 'captura' | 'tickets' | 'direccion' | 'fondos' | 'notas'>('panel')

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
    <div data-theme-scope="publico" className="mx-auto flex max-w-6xl flex-col gap-4 p-4 text-fg">
      <header className="flex items-baseline justify-between">
        <h1 className="text-xl font-bold">Público Gourmet</h1>
        <div className="flex gap-1">
          <button onClick={() => setTab('panel')} style={chip(tab === 'panel')}>Panel</button>
          <button onClick={() => setTab('captura')} style={chip(tab === 'captura')}>Captura</button>
          <button onClick={() => setTab('tickets')} style={chip(tab === 'tickets')}>Tickets</button>
          <button onClick={() => setTab('direccion')} style={chip(tab === 'direccion')}>Dirección</button>
          <button onClick={() => setTab('fondos')} style={chip(tab === 'fondos')}>Fondos</button>
          <button onClick={() => setTab('notas')} style={chip(tab === 'notas')}>Notas</button>
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

      {/* ── HOY: lo capturado (solo lo OPERATIVO diario: costos. Otros ingresos vive en Fondos) ── */}
      <section className="rounded-card border border-border p-3">
        <h2 className="mb-2 text-label font-bold uppercase tracking-widest text-fg-muted">{capDate === today ? 'Hoy' : dayLabel(capDate)}</h2>
        {costosHoy.length === 0 && <p className="text-secondary italic text-fg-muted">Sin costos este día.</p>}
        <div className="space-y-1">
          {costosHoy.map((c) => (
            <div key={c.id} className="group flex items-center gap-2 text-secondary">
              <span className="w-24 text-fg-muted">{catDefaults(c.category).label}</span>
              <span className="flex-1 truncate">{c.note || <span className="text-fg-muted">—</span>} <span className="text-fg-muted">· {c.source === 'poster' ? 'Poster · contenedor sin asignar' : originLabel(c.origin)}</span></span>
              <span className="tabular-nums text-danger">−{mxn(Number(c.amount))}</span>
              <button onClick={() => void delCosto(c.id)} className="opacity-0 transition-opacity group-hover:opacity-100 text-fg-muted hover:text-danger" aria-label="Borrar">✕</button>
            </div>
          ))}
        </div>
      </section>

      </>)}

      {tab === 'panel' && (
        <Panel month={month} ventasMes={ventasMes} costosOper={costosOper} utilidadOper={utilidadOper} otrosIngresosMes={otrosIngresosMes} rentaCondonadaMes={rentaCondonadaMes} utilidadTotal={utilidadTotal} reinversionMes={reinversionMes} onCostChange={load} />
      )}

      {tab === 'captura' && (
      <AliasManager />
      )}

      {tab === 'tickets' && (
      <TicketsArchive />
      )}

      {tab === 'direccion' && (<><Direccion /><FoodCostPanel /></>)}

      {tab === 'fondos' && (<div className="space-y-3">
        <Socios funds={socioFunds} handlers={socioHandlers} splitAlex={splitAlex} onSplit={saveSplit} utilidadOper={utilidadOper} />
        {/* OTROS INGRESOS (no-POS: subarriendo, etc.) — vive en Fondos, no en Captura: es un evento raro, no
            parte del ritual diario. Suma a la utilidad, nunca a las ventas (food cost intacto). */}
        <section className="rounded-card border border-border bg-surface-2 p-3">
          <div className="mb-2 text-label font-bold uppercase tracking-widest text-fg-muted">Otros ingresos <span className="font-normal normal-case tracking-normal">(no-POS · {monthName(month)})</span></div>
          <div className="flex flex-wrap items-center gap-2">
            <input value={iConcepto} onChange={(e) => setIConcepto(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') void addIngreso() }} placeholder="Concepto (ej. Subarriendo Ameno)" style={{ ...numInput, flex: 1, minWidth: 160, fontSize: 14 }} />
            <input ref={iAmtRef} value={iAmt} onChange={(e) => setIAmt(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') void addIngreso() }} inputMode="decimal" placeholder="$ monto" style={{ ...numInput, width: 120, fontSize: 16 }} />
            <span className="text-label text-fg-muted">a</span>
            {ORIGIN_OPTIONS.map((ct) => (<button key={ct.label} onClick={() => setIOrigin(ct.key)} style={chip(iOrigin === ct.key)}>{ct.label}</button>))}
            <button onClick={() => void addIngreso()} className="rounded-card border border-border px-3 py-2 font-medium">Agregar</button>
          </div>
          <div className="mt-1 text-label text-fg-muted">Suman a la utilidad, nunca a las ventas. El subarriendo que cubre la renta va con origen <b>Sin caja</b>.</div>
          {ingresos.length > 0 && (
            <div className="mt-2 space-y-1 border-t border-border pt-2">
              {ingresos.map((i) => (
                <div key={i.id} className="group flex items-center gap-2 text-secondary">
                  <span className="flex-1 truncate">{dayMonth(i.date)} · {i.concepto} <span className="text-fg-muted">· {originLabel(i.origin)}</span></span>
                  <span className="tabular-nums text-ok">+{mxn(Number(i.amount))}</span>
                  <button onClick={() => void delIngreso(i.id)} className="opacity-0 transition-opacity group-hover:opacity-100 text-fg-muted hover:text-danger" aria-label="Borrar">✕</button>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>)}

      {tab === 'notas' && (
        <section className="rounded-card border border-border bg-surface-2 p-3 text-secondary text-fg-muted">
          Notas — datos operativos del negocio. (Pestaña nueva; su contenido llega en una fase próxima.)
        </section>
      )}
    </div>
  )
}

// ── PANEL (F1): la portada. SOLO métricas con datos reales HOY (todas del POS, ciertas): ventas del mes,
// food cost teórico, ticket promedio, venta por día operado. La utilidad lleva badge "provisional" porque
// resta costos capturados a mano que aún están incompletos (misma lógica visual del food cost). Cada cifra
// marca su PROCEDENCIA (POS vs manual). Estética arcade: UNA rejilla con divisiones de 1px en el color del
// día (monocolor, hard steps, sin degradados). El punto de equilibrio es placeholder → llega en Fase 2 con
// los gastos fijos/nómina (previstos); pintarlo ahora sería una barra basada en nada. Debe caber sin scroll. ──
function Panel({ month, ventasMes, costosOper, utilidadOper, otrosIngresosMes, rentaCondonadaMes, utilidadTotal, reinversionMes, onCostChange }: {
  month: string; ventasMes: number; costosOper: number; utilidadOper: number; otrosIngresosMes: number; rentaCondonadaMes: number; utilidadTotal: number; reinversionMes: number; onCostChange: () => void
}) {
  const { crt } = useOSSettings()
  const [faltan, setFaltan] = useState(0)   // previstos operativos impagos del mes → "provisional · faltan $X"
  const [prevTotals, setPrevTotals] = useState({ pendiente: 0, vencido: 0, pagado: 0, mes: 0 })   // totales de la card de previstos
  const [fixed, setFixed] = useState(0)     // gasto fijo mensual (previstos fijos) → punto de equilibrio operativo
  const [rentaCond, setRentaCond] = useState(0)   // renta condonada mensual → 2º breakeven "de pie solo"
  const dc = crtDayColor(dayColor(new Date()), crt)   // color del día (monocolor de la pantalla)
  const [fc, setFc] = useState<number | null>(null)   // food cost teórico % del mes
  const [tp, setTp] = useState<number | null>(null)   // ticket promedio (POS) · DEL MES
  const [vp, setVp] = useState<number | null>(null)   // venta por persona (POS) · DEL MES (guests_count)
  const [diasOp, setDiasOp] = useState<number | null>(null)  // días con venta del mes (denominador de venta/día)
  const vd = diasOp != null && diasOp > 0 ? ventasMes / diasOp : null   // venta/día = las MISMAS ventas del mes ÷ días operados
  const isCurrentMonth = month === new Date().toLocaleDateString('en-CA', { timeZone: 'America/Mexico_City' }).slice(0, 7)   // el mes en curso siempre tiene compras por capturar
  useEffect(() => {
    let alive = true
    fetch('/api/publico/foodcost').then((r) => r.json()).then((d: FCData & { error?: string }) => { if (!alive || d.error) return; const row = d.theoreticalByMonth?.find((x) => x.month === month); setFc(row ? row.theoreticalPct : null) }).catch(() => {})
    // Métricas DEL MES (no del histórico): ticket, venta/día y venta/persona acotados al rango del mes para que
    // sean coherentes con "Métricas · {month}". El histórico completo vive en la pestaña Dirección (F3).
    const [my, mm] = month.split('-').map(Number)
    const mFrom = `${month}-01`, mTo = `${month}-${String(new Date(my, mm, 0).getDate()).padStart(2, '0')}`
    fetch(`/api/publico/poster/metrics?from=${mFrom}&to=${mTo}`).then((r) => r.json()).then((d: Metrics & { error?: string }) => {
      if (!alive || d.error) return
      // Venta/día se DERIVA de las mismas "ventas del mes" que se muestran arriba (getPaymentsReport, cuadró al
      // centavo) ÷ días operados del POS. NO se usa d.ventaPorDiaOperado porque su numerador es getTransactions
      // (~1.4% distinto) y rompía la aritmética mental: $42,954 ÷ 7 debe dar el número que se ve.
      setDiasOp(d.daysOperated)
      setTp(d.ticketPromedio)   // ticket y venta/persona SÍ son nivel-recibo (getTransactions): no hay cómo derivarlos de getPaymentsReport
      setVp(d.guestsPromedio > 0 ? d.ticketPromedio / d.guestsPromedio : null)   // venta/persona = ticket/comensalesProm
    }).catch(() => {})
    return () => { alive = false }
  }, [month])

  const bord = `${dc}22`                                // divisiones de 1px, color del día tenue
  const box: React.CSSProperties = { border: `1px solid ${dc}44`, borderRadius: 8, background: 'var(--color-surface-1)' }   // bloque bento; surface-1 = card fill al 85% (legible sobre el sim)
  // PROCEDENCIA en la etiqueta (no en badge aparte): "· pos" en el color del día (dato cierto del POS),
  // "· manual" en gris apagado (lo tecleaste tú). Se lee de un vistazo qué dio el POS y qué capturaste.
  const src = (s: 'pos' | 'manual') => <span style={s === 'pos' ? { color: dc } : { opacity: 0.5 }}> · {s}</span>
  const Head = ({ children }: { children: React.ReactNode }) => <div className="mb-2 text-label uppercase tracking-widest" style={{ color: dc }}>{children}</div>
  const Metric = ({ name, value, big, hint }: { name: React.ReactNode; value: string; big?: boolean; hint?: string }) => (
    <div style={{ padding: '10px 12px' }}>
      <div className="text-label uppercase tracking-widest text-fg-muted">{name}</div>
      <div className="tabular-nums" style={{ color: dc, fontWeight: 700, fontSize: big ? 26 : 20, marginTop: 2 }}>{value}</div>
      {hint && <div className="mt-0.5 text-fg-muted" style={{ fontSize: 10, lineHeight: 1.25 }}>{hint}</div>}
    </div>
  )
  const placeholder = (fase: string, txt: string) => <div className="text-secondary text-fg-muted"><span className="italic">{fase}</span> — {txt}</div>

  // Bento: bloques de distinto tamaño = jerarquía. Colapsa a 1 columna en móvil (grid-cols-1), usa el ancho
  // real en desktop (lg:grid-cols-6). Los bloques aún sin datos NO se esconden: se muestran con su leyenda.
  return (
    <div className="grid grid-cols-1 gap-3 lg:grid-cols-6">
      {/* Línea dinámica — ancho completo (es texto, necesita renglón largo). Contenido: Fase 5. */}
      <div className="flex flex-wrap items-center gap-x-2 px-3 py-2 text-secondary lg:col-span-6" style={box}>
        <span className="text-label uppercase tracking-widest" style={{ color: dc }}>Línea dinámica</span>
        <span className="text-fg-muted italic">Fase 5 — leerá tus datos (ventas, costos, previstos) y escribirá la frase que importa hoy.</span>
      </div>

      {/* Fila asimétrica: MÉTRICAS + punto de equilibrio (2/3, el bloque hero) · alerta + qué toca (1/3). */}
      <section className="lg:col-span-4" style={box}>
        <div className="px-3 pt-3"><Head>Métricas · {monthName(month)}</Head></div>
        <div className="grid grid-cols-1 sm:grid-cols-2" style={{ borderTop: `1px solid ${bord}` }}>
          {/* Par de caras: VENTAS (POS, cierto) y GASTOS (manual, incompleto) — mismo peso visual, procedencia honesta. */}
          <div style={{ borderBottom: `1px solid ${bord}`, borderRight: `1px solid ${bord}` }}><Metric name={<>Ventas del mes{src('pos')}</>} value={mxn(ventasMes)} big /></div>
          <div style={{ borderBottom: `1px solid ${bord}` }}><Metric name={<>Gastos del mes<span style={{ opacity: 0.5 }}> · poster + manual</span></>} value={`−${mxn(costosOper)}`} big hint="compras de Poster + capturas · incompleto hasta cerrar el mes" /></div>
          {/* PRECAUCIÓN DE LECTURA: food cost = CONSUMO (recetas del POS), NO compras÷ventas. Surtirse por
              adelantado infla compras/ventas (jun 59%, jul 49%) muy arriba del teórico 31% — es periodificación,
              no food cost. GASTOS y FOOD COST viven en celdas distintas y nunca se dividen entre sí. */}
          <div style={{ borderBottom: `1px solid ${bord}`, borderRight: `1px solid ${bord}` }}><Metric name={<>Food cost teórico{src('pos')}</>} value={fc != null ? `${fc.toFixed(1)}%` : '…'} hint="consumo de recetas · no es gastos ÷ ventas" /></div>
          <div style={{ borderBottom: `1px solid ${bord}` }}><Metric name={<>Ticket promedio{src('pos')}</>} value={tp != null ? mxn(tp) : '…'} hint="promedio por recibo · no por persona" /></div>
          {/* Venta por persona: sí capturas comensales (guests_count ≈ 2.4/recibo), así que es un número real y distinto del ticket. */}
          <div style={{ borderRight: `1px solid ${bord}` }}><Metric name={<>Venta · por persona{src('pos')}</>} value={vp != null ? mxn(vp) : '…'} hint="÷ comensales del recibo" /></div>
          <div><Metric name={<>Venta · día operado{src('pos')}</>} value={vd != null ? mxn(vd) : '…'} hint={diasOp != null ? `÷ ${diasOp} días con venta · no del calendario` : '÷ días con venta · no del calendario'} /></div>
        </div>
        {/* Utilidad (provisional) */}
        <div className="px-3 py-3" style={{ borderTop: `1px solid ${bord}` }}>
          <div className="flex items-center justify-between gap-2">
            <span className="text-label uppercase tracking-widest text-fg-muted">Utilidad operativa <span className="text-warn" style={{ border: '1px solid currentColor', borderRadius: 4, padding: '0 4px', fontSize: 9, letterSpacing: 1 }}>provisional</span></span>
            <span className="tabular-nums" style={{ color: dc, fontSize: 22, fontWeight: 700 }}>{mxn(utilidadOper)}</span>
          </div>
          <div className="mt-1 text-label text-fg-muted italic">= ventas del mes − gastos capturados</div>
          {/* Honestidad: la utilidad se INFLA cuando faltan costos. Los fijos/nómina viven en previstos y no
              restan hasta marcarse pagados; el mes en curso además tiene compras por capturar. Lo decimos claro. */}
          {(faltan > 0 || isCurrentMonth) && (
            <div className="mt-1 text-label text-warn" style={{ lineHeight: 1.3 }}>
              ⚠ se ve alta —{faltan > 0 && <> aún no resta <b className="tabular-nums">{mxn(faltan)}</b> de nómina/fijos sin marcar como pagados</>}{faltan > 0 && isCurrentMonth && ' ·'}{isCurrentMonth && ' compras del mes aún por capturar'}. La real será menor.
            </div>
          )}
          {(otrosIngresosMes > 0 || rentaCondonadaMes > 0 || reinversionMes > 0) && (
            <div className="mt-2 space-y-0.5 border-t pt-2 text-label text-fg-muted" style={{ borderColor: bord }}>
              {otrosIngresosMes > 0 && <div className="flex justify-between"><span>+ otros ingresos</span><span className="tabular-nums">{mxn(otrosIngresosMes)}</span></div>}
              {rentaCondonadaMes > 0 && <div className="flex justify-between"><span>− renta condonada</span><span className="tabular-nums">−{mxn(rentaCondonadaMes)}</span></div>}
              {(otrosIngresosMes > 0 || rentaCondonadaMes > 0) && <div className="flex justify-between font-medium text-fg"><span>= utilidad</span><span className="tabular-nums">{mxn(utilidadTotal)}</span></div>}
              {reinversionMes > 0 && <div className="flex justify-between"><span>reinversión (aparte, no resta utilidad)</span><span className="tabular-nums">{mxn(reinversionMes)}</span></div>}
            </div>
          )}
        </div>
        {/* Punto de equilibrio — DOS números: operativo (con la renta que le condonas) y "de pie solo" (incluye
            la renta condonada, sin meterla como costo real). El 2º contesta cuándo el negocio paga su propia renta. */}
        <div className="px-3 py-3" style={{ borderTop: `1px solid ${bord}` }}>
          <div className="text-label uppercase tracking-widest text-fg-muted">Punto de equilibrio</div>
          {(() => {
            if (fixed <= 0) return <div className="mt-1 flex items-center gap-2"><span className="tabular-nums text-lg tracking-widest" style={{ color: dc, opacity: 0.35 }}>▮▯▯▯▯</span><span className="text-secondary italic text-warn">falta configurar gastos fijos</span></div>
            const margin = fc != null ? 1 - fc / 100 : null
            if (margin == null) return <div className="mt-1 text-secondary italic text-fg-muted">food cost teórico pendiente para el margen…</div>
            if (margin <= 0) return <div className="mt-1 text-secondary italic text-warn">food cost teórico ≥ 100% — revisa, no hay margen</div>
            const STEPS = 24
            const beRow = (label: string, fijos: number, sub: string) => {
              const be = fijos / margin, pct = be > 0 ? ventasMes / be : 0, filled = Math.round(Math.min(pct, 1) * STEPS), cubierto = ventasMes >= be
              return (
                <div className="space-y-1">
                  <div className="flex items-baseline justify-between gap-2 text-label">
                    <span className="text-fg-muted"><b className="uppercase" style={{ color: dc }}>{label}</b> · necesitas <b className="tabular-nums" style={{ color: dc }}>{mxn(be)}</b> · fijos {mxn(fijos)}</span>
                    <span className="tabular-nums" style={{ color: dc }}>{Math.round(pct * 100)}%</span>
                  </div>
                  {/* Barra de ESCALONES DUROS (no continua): cada bloque es un paso. */}
                  <div className="flex h-3 gap-0.5">{Array.from({ length: STEPS }).map((_, i) => <div key={i} className="flex-1" style={{ background: i < filled ? dc : `${dc}22` }} />)}</div>
                  <div className="text-label">{cubierto ? <span className="text-ok">✓ cubierto · +{mxn(ventasMes - be)}</span> : <span className="text-warn">faltan {mxn(be - ventasMes)} de ventas</span>} <span className="text-fg-muted">· {sub}</span></div>
                </div>
              )
            }
            return (
              <div className="mt-1 space-y-3">
                <div className="text-label text-fg-muted">margen {(margin * 100).toFixed(0)}% (1 − food cost teórico {fc!.toFixed(1)}%)</div>
                {beRow('Operativo', fixed, 'con la renta que le condonas')}
                {rentaCond > 0
                  ? beRow('De pie solo', fixed + rentaCond, `+ renta ${mxn(rentaCond)} · cuándo paga su propia renta`)
                  : <div className="text-label italic text-fg-muted">Agrega la renta como previsto (categoría <b>Renta condonada</b>) para ver el <b>&quot;de pie solo&quot;</b> — cuándo el negocio paga su propia renta.</div>}
              </div>
            )
          })()}
        </div>
      </section>

      {/* Alerta + qué toca (1/3). Contenido: Fase 5. */}
      <section className="px-3 py-3 lg:col-span-2" style={box}>
        <Head>Alerta · qué toca</Head>
        {placeholder('Fase 5', 'lo que bloquea y las 2-3 acciones del día.')}
      </section>

      {/* Fila de dos iguales: gastos previstos (Fase 2) · contenedores (Fase 3). */}
      <section className="px-3 py-3 lg:col-span-3" style={box}>
        <Head>Gastos previstos {(prevTotals.pendiente > 0 || prevTotals.vencido > 0) && (
          <span className="font-normal normal-case tracking-normal text-fg-muted">· pendiente <b className="tabular-nums text-fg">{mxn(prevTotals.pendiente)}</b>{prevTotals.vencido > 0 && <span className="text-danger"> · vencido <b className="tabular-nums">{mxn(prevTotals.vencido)}</b></span>}</span>
        )}</Head>
        <Previstos month={month} onFaltan={setFaltan} onFixed={setFixed} onRentaCond={setRentaCond} onTotals={setPrevTotals} onCostChange={onCostChange} />
      </section>
      <section className="px-3 py-3 lg:col-span-3" style={box}>
        <Head>Contenedores</Head>
        <Contenedores dc={dc} />
      </section>
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
              <div key={r.id} className="flex justify-between tabular-nums"><span>#{r.id} · {dayMonth(r.date)} {r.time}</span><span>{mxn(r.sum)}</span></div>
            ))}
          </div>
        </div>
      )}

      {/* ── RESUMEN ── */}
      <section className="rounded-card border border-border bg-surface-2 p-3">
        <div className="mb-2 flex items-baseline justify-between">
          <h2 className="text-label font-bold uppercase tracking-widest text-fg-muted">Dirección</h2>
          <span className="text-label text-fg-muted">{dayMonth(m.range.from)} → {dayMonth(m.range.to)}</span>
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
type FCPeriod = { from: string; to: string; kind: 'arranque' | 'confiable' | 'abierto'; sales: number; theoreticalPct: number; realPct: number | null; gapPct: number | null; startupAdjustment?: number; contaminated?: boolean; days?: number; note?: string }
type FCData = { theoreticalByMonth: FCMonth[]; periods: FCPeriod[]; lastCountDate: string | null; daysSinceCount: number | null; countAlert: boolean; anyReliable: boolean; todayStatus: string }

const KIND_BADGE: Record<FCPeriod['kind'], { dot: string; label: string; cls: string }> = {
  confiable: { dot: '🟢', label: 'acotado por conteos', cls: 'text-ok' },
  arranque: { dot: '🟡', label: 'arranque del sistema', cls: 'text-warn' },
  abierto: { dot: '⚪', label: 'en curso · sin conteo', cls: 'text-fg-muted' },
}
const MESES = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic']
const monthLabel = (m: string) => { const [y, mm] = m.split('-'); return `${MESES[Number(mm) - 1]} ${y}` }
const dayLabelShort = (iso: string) => { const [, mm, dd] = iso.split('-'); return `${Number(dd)} ${MESES[Number(mm) - 1]}` }

type EmpMonth = { month: string; sales: number; empaque: number; pct: number | null }

function FoodCostPanel() {
  const [d, setD] = useState<FCData | null>(null)
  const [err, setErr] = useState<string | null>(null)
  const [emp, setEmp] = useState<EmpMonth[] | null>(null)
  useEffect(() => {
    let alive = true
    fetch('/api/publico/foodcost').then((r) => r.json())
      .then((j) => { if (!alive) return; if (j.error) setErr(j.error); else setD(j) })
      .catch(() => alive && setErr('No se pudo cargar el food cost'))
    fetch('/api/publico/empaque').then((r) => r.json())
      .then((j) => { if (alive && j.byMonth) setEmp(j.byMonth) }).catch(() => {})
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
          // Un 'confiable' demasiado largo se presenta como RECONCILIACIÓN, no como merma: el gap no es un
          // hallazgo del negocio (mezcla drift + compras no escritas al perpetuo). Badge y gap amortiguados.
          const b = p.contaminated ? { dot: '🟠', label: `reconciliación · ${p.days} días`, cls: 'text-warn' } : KIND_BADGE[p.kind]
          return (
            <div key={i} className="rounded-card border border-border p-2">
              <div className="flex items-center justify-between">
                <span className="font-medium text-fg">{dayLabelShort(p.from)} → {dayLabelShort(p.to)}</span>
                <span className={`text-label ${b.cls}`}>{b.dot} {b.label}</span>
              </div>
              <div className="mt-1 flex flex-wrap items-baseline gap-x-4 gap-y-1 text-secondary">
                <span className="text-fg-muted">ventas <span className="tabular-nums text-fg">{mxn(p.sales)}</span></span>
                <span className="text-fg-muted">teórico <span className="tabular-nums font-medium text-fg">{p.theoreticalPct.toFixed(1)}%</span></span>
                {p.kind === 'confiable' && !p.contaminated && p.realPct != null && p.gapPct != null && (<>
                  <span className="text-fg-muted">real <span className="tabular-nums font-medium text-fg">{p.realPct.toFixed(1)}%</span></span>
                  <span className={`font-bold ${p.gapPct > 3 ? 'text-danger' : p.gapPct < -3 ? 'text-warn' : 'text-ok'}`}>gap {p.gapPct > 0 ? '+' : ''}{p.gapPct.toFixed(1)} pts</span>
                </>)}
                {p.contaminated && <span className="italic text-fg-muted">reconciliación acumulada · el gap no es merma del periodo</span>}
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

      {/* EMPAQUE · % de ventas — SEPARADO del food cost (no es consumo de receta). Es lo que se va CON la venta
          (cajas, vasos, servilletas); escala con el volumen, por eso se mira como % de ventas. Punto 5. */}
      {emp && emp.some((m) => m.empaque > 0) && (
        <div className="mt-3 rounded-card border border-border p-2" style={{ borderStyle: 'dashed' }}>
          <div className="mb-1 text-label font-bold uppercase tracking-widest text-fg-muted">Empaque · % de ventas <span className="font-normal normal-case tracking-normal">(no es food cost — lo que se va con la venta)</span></div>
          <div className="space-y-0.5">
            {emp.map((m) => (
              <div key={m.month} className="flex items-baseline justify-between text-secondary">
                <span className="text-fg-muted">{monthLabel(m.month)}</span>
                <span className="tabular-nums"><span className="text-fg-muted">{mxn(m.empaque)} · </span><span className="font-medium text-fg">{m.pct != null ? `${m.pct.toFixed(1)}%` : '—'}</span></span>
              </div>
            ))}
          </div>
          <div className="mt-1 text-label text-fg-muted">Sube = sirves más (bien) o el empaque se encareció (revisar). Nunca se suma al food cost.</div>
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
