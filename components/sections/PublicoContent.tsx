'use client'

import { Fragment, useCallback, useEffect, useRef, useState } from 'react'
import { mxn } from '@/components/Mxn'
import { MoneyInput } from '@/components/MoneyInput'
import { useCajaFuerte } from '@/components/finance/useCajaFuerte'
import { FundLedger } from '@/components/finance/FundLedger'
import { FundMovementControl, type WalletOption } from '@/components/finance/FundMovementControl'
import type { Fund } from '@/components/finance/CajaFuerteSection'
import {
  catDefaults, originLabel, ORIGIN_OPTIONS, CONTAINERS, OPERATING_CATEGORIES,
  type CostCategory, type OriginKey, type CostKind,
} from '@/lib/publico'
import { TicketFoto } from './publico/TicketFoto'
import { QueToca } from './publico/QueToca'
import { AliasManager } from './publico/AliasManager'
import { Notas } from './publico/Notas'
import { Inventario } from './publico/Inventario'
import { Card, CardHead, Metric as KitMetric, srcTag, StatBar, BentoRow, TabBar } from './publico/ui'
import { TicketsArchive } from './publico/TicketsArchive'
import { Previstos } from './publico/Previstos'
import { Contenedores } from './publico/Contenedores'
import { localDate, addDays, dayLabel, dayMonth, monthName } from './publico/util'
import { ventanaRodante, ventanaMes, sumaRango, etiquetaVentana, findesOperados } from '@/lib/publico/comparativo'
import { comisionEfectiva } from '@/lib/publico/comision'
import { dayColor, crtDayColor } from '@/lib/weekdayColors'
import { useOSSettings } from '@/components/OSSettingsContext'
import PublicoMoney from '@/components/xp/PublicoMoney'

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

// Navegación por MES (mismo patrón que Uptown/Finanzas): corre capDate d meses, clampeando el día al mes destino.
function shiftMonthDate(dateStr: string, d: number): string {
  const [y, m, day] = dateStr.split('-').map(Number)
  const dt = new Date(y, m - 1 + d, 1)
  const ny = dt.getFullYear(), nm = dt.getMonth()
  const nd = Math.min(day, new Date(ny, nm + 1, 0).getDate())
  return `${ny}-${String(nm + 1).padStart(2, '0')}-${String(nd).padStart(2, '0')}`
}

// Bajo XP, Público se re-presenta como MSN Money 2003 (misma familia que Finanzas/Uptown). Arcade = intacto.
export default function PublicoContent() {
  const { shell } = useOSSettings()
  if (shell === 'xp') return <PublicoMoney />
  return <PublicoArcade />
}

function PublicoArcade() {
  const { crt } = useOSSettings()
  const dc = crtDayColor(dayColor(new Date()), crt)   // color del día → headers de sección en el mismo idioma que Panel/Dirección
  const today = localDate()
  const [capDate, setCapDate] = useState(today)          // día que se está capturando (◀ hoy ▶)
  const month = capDate.slice(0, 7)
  const currentMonth = today.slice(0, 7)                 // no se navega a meses futuros (sin datos)
  const prevMonthStr = shiftMonthDate(capDate, -1).slice(0, 7)   // mes anterior, para el comparativo
  const prevPrevMonthStr = shiftMonthDate(capDate, -2).slice(0, 7)   // mes -2: la ventana rodante previa (4 sem atrás) alcanza hasta aquí
  const [cmpV, setCmpV] = useState<Venta[]>([])   // ventas diarias de 3 meses → comparativo por ventana rodante (fuente única)
  const [cmpC, setCmpC] = useState<Costo[]>([])   // costos diarios de 3 meses → delta de gastos sobre la misma ventana
  const [ventas, setVentas] = useState<Venta[]>([])
  const [propTarjMes, setPropTarjMes] = useState(0)   // propina de tarjeta del mes → base de la comisión de Clip
  const [costos, setCostos] = useState<Costo[]>([])
  const [ingresos, setIngresos] = useState<Ingreso[]>([])
  const [tab, setTab] = useState<'panel' | 'movimientos' | 'direccion' | 'fondos' | 'notas'>('panel')
  const [movView, setMovView] = useState<'capturar' | 'historial' | 'inventario' | 'cierre'>('capturar')   // Movimientos: capturar · archivo · conteo · cierre (cuadre del POS)

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
  const [efectivo, setEfectivo] = useState<number | null>(null)
  const [tarjeta, setTarjeta] = useState<number | null>(null)
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

  // El alta manual vive ahora dentro de TicketFoto (un capturador: foto o a mano, ambos con renglones).
  const [editVenta, setEditVenta] = useState(false)               // el cierre es solo-lectura (Poster lo llena); esto abre el fallback manual
  const [propPend, setPropPend] = useState<{ pendiente: number; nivel: 'verde' | 'amarillo' | 'rojo' } | null>(null)   // propina por repartir (pasivo vivo, siempre visible)

  // ── Otros ingresos (no-POS: subarriendo Ameno, etc.) ──
  const [iConcepto, setIConcepto] = useState('')
  const [iAmt, setIAmt] = useState<number | null>(null)
  const [iOrigin, setIOrigin] = useState<OriginKey>('clip')
  const iAmtRef = useRef<HTMLInputElement>(null)

  const load = useCallback(async () => {
    // Trae el mes visto + los DOS anteriores. El comparativo ya no es mes-a-mes por día del mes (artefacto de
    // calendario en un negocio de fin de semana): es la ventana rodante de 4 semanas (comparativo.ts, fuente
    // única con el narrador). Su ventana previa alcanza hasta el mes -2, por eso se bajan 3 meses.
    const [r, pr, ppm, pp] = await Promise.all([
      fetch(`/api/publico?month=${month}&today=${capDate}`).then((r) => r.json()).catch(() => null),
      fetch(`/api/publico?month=${prevMonthStr}`).then((r) => r.json()).catch(() => null),
      fetch(`/api/publico?month=${prevPrevMonthStr}`).then((r) => r.json()).catch(() => null),
      fetch('/api/publico/propinas').then((r) => r.json()).catch(() => null),   // pasivo vivo, no mensual
    ])
    if (pp && typeof pp.pendiente === 'number') setPropPend({ pendiente: pp.pendiente, nivel: pp.nivel })
    if (!r) return
    setVentas(r.ventas ?? [])
    setPropTarjMes(Number(r.propinaTarjeta ?? 0))
    setCostos(r.costos ?? [])
    setIngresos(r.ingresos ?? [])
    const hoy: Venta | null = r.ventas?.find((v: Venta) => v.date === capDate) ?? null
    setEfectivo(hoy && hoy.efectivo ? Number(hoy.efectivo) : null)
    setTarjeta(hoy && hoy.tarjeta ? Number(hoy.tarjeta) : null)
    setCmpV([...(r.ventas ?? []), ...(pr?.ventas ?? []), ...(ppm?.ventas ?? [])])
    setCmpC([...(r.costos ?? []), ...(pr?.costos ?? []), ...(ppm?.costos ?? [])])
  }, [month, capDate, prevMonthStr, prevPrevMonthStr])

  useEffect(() => { void load() }, [load])
  useEffect(() => { setEditVenta(false) }, [capDate])   // al navegar de día, el cierre vuelve a solo-lectura (no arrastra un form de edición)

  // Al cambiar categoría, resetea origen+naturaleza a los defaults de ESA categoría (sticky después).
  async function saveVenta() {
    const ef = efectivo ?? 0, ta = tarjeta ?? 0
    if ((!ef && !ta) || ef < 0 || ta < 0) return
    await fetch('/api/publico/venta', {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ date: capDate, efectivo: ef || 0, tarjeta: ta || 0 }),
    })
    setSavedFlash(true); setTimeout(() => setSavedFlash(false), 1400)
    setEditVenta(false)   // guardado → vuelve a solo-lectura
    await load()
  }

  async function delCosto(id: string) {
    await fetch(`/api/publico/costo?id=${id}`, { method: 'DELETE' }); await load()
  }

  async function addIngreso() {
    const a = iAmt
    if (!iConcepto.trim() || a == null || a <= 0) return
    const concepto = iConcepto.trim()
    setIConcepto(''); setIAmt(null)         // limpia YA (antes del await): burst no concatena
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
  const tarjetaMes = ventas.reduce((s, v) => s + Number(v.tarjeta), 0)   // para la comisión efectiva del margen
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

  // Chip de selección (categoría/origen), MISMO lenguaje que los tabs de Uptown: activo = relleno sutil de
  // superficie + texto fg (no un color brillante). Antes era #c0392b / dc lleno, que rompía el estilo del OS.
  const chip = (on: boolean): React.CSSProperties => ({
    padding: '3px 10px', borderRadius: 999, fontSize: 12, cursor: 'pointer', border: '1px solid',
    borderColor: 'var(--color-border, #cbd2e0)',
    background: on ? 'var(--color-surface-active)' : 'transparent',
    color: on ? 'var(--color-fg)' : 'var(--color-fg-muted)', fontWeight: on ? 600 : 400, whiteSpace: 'nowrap',
  })
  const numInput: React.CSSProperties = {
    width: '100%', padding: '8px 10px', fontSize: 14, fontVariantNumeric: 'tabular-nums',
    borderRadius: 8, border: '1px solid var(--color-border, #cbd2e0)', background: 'var(--color-surface-base, #fff)', color: 'inherit',
  }

  return (
    <div data-theme-scope="publico" className="mx-auto flex max-w-6xl flex-col gap-4 p-4 text-fg">
      <header className="flex flex-wrap items-baseline justify-between gap-2">
        <div className="flex items-center gap-3">
          <h1 className="text-xl font-bold">Público Gourmet</h1>
          {/* Navegador de MES — corre capDate; aplica a Panel, Dirección, Fondos (todo lo mensual). */}
          <div className="flex items-center gap-1 text-secondary">
            <button onClick={() => setCapDate((d) => shiftMonthDate(d, -1))} className="px-1 text-fg-muted hover:text-fg" aria-label="Mes anterior">‹</button>
            <span className="min-w-[104px] text-center font-semibold capitalize text-fg">{monthName(month)}</span>
            <button onClick={() => { if (month < currentMonth) setCapDate((d) => { const n = shiftMonthDate(d, 1); return n > today ? today : n }) }} disabled={month >= currentMonth} className="px-1 text-fg-muted hover:text-fg disabled:opacity-30" aria-label="Mes siguiente">›</button>
          </div>
        </div>
        <TabBar value={tab} onChange={setTab} rounded="rounded-full" pill tabs={[['panel', 'Panel'], ['movimientos', 'Movimientos'], ['direccion', 'Dirección'], ['fondos', 'Fondos'], ['notas', 'Notas']] as const} />
      </header>


      {tab === 'movimientos' && (<>
      {/* MOVIMIENTOS = una familia: CAPTURAR (el acto de registrar) · HISTORIAL (el registro). */}
      <TabBar value={movView} onChange={setMovView} tabs={[['capturar', 'Capturar'], ['historial', 'Historial'], ['inventario', 'Inventario'], ['cierre', 'Cierre']] as const} />

      {movView === 'inventario' && <Inventario tone={dc} />}

      {/* ── CIERRE = CUADRE del POS (fuera de Capturar). Las ventas entran solas de Poster; esto es para corregir/cuadrar un día. ── */}
      {movView === 'cierre' && (
        <Card>
          <div className="mb-2 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="text-label uppercase tracking-widest" style={{ color: dc }}>Cierre del POS</span>
              <button onClick={() => setCapDate((d) => addDays(d, -1))} className="px-1 text-fg-muted hover:text-fg" aria-label="Día anterior">◀</button>
              <button onClick={() => setCapDate(today)} className={`text-secondary ${capDate === today ? 'font-bold text-fg' : 'text-fg-muted'}`}>{capDate === today ? 'hoy' : dayLabel(capDate)}</button>
              <button onClick={() => setCapDate((d) => addDays(d, +1) > today ? today : addDays(d, +1))} className="px-1 text-fg-muted hover:text-fg" aria-label="Día siguiente">▶</button>
              {hoyV && <span className={`rounded px-1.5 py-0.5 text-label font-medium ${hoyV.source === 'poster' ? 'bg-accent/15 text-accent' : 'bg-surface-active text-fg-muted'}`} title={hoyV.source === 'poster' ? 'Importado del POS' : 'Capturado a mano'}>{hoyV.source === 'poster' ? 'POS' : 'manual'}</span>}
            </div>
            {savedFlash && <span className="text-secondary font-medium text-ok">guardado</span>}
          </div>
          <div className="mb-3 text-label text-fg-muted">Las ventas del POS entran solas de Poster. Esto es para <b className="text-fg">cuadrar</b> un día — corregirlo o capturarlo a mano si el import no llegó.</div>
          {hoyV && !editVenta ? (
            <div className="flex items-center justify-between gap-2 text-secondary">
              <span className="text-fg-muted">efectivo <b className="tabular-nums text-fg">{mxn(Number(hoyV.efectivo))}</b> · tarjeta <b className="tabular-nums text-fg">{mxn(Number(hoyV.tarjeta))}</b> · total <b className="tabular-nums text-fg">{mxn(Number(hoyV.efectivo) + Number(hoyV.tarjeta))}</b></span>
              <button onClick={() => { setEfectivo(Number(hoyV.efectivo) || null); setTarjeta(Number(hoyV.tarjeta) || null); setEditVenta(true) }} className="shrink-0 text-label text-fg-muted underline decoration-dotted hover:text-accent">corregir a mano</button>
            </div>
          ) : (
            <>
              {!hoyV && <div className="mb-1 text-label text-fg-muted">Sin ventas del POS para este día — captúralas a mano o espera el import.</div>}
              <div className="flex items-end gap-3">
                <label className="flex-1">
                  <span className="text-label text-fg-muted">Efectivo</span>
                  <MoneyInput ref={efectivoRef} value={efectivo} onChange={setEfectivo} onKeyDown={(e) => { if (e.key === 'Enter') tarjetaRef.current?.focus() }} placeholder="0" style={numInput} />
                </label>
                <label className="flex-1">
                  <span className="text-label text-fg-muted">Tarjeta</span>
                  <MoneyInput ref={tarjetaRef} value={tarjeta} onChange={setTarjeta} onKeyDown={(e) => { if (e.key === 'Enter') void saveVenta() }} placeholder="0" style={numInput} />
                </label>
                <button onClick={() => void saveVenta()} style={{ background: dc }} className="rounded-card px-4 py-2 font-bold text-white">Guardar</button>
                {hoyV && <button onClick={() => setEditVenta(false)} className="text-label text-fg-muted hover:text-accent">cancelar</button>}
              </div>
              <div className="mt-1 text-right text-label text-fg-muted">Total {mxn((efectivo ?? 0) + (tarjeta ?? 0))}</div>
            </>
          )}
        </Card>
      )}

      {movView === 'capturar' && (<>
      {/* ── FOTO DEL TICKET = ACCIÓN PRIMARIA (lo que haces a diario) ── */}
      <Card>
        <TicketFoto onSaved={load} defaultDate={capDate} tone={dc} />
      </Card>

      {/* El alta manual se fusionó con la foto: TicketFoto trae "Registrar a mano" (mismo borrador, con renglones). */}

      {/* ── HOY: lo capturado (solo lo OPERATIVO diario: costos. Otros ingresos vive en Fondos) ── */}
      <Card>
        <CardHead tone={dc}>{capDate === today ? 'Hoy' : dayLabel(capDate)}</CardHead>
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
      </Card>
      </>)}

      {movView === 'historial' && (<>
      {/* ── HISTORIAL = el archivo de tickets (ver, editar, borrar) — sin cambios de funcionalidad ── */}
      <TicketsArchive tone={dc} />
      {/* Gestor de alias = MANTENIMIENTO del mapeo aprendido de los tickets (proveedor/insumo → Poster). Vive
          CON el archivo, no en el acto diario: es limpieza del registro, casi nunca. Ya es un desplegable. */}
      <AliasManager />
      </>)}
      </>)}

      {tab === 'panel' && (
        <Panel month={month} ventasMes={ventasMes} tarjetaMes={tarjetaMes} propinaTarjetaMes={propTarjMes} costosOper={costosOper} utilidadOper={utilidadOper} otrosIngresosMes={otrosIngresosMes} rentaCondonadaMes={rentaCondonadaMes} utilidadTotal={utilidadTotal} reinversionMes={reinversionMes} cmpVentas={cmpV} cmpCostos={cmpC} ventasDiarias={ventas} propinaPendiente={propPend?.pendiente ?? 0} onCostChange={load} />
      )}

      {tab === 'direccion' && (<><Direccion /><FoodCostPanel /></>)}

      {tab === 'fondos' && (<div className="space-y-3">
        <Socios funds={socioFunds} handlers={socioHandlers} />
        {/* Reparto | Otros ingresos lado a lado (colapsan a 1 col en móvil). */}
        <BentoRow>
        <Reparto splitAlex={splitAlex} onSplit={saveSplit} utilidadOper={utilidadOper} />
        {/* OTROS INGRESOS (no-POS: subarriendo, etc.) — vive en Fondos, no en Captura: es un evento raro, no
            parte del ritual diario. Suma a la utilidad, nunca a las ventas (food cost intacto). */}
        <Card>
          <CardHead tone={dc}>Otros ingresos <span className="font-normal normal-case tracking-normal">(no-POS · {monthName(month)})</span></CardHead>
          <div className="flex flex-wrap items-center gap-2">
            <input value={iConcepto} onChange={(e) => setIConcepto(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') void addIngreso() }} placeholder="Concepto (ej. Subarriendo Ameno)" style={{ ...numInput, flex: 1, minWidth: 160, fontSize: 14 }} />
            <MoneyInput ref={iAmtRef} value={iAmt} onChange={setIAmt} onKeyDown={(e) => { if (e.key === 'Enter') void addIngreso() }} placeholder="$ monto" style={{ ...numInput, width: 120 }} />
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
        </Card>
        </BentoRow>
      </div>)}

      {tab === 'notas' && <Notas tone={dc} />}

      {/* ── FRANJA DE ESTADO (al FONDO, siempre visible en toda sección): sync del POS + propina por repartir
          (pasivo vivo) + import manual. Pie de página de utilidad, no compite con el contenido de arriba. ── */}
      <div className="mt-2 flex flex-wrap items-center justify-between gap-x-3 gap-y-1 rounded-card border border-border bg-surface-2 px-3 py-1.5 text-label">
        <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5">
          <span className={syncStale ? 'text-danger' : 'text-fg-muted'}>
            {sync?.last_error
              ? `Import falló: ${sync.last_error}`
              : sync?.last_success_at
                ? `POS · último import ${daysSince === 0 ? 'hoy' : daysSince === 1 ? 'ayer' : `hace ${daysSince} días`}${syncStale ? ' — revisa' : ''}`
                : 'POS · sin importar aún'}
          </span>
          {propPend && propPend.pendiente > 0 && (
            <button onClick={() => setTab('panel')} className="hover:underline" title="ver y repartir en Contenedores" style={{ color: propPend.nivel === 'rojo' ? 'var(--color-danger)' : propPend.nivel === 'amarillo' ? 'var(--color-warn, #b45309)' : 'var(--color-fg-muted)' }}>debes {mxn(propPend.pendiente)} de propina</button>
          )}
        </div>
        <button onClick={() => void importNow()} disabled={importing} className="shrink-0 rounded-control px-2 py-0.5 text-fg-muted transition-colors hover:text-accent disabled:opacity-50">{importing ? 'importando…' : 'importar ahora'}</button>
      </div>
    </div>
  )
}

// ── PANEL (F1): la portada. SOLO métricas con datos reales HOY (todas del POS, ciertas): ventas del mes,
// food cost teórico, ticket promedio, venta por día operado. La utilidad lleva badge "provisional" porque
// resta costos capturados a mano que aún están incompletos (misma lógica visual del food cost). Cada cifra
// marca su PROCEDENCIA (POS vs manual). Estética arcade: UNA rejilla con divisiones de 1px en el color del
// día (monocolor, hard steps, sin degradados). El punto de equilibrio es placeholder → llega en Fase 2 con
// los gastos fijos/nómina (previstos); pintarlo ahora sería una barra basada en nada. Debe caber sin scroll. ──
function Panel({ month, ventasMes, tarjetaMes, propinaTarjetaMes, costosOper, utilidadOper, otrosIngresosMes, rentaCondonadaMes, utilidadTotal, reinversionMes, cmpVentas, cmpCostos, ventasDiarias, propinaPendiente, onCostChange }: {
  month: string; ventasMes: number; tarjetaMes: number; propinaTarjetaMes: number; costosOper: number; utilidadOper: number; otrosIngresosMes: number; rentaCondonadaMes: number; utilidadTotal: number; reinversionMes: number; cmpVentas: Venta[]; cmpCostos: Costo[]; ventasDiarias: Venta[]; propinaPendiente: number; onCostChange: () => void
}) {
  const { crt } = useOSSettings()
  const [faltan, setFaltan] = useState(0)   // previstos operativos impagos del mes → "provisional · faltan $X"
  // Nota de "cambió el método, no el negocio" — una vez (comparte la llave con XP: es el mismo hecho).
  const [notaMetodo, setNotaMetodo] = useState(false)
  useEffect(() => { try { setNotaMetodo(!localStorage.getItem('publico_cmp_metodo_v1')) } catch {} }, [])
  const cerrarNota = () => { try { localStorage.setItem('publico_cmp_metodo_v1', '1') } catch {} ; setNotaMetodo(false) }
  const [prevTotals, setPrevTotals] = useState({ pendiente: 0, vencido: 0, pagado: 0, mes: 0 })   // totales de la card de previstos
  const [fixed, setFixed] = useState(0)     // gasto fijo mensual (previstos fijos) → punto de equilibrio operativo
  const [rentaCond, setRentaCond] = useState(0)   // renta condonada mensual → 2º breakeven "de pie solo"
  const dc = crtDayColor(dayColor(new Date()), crt)   // color del día (monocolor de la pantalla)
  const [fc, setFc] = useState<number | null>(null)   // food cost teórico % del mes
  const [tp, setTp] = useState<number | null>(null)   // ticket promedio (POS) · DEL MES
  const [vp, setVp] = useState<number | null>(null)   // venta por persona (POS) · DEL MES (guests_count)
  const [diasOp, setDiasOp] = useState<number | null>(null)  // días con venta del mes (denominador de venta/día)
  const [clipRate, setClipRate] = useState(0.036)   // tasa de comisión de Clip (configurable) → margen del breakeven
  const [rateEd, setRateEd] = useState<string | null>(null)   // buffer de edición de la tasa
  const vd = diasOp != null && diasOp > 0 ? ventasMes / diasOp : null   // venta/día = las MISMAS ventas del mes ÷ días operados
  // Comisión EFECTIVA sobre ventas = proporción de ventas con tarjeta × tasa de Clip. Escala con el mix real:
  // si un mes vendes más en efectivo, baja sola. Entra al MARGEN del punto de equilibrio (como el food cost).
  const comEfectiva = comisionEfectiva({ ventas: ventasMes, tarjeta: tarjetaMes, propinaTarjeta: propinaTarjetaMes, tasaBase: clipRate })
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
    fetch('/api/publico/config').then((r) => r.json()).then((d: { clip_rate?: number }) => { if (alive && d.clip_rate != null) setClipRate(Number(d.clip_rate)) }).catch(() => {})
    return () => { alive = false }
  }, [month])

  const bord = `${dc}22`                                // divisiones de 1px, color del día tenue
  // Head/Metric/src del Panel = envoltorios delgados que inyectan el color del día sobre el KIT compartido
  // (components/sections/publico/ui). La fuente única vive en el kit; aquí solo se pinta con `dc`.
  const src = (s: 'pos' | 'manual') => srcTag(s, dc)
  const Head = ({ children }: { children: React.ReactNode }) => <CardHead tone={dc}>{children}</CardHead>
  const Metric = (p: Omit<Parameters<typeof KitMetric>[0], 'tone'>) => <KitMetric {...p} tone={dc} />
  // DELTA — fuente única (comparativo.ts), idéntica a la piel XP. Mes en curso → ventana RODANTE de 4 semanas
  // (28d = 4 de cada día de semana → el artefacto de fin de semana es imposible por aritmética). Mes cerrado →
  // mes-a-mes, anotado con el conteo de findes operados (para separar calendario de desempeño). Cruza meses:
  // cmpVentas/cmpCostos traen 3 meses de datos diarios.
  const todayISOx = new Date().toLocaleDateString('en-CA', { timeZone: 'America/Mexico_City' })
  const prevMonthCmp = shiftMonthDate(`${month}-01`, -1).slice(0, 7)
  const win = isCurrentMonth ? ventanaRodante(todayISOx) : ventanaMes(month, prevMonthCmp)
  const venVal = (v: Venta) => Number(v.efectivo) + Number(v.tarjeta)
  const curV = sumaRango(cmpVentas, win.desde, win.hasta, venVal)
  const prevV = sumaRango(cmpVentas, win.prevDesde, win.prevHasta, venVal)
  const dVenta = prevV > 0 ? ((curV - prevV) / prevV) * 100 : null
  const operCostos = cmpCostos.filter((c) => OPERATING_CATEGORIES.includes(c.category))
  const gCur = sumaRango(operCostos, win.desde, win.hasta, (c) => Number(c.amount))
  const gPrev = sumaRango(operCostos, win.prevDesde, win.prevHasta, (c) => Number(c.amount))
  const dGasto = gPrev > 0 ? ((gCur - gPrev) / gPrev) * 100 : null
  const uPrev = prevV - gPrev
  const dUtil = uPrev !== 0 && (curV > 0 || prevV > 0) ? (((curV - gCur) - uPrev) / Math.abs(uPrev)) * 100 : null
  const findesCur = win.tipo === 'mes' ? findesOperados(cmpVentas, month) : 0
  const findesPrev = win.tipo === 'mes' ? findesOperados(cmpVentas, prevMonthCmp) : 0
  const cmpLabel = etiquetaVentana(win)
  const hayDelta = dVenta != null
  const deltaBadge = (pct: number | null, goodUp: boolean) => {
    if (pct == null) return null
    const up = pct >= 0, good = up === goodUp
    return <span className={good ? 'text-ok' : 'text-warn'} style={{ fontSize: 11, fontWeight: 600 }} title={cmpLabel}>{up ? '▲' : '▼'}{Math.abs(pct).toFixed(0)}%</span>
  }
  const placeholder = (fase: string, txt: string) => <div className="text-secondary text-fg-muted"><span className="italic">{fase}</span> — {txt}</div>

  // Bento: bloques de distinto tamaño = jerarquía. Colapsa a 1 columna en móvil (grid-cols-1), usa el ancho
  // real en desktop (lg:grid-cols-6). Los bloques aún sin datos NO se esconden: se muestran con su leyenda.
  return (
    <div className="grid grid-cols-1 gap-3 lg:grid-cols-6">
      {/* LÍNEA DINÁMICA (Fase 5) — OCULTA hasta que exista: un bloque vacío no aporta. La Fase 5 (que "me lleve
          de la mano" leyendo mis datos) sigue PENDIENTE, no cancelada. Reaparece cuando se construya. */}

      {/* Fila asimétrica: MÉTRICAS + punto de equilibrio (2/3, el bloque hero) · alerta + qué toca (1/3). */}
      <Card emphasis="hero" tone={dc} pad="none" className="lg:col-span-4">
        <div className="px-3 pt-3"><Head>Métricas · {monthName(month)}</Head></div>
        {notaMetodo && (
          <div className="mx-3 mt-2 flex items-baseline gap-2 rounded border px-2 py-1 text-label text-fg-muted" style={{ borderColor: bord }}>
            <span className="flex-1"><b className="text-fg">Cambió el método de comparación</b>, no el negocio. Antes era mes-a-mes por día del mes (artefacto de calendario en un negocio de fin de semana); ahora es <b>ventana rodante de 4 semanas</b>. Por eso el número se movió (~▲26% → ▲47%) sin que pasara nada real.</span>
            <button onClick={cerrarNota} className="shrink-0 font-semibold hover:text-fg" style={{ color: dc }}>entendido ✕</button>
          </div>
        )}
        {hayDelta && (
          <div className="mx-3 mt-2 flex flex-wrap items-baseline gap-x-3 gap-y-0.5 text-label text-fg-muted">
            <span className="font-semibold uppercase tracking-wide" style={{ color: dc }}>{win.tipo === 'rodante' ? 'Momio' : 'Comparativo'} · {cmpLabel}</span>
            <span>ventas <b className="tabular-nums text-fg">{mxn(curV)}</b> vs <b className="tabular-nums">{mxn(prevV)}</b></span>
            {win.tipo === 'rodante'
              ? <span className="italic opacity-70">los ▲▼ comparan esta ventana, no el total del mes</span>
              : <span className={findesCur !== findesPrev ? 'text-warn' : 'opacity-70'}>findes operados: <b>{findesCur}</b> vs <b>{findesPrev}</b>{findesCur !== findesPrev ? ' — parte de la diferencia es calendario, no desempeño' : ''}</span>}
          </div>
        )}
        <div className="grid grid-cols-1 sm:grid-cols-2" style={{ borderTop: `1px solid ${bord}` }}>
          {/* Par de caras: VENTAS (POS, cierto) y GASTOS (manual, incompleto) — mismo peso visual, procedencia honesta. */}
          <div style={{ borderBottom: `1px solid ${bord}`, borderRight: `1px solid ${bord}` }}><Metric name={<>Ventas del mes{src('pos')}</>} value={mxn(ventasMes)} big delta={deltaBadge(dVenta, true)} /></div>
          <div style={{ borderBottom: `1px solid ${bord}` }}><Metric name={<>Gastos del mes<span style={{ opacity: 0.5 }}> · poster + manual</span></>} value={`−${mxn(costosOper)}`} big hint="compras de Poster + capturas · incompleto hasta cerrar el mes" delta={deltaBadge(dGasto, false)} /></div>
          {/* PRECAUCIÓN DE LECTURA: food cost = CONSUMO (recetas del POS), NO compras÷ventas. Surtirse por
              adelantado infla compras/ventas (jun 59%, jul 49%) muy arriba del teórico 31% — es periodificación,
              no food cost. GASTOS y FOOD COST viven en celdas distintas y nunca se dividen entre sí. */}
          <div style={{ borderBottom: `1px solid ${bord}`, borderRight: `1px solid ${bord}` }}><Metric name={<>Food cost teórico · mes{src('pos')}</>} value={fc != null ? `${fc.toFixed(1)}%` : '…'} hint="consumo de recetas · no es gastos ÷ ventas" /></div>
          <div style={{ borderBottom: `1px solid ${bord}` }}><Metric name={<>Ticket promedio · mes{src('pos')}</>} value={tp != null ? mxn(tp) : '…'} hint="promedio por recibo · no por persona" /></div>
          {/* Venta por persona: sí capturas comensales (guests_count ≈ 2.4/recibo), así que es un número real y distinto del ticket. */}
          <div style={{ borderRight: `1px solid ${bord}` }}><Metric name={<>Venta · por persona · mes{src('pos')}</>} value={vp != null ? mxn(vp) : '…'} hint="÷ comensales del recibo" /></div>
          <div><Metric name={<>Venta · día operado · mes{src('pos')}</>} value={vd != null ? mxn(vd) : '…'} hint={diasOp != null ? `÷ ${diasOp} días con venta · no del calendario` : '÷ días con venta · no del calendario'} /></div>
        </div>
        {/* Utilidad (provisional) */}
        <div className="px-3 py-3" style={{ borderTop: `1px solid ${bord}` }}>
          <div className="flex items-center justify-between gap-2">
            <span className="text-label uppercase tracking-widest text-fg-muted">Utilidad operativa {isCurrentMonth
              ? <span className="text-warn" style={{ border: '1px solid currentColor', borderRadius: 4, padding: '0 4px', fontSize: 9, letterSpacing: 1 }}>provisional</span>
              : <span className="text-ok" style={{ border: '1px solid currentColor', borderRadius: 4, padding: '0 4px', fontSize: 9, letterSpacing: 1 }}>mes cerrado</span>}</span>
            <span className="flex items-baseline gap-1.5"><span className="tabular-nums" style={{ color: dc, fontSize: 22, fontWeight: 700 }}>{mxn(utilidadOper)}</span>{deltaBadge(dUtil, true)}</span>
          </div>
          <div className="mt-1 text-label text-fg-muted italic">= ventas del mes − gastos capturados</div>
          {/* Honestidad: la utilidad se INFLA cuando faltan costos. Los fijos/nómina viven en previstos y no
              restan hasta marcarse pagados; el mes en curso además tiene compras por capturar. Lo decimos claro. */}
          {(faltan > 0 || isCurrentMonth) && (
            <div className="mt-1 text-label text-warn" style={{ lineHeight: 1.3 }}>
              se ve alta —{faltan > 0 && <> aún no resta <b className="tabular-nums">{mxn(faltan)}</b> de nómina/fijos sin marcar como pagados</>}{faltan > 0 && isCurrentMonth && ' ·'}{isCurrentMonth && ' compras del mes aún por capturar'}. La real será menor.
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
          <div className="text-label uppercase tracking-widest text-fg-muted">Punto de equilibrio · en días</div>
          {(() => {
            if (fixed <= 0) return <div className="mt-1 flex items-center gap-2"><span className="tabular-nums text-lg tracking-widest" style={{ color: dc, opacity: 0.35 }}>▮▯▯▯▯</span><span className="text-secondary italic text-warn">falta configurar gastos fijos</span></div>
            // Margen = 1 − food cost teórico − comisión efectiva (ambos escalan con las ventas). La comisión ya
            // NO se ignora: con tarjeta siendo la mayoría, mueve el breakeven varios puntos.
            const margin = fc != null ? 1 - fc / 100 - comEfectiva : null
            if (margin == null) return <div className="mt-1 text-secondary italic text-fg-muted">food cost teórico pendiente para el margen…</div>
            if (margin <= 0) return <div className="mt-1 text-secondary italic text-warn">food cost teórico + comisión ≥ 100% — revisa, no hay margen</div>
            // EQUILIBRIO EN DÍAS (no "% de barra llena"): en qué día del mes las ventas acumuladas cruzan los
            // fijos. Contesta "cubriste tus fijos el día N — de ahí, todo es utilidad". Monocromo con dc: la
            // regla de oro del OS dice que el color solo marca el DÍA de semana; los estados quedan neutros.
            const [yy, mmn] = month.split('-').map(Number)
            const dim = new Date(yy, mmn, 0).getDate()
            const curDay = isCurrentMonth ? Number(todayISOx.slice(8, 10)) : dim
            const beRow = (label: string, fijos: number, sub: string) => {
              const be = fijos / margin
              const sorted = [...ventasDiarias].sort((a, b) => a.date.localeCompare(b.date))
              const total = sorted.reduce((s, v) => s + Number(v.efectivo) + Number(v.tarjeta), 0)
              const cumByDay: number[] = Array(dim + 1).fill(0)
              let cum = 0
              for (const v of sorted) { cum += Number(v.efectivo) + Number(v.tarjeta); const d = Number(v.date.slice(8, 10)); if (d >= 1 && d <= dim) cumByDay[d] = cum }
              for (let i = 1; i <= dim; i++) if (cumByDay[i] === 0 && i > 1) cumByDay[i] = cumByDay[i - 1]
              let crossDay: number | null = null
              for (let i = 1; i <= dim; i++) if (cumByDay[i] >= be) { crossDay = i; break }
              const opDays = sorted.filter((v) => Number(v.efectivo) + Number(v.tarjeta) > 0).length
              const avg = opDays > 0 ? total / opDays : 0
              const projDay = !crossDay && avg > 0 ? curDay + Math.ceil((be - total) / avg) : null
              const cellBg = (day: number) => (crossDay != null && day >= crossDay ? dc : day <= curDay ? `${dc}55` : `${dc}18`)
              return (
                <div className="space-y-1">
                  <div className="text-label text-fg-muted"><b className="uppercase" style={{ color: dc }}>{label}</b> · fijos {mxn(fijos)} → necesitas <b className="tabular-nums" style={{ color: dc }}>{mxn(be)}</b></div>
                  <div className="flex h-3 gap-px">{Array.from({ length: dim }).map((_, i) => <div key={i} className="flex-1" title={`día ${i + 1}`} style={{ background: cellBg(i + 1), borderLeft: crossDay === i + 1 ? '2px solid #00000066' : undefined }} />)}</div>
                  <div className="text-label">
                    {crossDay != null
                      ? <><span className="text-ok">✓ Cubriste tus fijos el día {crossDay}</span> — de ahí, todo es utilidad. <span className="text-fg-muted">+{mxn(total - be)} sobre el equilibrio.</span></>
                      : projDay != null && projDay <= dim
                        ? <>Vas <b className="tabular-nums">{mxn(total)}</b> de {mxn(be)} — a tu ritmo (~{mxn(avg)}/día), lo cruzas <b>~el día {projDay}</b>.</>
                        : <span className="text-warn">A este ritmo no alcanza este mes — faltan {mxn(be - total)}.</span>}
                    <span className="text-fg-muted"> · {sub}</span>
                  </div>
                </div>
              )
            }
            return (
              <div className="mt-1 space-y-3">
                {/* Desglose del margen: se ve de dónde sale, con la TASA de Clip editable inline (se guarda en config). */}
                <div className="flex flex-wrap items-baseline gap-x-1 text-label text-fg-muted">
                  <span>margen <b className="tabular-nums" style={{ color: dc }}>{(margin * 100).toFixed(1)}%</b> = 1 − food cost {fc!.toFixed(1)}% − comisión <b className="tabular-nums">{(comEfectiva * 100).toFixed(1)}%</b> <i className="opacity-80">medido · recibo 19-ago</i></span>
                  <span className="opacity-70">(venta+propina tarjeta {ventasMes > 0 ? Math.round(((tarjetaMes + propinaTarjetaMes) / ventasMes) * 100) : 0}% × tasa
                    <input value={rateEd ?? (clipRate * 100).toFixed(2)} onChange={(e) => setRateEd(e.target.value)}
                      onBlur={() => { const v = parseFloat(rateEd ?? ''); setRateEd(null); if (Number.isFinite(v) && Math.abs(v / 100 - clipRate) > 1e-6) { setClipRate(v / 100); void fetch('/api/publico/config', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ clip_rate: v }) }) } }}
                      onKeyDown={(e) => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur() }}
                      inputMode="decimal" title="tasa de comisión de Clip (editable) — pon tu tasa real del estado de cuenta de Clip (la API no reporta el fee para tu cuenta)"
                      style={{ width: 44, margin: '0 3px', padding: '1px 4px', fontSize: 12, borderRadius: 4, border: '1px solid var(--color-border)', background: 'var(--color-surface-base, #fff)', color: 'inherit', textAlign: 'right' }} />% + IVA)</span>
                </div>
                {beRow('Operativo', fixed, 'con la renta que le condonas')}
                {rentaCond > 0
                  ? beRow('De pie solo', fixed + rentaCond, `+ renta ${mxn(rentaCond)} · cuándo paga su propia renta`)
                  : <div className="text-label italic text-fg-muted">Agrega la renta como previsto (categoría <b>Renta condonada</b>) para ver el <b>&quot;de pie solo&quot;</b> — cuándo el negocio paga su propia renta.</div>}
              </div>
            )
          })()}
        </div>
      </Card>

      {/* Alerta + qué toca (1/3). Contenido: Fase 5. */}
      <Card emphasis="hero" tone={dc} pad="none" className="px-3 py-3 lg:col-span-2">
        <Head>Alerta · qué toca</Head>
        {/* Motor: lib/publico/quetoca.ts vía /api/publico/quetoca. El ritual del domingo (propina + nómina en una
            sola tarjeta) y el anti-tapiz viven en el motor, no aquí — esto es solo la presentación. */}
        <QueToca tone={dc} />
      </Card>

      {/* Fila de dos iguales: gastos previstos (Fase 2) · contenedores (Fase 3). */}
      <Card emphasis="hero" tone={dc} pad="none" className="px-3 py-3 lg:col-span-3">
        <Head>Gastos previstos {(prevTotals.pendiente > 0 || prevTotals.vencido > 0) && (
          <span className="font-normal normal-case tracking-normal text-fg-muted">· pendiente <b className="tabular-nums text-fg">{mxn(prevTotals.pendiente)}</b>{prevTotals.vencido > 0 && <span className="text-danger"> · vencido <b className="tabular-nums">{mxn(prevTotals.vencido)}</b></span>}</span>
        )}</Head>
        <Previstos month={month} onFaltan={setFaltan} onFixed={setFixed} onRentaCond={setRentaCond} onTotals={setPrevTotals} onCostChange={onCostChange} />
      </Card>
      <Card emphasis="hero" tone={dc} pad="none" className="px-3 py-3 lg:col-span-3">
        <Head>Contenedores</Head>
        {/* Los contenedores son el dinero que hay AHORA (efectivo físico + derivado), no un saldo mensual. En un
            mes pasado no aplican: mostrarlos bajo "junio" implicaría que son de junio, y no lo son. Se ocultan. */}
        {isCurrentMonth
          ? <Contenedores dc={dc} month={month} />
          : <div className="text-secondary italic text-fg-muted">Los saldos son de <b>hoy</b>, no de un mes pasado. Vuelve al mes en curso para verlos y cuadrarlos.</div>}
      </Card>
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
  costByCategory: Array<{ categoryId: string; name: string; bucket: string; revenue: number; cost: number; pct: number }>
  costBuckets: { food: Bucket; bevEnv: Bucket; bevPrep: Bucket; beverage: Bucket; otro: Bucket; prime: Bucket }
  topProducts: ProductStat[]; hours: HourStat[]; dow: DowStat[]
  guardian: { count: number; receipts: Array<{ id: string; date: string; time: string; sum: number }> }
}
type Bucket = { revenue: number; cost: number; pct: number }

function Direccion() {
  const { crt } = useOSSettings()
  const dc = crtDayColor(dayColor(new Date()), crt)   // color del día → las métricas hablan el mismo idioma que el Panel
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

  if (err) return <Card className="text-secondary text-danger">{err}</Card>
  if (!m) return <Card className="text-secondary text-fg-muted">Cargando dirección…</Card>

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
        <div className="rounded-card border border-danger bg-danger/10 p-3 text-secondary">
          <div className="font-bold text-danger">{m.guardian.count} recibo(s) cerraron entre 00:00 y 06:00 CDMX</div>
          <div className="mt-1 text-fg-muted">El supuesto de “día natural = getPaymentsReport” asume que se cierra antes de medianoche. Estos cruzan ese límite — revisa si la operación cambió de horario:</div>
          <div className="mt-1 space-y-0.5">
            {m.guardian.receipts.map((r) => (
              <div key={r.id} className="flex justify-between tabular-nums"><span>#{r.id} · {dayMonth(r.date)} {r.time}</span><span>{mxn(r.sum)}</span></div>
            ))}
          </div>
        </div>
      )}

      {/* ── RESUMEN — métricas del HISTÓRICO con <Metric>. Rango CLARÍSIMO: Dirección cubre TODO el histórico
          (no el mes del Panel); ahora que comparten componente visual es fácil confundirlos. ── */}
      <Card emphasis="hero" tone={dc} pad="none">
        <div className="flex flex-wrap items-baseline justify-between gap-x-2 px-3 pt-3">
          <CardHead tone={dc}>Dirección · histórico completo</CardHead>
          <span className="text-label text-fg-muted">{dayMonth(m.range.from)} → {dayMonth(m.range.to)} · <b className="text-fg">todo, no el mes</b></span>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-4" style={{ borderTop: `1px solid ${dc}22` }}>
          <div><KitMetric tone={dc} name={<>Ticket promedio · histórico{srcTag('pos', dc)}</>} value={mxn(m.ticketPromedio)} hint="promedio por recibo" /></div>
          <div><KitMetric tone={dc} name={<>Venta · día operado · histórico{srcTag('pos', dc)}</>} value={mxn(m.ventaPorDiaOperado)} hint={`÷ ${m.daysOperated} días operados · no del calendario`} /></div>
          <div><KitMetric tone={dc} name={<>Recibos · histórico{srcTag('pos', dc)}</>} value={String(m.receipts)} hint={`en ${m.daysOperated} días operados`} /></div>
          <div><KitMetric tone={dc} name={<>Comensales · prom · histórico{srcTag('pos', dc)}</>} value={m.guestsPromedio.toFixed(1)} hint="por recibo" /></div>
        </div>
        <div className="border-t px-3 py-2 text-label text-fg-muted" style={{ borderColor: `${dc}22` }}>
          <b className="text-fg">{m.daysOperated}</b> días operados de {m.range.calendarDays} de calendario ({closedDays} cerrados). Los promedios por día usan los operados, no el calendario.
        </div>
      </Card>

      {/* ── MARGEN TEÓRICO | TOP PRODUCTOS (lado a lado; colapsa a 1 columna en móvil) ── */}
      <BentoRow>
        <Card>
          <CardHead tone={dc}>Costo teórico por categoría</CardHead>
          {/* RESUMEN encima: comida / bebida / prime. El food cost deja de estar inflado por la bebida. */}
          <div className="mb-1 flex flex-wrap items-baseline gap-x-4 gap-y-0.5 text-secondary">
            <span>Comida <b className="tabular-nums text-fg">{m.costBuckets.food.pct.toFixed(1)}%</b></span>
            <span>Bebida <b className="tabular-nums text-fg">{m.costBuckets.beverage.pct.toFixed(1)}%</b></span>
            <span>Prime <b className="tabular-nums" style={{ color: dc }}>{m.costBuckets.prime.pct.toFixed(1)}%</b></span>
          </div>
          <div className="mb-2 text-label text-fg-muted">prime = COGS combinado (comida + bebida) · la nómina va aparte en los fijos del breakeven</div>
          {/* POR CATEGORÍA, ordenada por venta. Aquí se ve que entradas cuesta casi el doble que pizza. */}
          <div className="grid grid-cols-[1fr_auto_auto_auto] gap-x-3 gap-y-1 text-label">
            <span className="text-fg-muted">Categoría</span>
            <span className="text-right text-fg-muted">Venta</span>
            <span className="text-right text-fg-muted">Costo</span>
            <span className="text-right text-fg-muted">%</span>
            {m.costByCategory.map((c) => (
              <Fragment key={c.categoryId || c.name}>
                <span className="truncate text-secondary">{c.name}</span>
                <span className="text-right tabular-nums text-fg-muted">{mxn(c.revenue)}</span>
                <span className="text-right tabular-nums text-fg-muted">{mxn(c.cost)}</span>
                <span className="text-right font-medium tabular-nums text-fg">{c.pct.toFixed(1)}%</span>
              </Fragment>
            ))}
            <span className="border-t border-border pt-1 font-medium text-fg">Total · prime</span>
            <span className="border-t border-border pt-1 text-right tabular-nums text-fg-muted">{mxn(m.costBuckets.prime.revenue)}</span>
            <span className="border-t border-border pt-1 text-right tabular-nums text-fg-muted">{mxn(m.costBuckets.prime.cost)}</span>
            <span className="border-t border-border pt-1 text-right font-bold tabular-nums" style={{ color: dc }}>{m.costBuckets.prime.pct.toFixed(1)}%</span>
          </div>
          <div className="mt-2 text-label text-fg-muted">Teórico = product_cost de las recetas. Comida y bebida por separado; la reventa embotellada por su costo unitario. El real (entre conteos) llega en F4.</div>
        </Card>
        <Card>
          <div className="mb-2 flex items-center justify-between">
            <CardHead tone={dc}>Top productos</CardHead>
            <div className="flex gap-1">
              <button onClick={() => setSortBy('revenue')} style={sortBy === 'revenue' ? { background: dc } : undefined} className={`rounded px-2 py-0.5 text-label ${sortBy === 'revenue' ? 'text-white' : 'text-fg-muted'}`}>facturación</button>
              <button onClick={() => setSortBy('units')} style={sortBy === 'units' ? { background: dc } : undefined} className={`rounded px-2 py-0.5 text-label ${sortBy === 'units' ? 'text-white' : 'text-fg-muted'}`}>unidades</button>
            </div>
          </div>
          <div className="space-y-1.5">
            {products.map((p) => (
              <div key={p.id} className="text-secondary">
                <div className="flex items-baseline justify-between">
                  <span className="truncate pr-2">{p.name}</span>
                  <span className="shrink-0 tabular-nums text-fg-muted">{p.units.toFixed(0)} uds · <span className="text-fg">{mxn(p.revenue)}</span> · {p.margin.toFixed(0)}%</span>
                </div>
                <StatBar tone={dc} value={(sortBy === 'revenue' ? p.revenue : p.units) / maxProd} />
              </div>
            ))}
          </div>
        </Card>
      </BentoRow>

      {/* ── HORAS PICO | DÍA DE LA SEMANA (lado a lado; barras a media anchura con <StatBar>) ── */}
      <BentoRow>
        <Card>
          <CardHead tone={dc}>Horas pico <span className="font-normal normal-case tracking-normal text-fg-muted">(cierre, CDMX)</span></CardHead>
          <div className="space-y-1">
            {hoursActive.map((h) => (
              <StatBar key={h.hour} tone={dc} label={`${String(h.hour).padStart(2, '0')}h`} value={h.receipts / maxHour} right={`${h.receipts} · ${mxn(h.revenue)}`} />
            ))}
          </div>
        </Card>
        <Card>
          <CardHead tone={dc}>Día de la semana</CardHead>
          <div className="space-y-1">
            {dowOrder.map((d) => {
              const row = m.dow[d]
              return <StatBar key={d} tone={dc} label={row.label} value={row.receipts / maxDow} right={`${row.receipts} · ${mxn(row.revenue)}`} />
            })}
          </div>
        </Card>
      </BentoRow>
    </>
  )
}

// ── Food cost real vs teórico (F4). Métrica principal = GAP. Teórico por MES (siempre, 99% cobertura);
// real+gap SOLO en PERIODOS entre conteos físicos (no por mes: el ajuste del conteo se contabiliza el día
// del conteo). Prefiere decir "no confiable" a un número falso. ──
type FCMonth = { month: string; sales: number; theoreticalPct: number }
type FCPeriod = { from: string; to: string; kind: 'arranque' | 'confiable' | 'abierto'; sales: number; theoreticalPct: number; realPct: number | null; gapPct: number | null; startupAdjustment?: number; contaminated?: boolean; days?: number; note?: string }
type FCData = { theoreticalByMonth: FCMonth[]; periods: FCPeriod[]; lastCountDate: string | null; daysSinceCount: number | null; countAlert: boolean; anyReliable: boolean; todayStatus: string }
// Food cost real POR TUS CONTEOS (endpoint /foodcost-real): (inv inicial + compras − inv final) ÷ ventas.
type ClaseSplit = { comida: number; bebida: number; empaque: number; sinClas: number }
type FCRealPeriod = { from: string; to: string; days: number; kind: 'confiable' | 'abierto'; invIni: number; invFin: number | null; compras: number; ventas: number; consumo: number | null; realPct: number | null; consumoByClase?: ClaseSplit; note?: string }
type FCReal = { periods: FCRealPeriod[]; counts: Array<{ id: string; fecha: string; value: number }>; status: string }

const KIND_BADGE: Record<FCPeriod['kind'], { dot: string; label: string; cls: string }> = {
  confiable: { dot: '●', label: 'acotado por conteos', cls: 'text-ok' },
  arranque: { dot: '◐', label: 'arranque del sistema', cls: 'text-warn' },
  abierto: { dot: '○', label: 'en curso · sin conteo', cls: 'text-fg-muted' },
}
const MESES = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic']
const monthLabel = (m: string) => { const [y, mm] = m.split('-'); return `${MESES[Number(mm) - 1]} ${y}` }
const dayLabelShort = (iso: string) => { const [, mm, dd] = iso.split('-'); return `${Number(dd)} ${MESES[Number(mm) - 1]}` }

type EmpMonth = { month: string; sales: number; empaque: number; pct: number | null }

function FoodCostPanel() {
  const { crt } = useOSSettings()
  const dc = crtDayColor(dayColor(new Date()), crt)   // color del día → mismo idioma de headers que el resto de Público
  const [d, setD] = useState<FCData | null>(null)
  const [err, setErr] = useState<string | null>(null)
  const [emp, setEmp] = useState<EmpMonth[] | null>(null)
  const [real, setReal] = useState<FCReal | null>(null)   // food cost real por TUS conteos (100% del OS)
  useEffect(() => {
    let alive = true
    fetch('/api/publico/foodcost').then((r) => r.json())
      .then((j) => { if (!alive) return; if (j.error) setErr(j.error); else setD(j) })
      .catch(() => alive && setErr('No se pudo cargar el food cost'))
    fetch('/api/publico/empaque').then((r) => r.json())
      .then((j) => { if (alive && j.byMonth) setEmp(j.byMonth) }).catch(() => {})
    fetch('/api/publico/foodcost-real').then((r) => r.json())
      .then((j) => { if (alive && j.periods) setReal(j) }).catch(() => {})
    return () => { alive = false }
  }, [])

  if (err) return <Card className="text-secondary text-danger">{err}</Card>
  if (!d) return <Card className="text-secondary text-fg-muted">Cargando food cost…</Card>

  return (
    <Card>
      <CardHead tone={dc}>Food cost · real vs teórico</CardHead>

      {/* ── REAL POR TUS CONTEOS — 100% del OS (inv inicial + compras − inv final) ÷ ventas, sin el perpetuo de Poster ── */}
      <div className="mb-3 rounded-card border p-2" style={{ borderColor: `${dc}44` }}>
        <div className="mb-1 text-label uppercase tracking-widest" style={{ color: dc }}>Real · por tus conteos</div>
        {(real?.periods.filter((p) => p.kind === 'confiable').length ?? 0) === 0
          ? <div className="text-label text-fg-muted">{real?.status ?? 'Cargando…'}</div>
          : <div className="space-y-1">
              {real!.periods.filter((p) => p.kind === 'confiable').map((p, i) => {
                const cbc = p.consumoByClase
                return (
                <div key={i}>
                  <div className="flex flex-wrap items-baseline justify-between gap-x-2 text-secondary">
                    <span className="text-fg-muted">{dayLabelShort(p.from)} → {dayLabelShort(p.to)} <span className="opacity-60">· {p.days}d</span></span>
                    <span className="text-label text-fg-muted">consumo {mxn(p.consumo!)} ÷ ventas {mxn(p.ventas)} = <b className="tabular-nums" style={{ color: dc }}>{p.realPct!.toFixed(1)}%</b></span>
                  </div>
                  {/* Consumo real partido por clase (inventario por ingrediente · compras por la mezcla del stock). */}
                  {cbc && (p.consumo ?? 0) > 0 && (
                    <div className="mt-0.5 flex flex-wrap gap-x-3 pl-1 text-label text-fg-muted">
                      <span>comida <b className="tabular-nums text-fg">{mxn(cbc.comida)}</b></span>
                      <span>bebida <b className="tabular-nums text-fg">{mxn(cbc.bebida)}</b></span>
                      {cbc.empaque > 0.5 && <span>empaque <b className="tabular-nums text-fg">{mxn(cbc.empaque)}</b></span>}
                      {cbc.sinClas > 0.5 && <span className="text-warn">sin clasificar <b className="tabular-nums">{mxn(cbc.sinClas)}</b></span>}
                    </div>
                  )}
                </div>
              )})}
            </div>}
      </div>

      {/* Estado de hoy, sin adornos */}
      <div className={`mb-2 rounded-card border p-2 text-label ${d.anyReliable ? 'border-border text-fg-muted' : 'border-warn text-warn'}`}>{d.todayStatus}</div>

      {/* Aviso de conteo accionable */}
      {d.countAlert && (
        <div className="mb-2 rounded-card border border-danger bg-danger/10 p-2 text-label text-danger">Último conteo físico hace {d.daysSinceCount} días ({d.lastCountDate}). Hacer un conteo desbloquea el food cost real de este periodo.</div>
      )}

      {/* Real por PERIODO entre conteos (la métrica) */}
      <div className="mb-1 text-label text-fg-muted">Real por periodo de conteo</div>
      <div className="space-y-2">
        {d.periods.map((p, i) => {
          // Un 'confiable' demasiado largo se presenta como RECONCILIACIÓN, no como merma: el gap no es un
          // hallazgo del negocio (mezcla drift + compras no escritas al perpetuo). Badge y gap amortiguados.
          const b = p.contaminated ? { dot: '◑', label: `reconciliación · ${p.days} días`, cls: 'text-warn' } : KIND_BADGE[p.kind]
          return (
            <Card key={i} pad="sm">
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
            </Card>
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

      <div className="mt-2 border-t border-border pt-2 text-label text-fg-muted">El gap (real − teórico) es merma + sobre-porción + desperdicio + robo. Solo es legítimo en periodos cerrados entre dos conteos físicos.</div>

      {/* EMPAQUE · % de ventas — SEPARADO del food cost (no es consumo de receta). Es lo que se va CON la venta
          (cajas, vasos, servilletas); escala con el volumen, por eso se mira como % de ventas. Punto 5. */}
      {emp && emp.some((m) => m.empaque > 0) && (
        <Card pad="sm" className="mt-3" style={{ borderStyle: 'dashed' }}>
          <CardHead tone={dc}>Empaque · % de ventas <span className="font-normal normal-case tracking-normal">(no es food cost — lo que se va con la venta)</span></CardHead>
          <div className="space-y-0.5">
            {emp.map((m) => (
              <div key={m.month} className="flex items-baseline justify-between text-secondary">
                <span className="text-fg-muted">{monthLabel(m.month)}</span>
                <span className="tabular-nums"><span className="text-fg-muted">{mxn(m.empaque)} · </span><span className="font-medium text-fg">{m.pct != null ? `${m.pct.toFixed(1)}%` : '—'}</span></span>
              </div>
            ))}
          </div>
          <div className="mt-1 text-label text-fg-muted">Sube = sirves más (bien) o el empaque se encareció (revisar). Nunca se suma al food cost.</div>
        </Card>
      )}
    </Card>
  )
}

// ── Socios (F2): las dos libretas (reusan FundLedger/FundMovementControl) + % de reparto configurable
// + reparto sugerido de la utilidad (SOLO LECTURA — guía, no crea asientos; el % es provisional). El
// origen (contenedor) se captura en cada aportación/retiro para el cuadre de F5. ──
// Alex | Andrés lado a lado (cards idénticas, el caso de libro del bento). Colapsa a 1 col en móvil.
function Socios({ funds, handlers }: {
  funds: Fund[]
  handlers: ReturnType<typeof useCajaFuerte>['handlers']
}) {
  return (
    <BentoRow>
      {['socio_alex', 'socio_andres'].map((key) => {
        const f = funds.find((x) => x.key === key)
        if (!f) return <p key={key} className="text-secondary italic text-fg-muted">Falta el fondo {key} — ¿corriste la migración 0053?</p>
        return (
          <Card key={key}>
            <div className="mb-2 flex items-baseline justify-between">
              <h2 className="text-base font-bold">{f.label}</h2>
              <span className="text-secondary text-fg-muted">saldo <span className="font-bold tabular-nums text-fg">{mxn(f.saved)}</span></span>
            </div>
            <FundMovementControl accounts={SOCIO_ACCOUNTS} hint="Aportar entra · Retirar sale" onSubmit={(flow, desc, amount, metodo) => handlers.onAportaRetira(f.id, flow, desc, amount, metodo)} />
            <div className="mt-3"><FundLedger movements={f.movements} /></div>
          </Card>
        )
      })}
    </BentoRow>
  )
}

// Reparto = card aparte (va lado a lado con Otros ingresos en el bento de Fondos).
function Reparto({ splitAlex, onSplit, utilidadOper }: { splitAlex: number; onSplit: (v: number) => void; utilidadOper: number }) {
  const { crt } = useOSSettings()
  const dc = crtDayColor(dayColor(new Date()), crt)   // color del día → header en el mismo idioma que Panel/Dirección
  return (
    <Card>
      <CardHead tone={dc}>Reparto</CardHead>
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
    </Card>
  )
}
