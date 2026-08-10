'use client'

import { useEffect, useRef, useState } from 'react'
import type { CalEvent } from '@/app/api/calendar/route'
import { GroupBox, XpSelect, XpSpinner, XpContextMenu, XpDialogModal, XpField, XpLabel } from './xp-controls'

// "Propiedades de Fecha y hora" — DIÁLOGO DE SISTEMA XP NATIVO LITERAL (no reusa CalendarCard).
// Group box "Fecha" (calendario XP: dropdown mes + spinner año, día seleccionado = cuadro azul) +
// group box "Hora" (reloj análogo teal en marco hundido + digital en cajita con spinner). Conserva de
// mi OS: los markers de eventos/cumpleaños. Headers grises XP (el rainbow es del tambor). Solo PIEL.

const MONTHS = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre']
const DOW = ['L', 'M', 'M', 'J', 'V', 'S', 'D']
const BIRTHDAY = { month: 6, day: 28 }   // 0-indexed: julio 28
const XP_BLUE = '#3163c8'

const key = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`

function buildGrid(year: number, month: number) {
  const last = new Date(year, month + 1, 0).getDate()
  const startOffset = (new Date(year, month, 1).getDay() + 6) % 7
  const cells: { date: Date; cur: boolean }[] = []
  for (let i = startOffset - 1; i >= 0; i--) cells.push({ date: new Date(year, month, -i), cur: false })
  for (let d = 1; d <= last; d++) cells.push({ date: new Date(year, month, d), cur: true })
  while (cells.length % 7) cells.push({ date: new Date(year, month, last + (cells.length % 7)), cur: false })
  return cells
}

// El día (yyyy-mm-dd) de un evento, allDay o con hora.
const evDay = (e: CalEvent) => (e.allDay ? e.start.slice(0, 10) : key(new Date(e.start)))
const isCaptured = (e: CalEvent) => e.uid.startsWith('captured:')

// ── Diálogo XP de evento (crear / editar) — puerta de ESCRITURA del calendario bajo XP. Mismo patrón
//    que el EditModal-piloto: caja #ECE9D8 compacta, campos de época, Aceptar/Cancelar (+ Eliminar). ──
function EventDialog({ event, date, onClose, onSaved }: {
  event: CalEvent | null   // null = crear
  date: string             // yyyy-mm-dd prellenado
  onClose: () => void
  onSaved: (savedDate: string) => void
}) {
  const editingId = event && isCaptured(event) ? event.uid.slice('captured:'.length).split('#')[0] : null
  const [title, setTitle] = useState(event?.title ?? '')
  const [note, setNote] = useState(event?.note ?? '')
  // Multi-día: editar cualquier día del tramo prellena inicio=spanStart y fin=spanEnd.
  const [d, setD] = useState(event?.spanStart ?? (event ? event.start.slice(0, 10) : date))
  const [end, setEnd] = useState(event?.spanEnd ?? '')
  const [time, setTime] = useState(event && !event.allDay ? event.start.slice(11, 16) : '')
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState<string | null>(null)
  const isSpan = !!end && end > d

  async function save() {
    if (!title.trim() || !d || busy) return
    setBusy(true); setErr(null)
    try {
      const payload = { title, event_date: d, event_end_date: isSpan ? end : undefined, event_time: isSpan ? undefined : (time || undefined), note: note || undefined }
      const res = await fetch(editingId ? `/api/calendar/${editingId}` : '/api/calendar', {
        method: editingId ? 'PATCH' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok || data.error) { setErr(data.error ?? 'Error al guardar'); return }
      onSaved(d); onClose()
    } catch (e) { setErr(String(e)) } finally { setBusy(false) }
  }
  async function remove() {
    if (!editingId || busy) return
    setBusy(true)
    try { await fetch(`/api/calendar/${editingId}`, { method: 'DELETE' }) } catch { /* refetch reconcilia */ }
    onSaved(d); onClose()
  }

  return (
    <XpDialogModal
      open title={editingId ? 'Editar evento' : 'Nuevo evento'} width={356}
      onCancel={onClose} onOk={save}
      okLabel={busy ? 'Guardando…' : 'Aceptar'} okDisabled={busy || !title.trim() || !d}
      onDelete={editingId ? remove : undefined}
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: 9 }}>
        <div>
          <XpLabel>Título</XpLabel>
          <XpField autoFocus value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Título del evento" />
        </div>
        <div>
          <XpLabel>Nota</XpLabel>
          <textarea className="xp-sunken" value={note} onChange={(e) => setNote(e.target.value)} rows={2}
            style={{ width: '100%', padding: '4px 5px', fontFamily: 'inherit', fontSize: 11, resize: 'none', outline: 'none' }} placeholder="Opcional…" />
        </div>
        <div style={{ display: 'flex', gap: 10 }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <XpLabel>Fecha</XpLabel>
            <XpField type="date" value={d} onChange={(e) => setD(e.target.value)} />
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <XpLabel>Hasta (opcional)</XpLabel>
            <XpField type="date" value={end} min={d} onChange={(e) => setEnd(e.target.value)} />
          </div>
        </div>
        {!isSpan && (
          <div style={{ width: 110 }}>
            <XpLabel>Hora</XpLabel>
            <XpField type="time" value={time} onChange={(e) => setTime(e.target.value)} />
          </div>
        )}
        {err && <p style={{ fontSize: 11, color: '#a0201a', margin: 0 }}>{err}</p>}
      </div>
    </XpDialogModal>
  )
}

// ── Calendario XP ────────────────────────────────────────────────────────────
// La ESCRITURA (diálogo de evento) se renderiza en el nivel del padre, no aquí: XpCalendar vive dentro
// del GroupBox "Fecha" (que es `position: relative`) y el diálogo es `absolute inset-0` → si lo montara
// aquí se scoparía a la cajita del calendario en vez de a la ventana. Por eso abre por callback.
function XpCalendar({ onNew, onEdit, reloadToken }: {
  onNew: (date: string) => void
  onEdit: (event: CalEvent, date: string) => void
  reloadToken: number
}) {
  const today = new Date()
  const [y, setY] = useState(today.getFullYear())
  const [m, setM] = useState(today.getMonth())
  const [sel, setSel] = useState(key(today))
  const [events, setEvents] = useState<CalEvent[]>([])
  const [ctx, setCtx] = useState<{ x: number; y: number; day: string } | null>(null)   // menú (px lógicos)
  const rootRef = useRef<HTMLDivElement>(null)

  function refetch() {
    const c = buildGrid(y, m)
    const from = key(c[0].date), to = key(c[c.length - 1].date)
    fetch(`/api/calendar?from=${from}&to=${to}`)
      .then((r) => r.json())
      .then((d: CalEvent[] | { error: string }) => { if (Array.isArray(d)) setEvents(d) })
      .catch(() => {})
  }
  useEffect(() => { refetch() }, [y, m, reloadToken])   // eslint-disable-line react-hooks/exhaustive-deps

  const cells = buildGrid(y, m)
  const byDate = new Set(events.map(evDay))
  const capturedOn = (k: string) => events.filter((e) => isCaptured(e) && evDay(e) === k)
  const todayKey = key(today)

  // Click derecho sobre un día → menú (coords a px LÓGICOS: la escala del subárbol se cancela con
  // rect.width/offsetWidth, sin depender de OSSettings).
  function openCtx(e: React.MouseEvent, k: string) {
    e.preventDefault()
    const root = rootRef.current
    if (!root) return
    const r = root.getBoundingClientRect()
    const f = r.width / root.offsetWidth || 1
    setSel(k)
    setCtx({ x: (e.clientX - r.left) / f, y: (e.clientY - r.top) / f, day: k })
  }

  return (
    <div ref={rootRef} style={{ width: 224, position: 'relative' }}>
      {/* Header: dropdown mes + spinner año */}
      <div style={{ display: 'flex', gap: 6, marginBottom: 6 }}>
        <XpSelect value={String(m)} width={104} onChange={(v) => setM(+v)} options={MONTHS.map((mm, i) => ({ value: String(i), label: mm }))} />
        <XpSpinner value={y} width={46} onStep={(dir) => setY((yr) => yr + dir)} />
      </div>
      {/* Rejilla blanca hundida */}
      <div className="xp-sunken" style={{ padding: 3 }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', textAlign: 'center' }}>
          {DOW.map((d, i) => (
            <div key={i} style={{ fontSize: 10, fontWeight: 700, color: '#6b6b6b', paddingBottom: 2, borderBottom: '1px solid #d4d0c8' }}>{d}</div>
          ))}
          {cells.map(({ date, cur }, i) => {
            const k = key(date)
            const isSel = k === sel
            const isToday = k === todayKey
            const hasEv = byDate.has(k)
            const bday = cur && date.getMonth() === BIRTHDAY.month && date.getDate() === BIRTHDAY.day
            return (
              <button
                key={i}
                onClick={() => setSel(k)}
                onContextMenu={(e) => openCtx(e, k)}
                title="Click derecho: nuevo/editar evento"
                style={{
                  position: 'relative', height: 21, border: 0, cursor: 'pointer', fontSize: 11,
                  fontFamily: 'inherit', lineHeight: '21px', padding: 0,
                  background: isSel ? XP_BLUE : 'transparent',
                  color: isSel ? '#fff' : cur ? (isToday ? '#c0271c' : '#000') : '#adadad',
                  fontWeight: isToday && !isSel ? 700 : 400,
                  boxShadow: isToday && !isSel ? `inset 0 0 0 1px ${XP_BLUE}` : undefined,
                }}
              >
                {date.getDate()}
                {(hasEv || bday) && (
                  <span style={{ position: 'absolute', bottom: 2, left: '50%', transform: 'translateX(-50%)', width: 3, height: 3, borderRadius: '50%', background: bday ? '#e0a51f' : isSel ? '#fff' : XP_BLUE }} />
                )}
              </button>
            )
          })}
        </div>
      </div>

      {ctx && (
        <XpContextMenu
          x={ctx.x} y={ctx.y} onClose={() => setCtx(null)}
          items={[
            { label: 'Nuevo evento…', onClick: () => onNew(ctx.day) },
            ...(capturedOn(ctx.day).length
              ? [{ label: 'Editar evento…', onClick: () => onEdit(capturedOn(ctx.day)[0], ctx.day) }]
              : []),
          ]}
        />
      )}
    </div>
  )
}

// ── Reloj análogo XP (manecillas teal tapered, marco hundido) ────────────────
function AnalogClock() {
  const [now, setNow] = useState<Date | null>(null)
  useEffect(() => {
    setNow(new Date())
    const id = setInterval(() => setNow(new Date()), 1000)
    return () => clearInterval(id)
  }, [])
  const s = now ? now.getSeconds() : 0, mi = now ? now.getMinutes() : 0, h = now ? now.getHours() % 12 : 0

  // manecilla tapered (kite): base ancha en el centro, punta en el extremo
  const hand = (angle: number, len: number, baseW: number, color: string) => {
    const a = ((angle - 90) * Math.PI) / 180, p = a + Math.PI / 2
    const tip = [50 + len * Math.cos(a), 50 + len * Math.sin(a)]
    const b1 = [50 + (baseW / 2) * Math.cos(p), 50 + (baseW / 2) * Math.sin(p)]
    const b2 = [50 - (baseW / 2) * Math.cos(p), 50 - (baseW / 2) * Math.sin(p)]
    const tail = [50 - len * 0.16 * Math.cos(a), 50 - len * 0.16 * Math.sin(a)]
    return <polygon points={[b1, tip, b2, tail].map((q) => q.map((n) => n.toFixed(1)).join(',')).join(' ')} fill={color} />
  }

  const digital = now ? now.toLocaleTimeString('es-MX', { hour: 'numeric', minute: '2-digit', second: '2-digit', hour12: true }) : ''

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10 }}>
      <div style={{ padding: 5, borderRadius: '50%', background: '#ece9d8', border: '2px solid', borderColor: '#808080 #fff #fff #808080', boxShadow: 'inset 0 1px 3px rgba(0,0,0,0.3)' }}>
        <svg viewBox="0 0 100 100" width={116} height={116} style={{ display: 'block', filter: 'drop-shadow(0.6px 0.8px 0.5px rgba(0,0,0,0.35))' }}>
          <circle cx={50} cy={50} r={48} fill="#fff" stroke="#9a968a" strokeWidth={1} />
          {Array.from({ length: 12 }).map((_, i) => {
            const a = ((i * 30 - 90) * Math.PI) / 180
            return <circle key={i} cx={50 + 42 * Math.cos(a)} cy={50 + 42 * Math.sin(a)} r={i % 3 === 0 ? 1.8 : 1} fill="#3a3730" />
          })}
          {hand(h * 30 + mi * 0.5, 26, 5, '#2f8a86')}
          {hand(mi * 6 + s * 0.1, 37, 3.6, '#2f8a86')}
          <line x1={50 + 8 * Math.cos(((s * 6 + 90) * Math.PI) / 180)} y1={50 + 8 * Math.sin(((s * 6 + 90) * Math.PI) / 180)} x2={50 + 40 * Math.cos(((s * 6 - 90) * Math.PI) / 180)} y2={50 + 40 * Math.sin(((s * 6 - 90) * Math.PI) / 180)} stroke="#c0271c" strokeWidth={1} />
          <circle cx={50} cy={50} r={2.8} fill="#2f8a86" />
        </svg>
      </div>
      {/* Digital en cajita hundida con spinner (decorativo, la hora es real) */}
      <span className="xp-spinner">
        <input readOnly value={digital} className="tabular-nums" style={{ width: 126, textAlign: 'center', fontSize: 12 }} />
        <span className="xp-spin-btns">
          <button type="button" tabIndex={-1} aria-hidden>▲</button>
          <button type="button" tabIndex={-1} aria-hidden>▼</button>
        </span>
      </span>
    </div>
  )
}

// Barra de pestañas XP (Fecha y hora activa; las otras decorativas — XP siempre las muestra)
const TABS = ['Fecha y hora', 'Zona horaria', 'Hora de Internet']
function TabBar() {
  return (
    <div style={{ display: 'flex', gap: 2, paddingLeft: 3 }}>
      {TABS.map((t) => {
        const on = t === 'Fecha y hora'
        return (
          <div key={t} style={{ position: 'relative', zIndex: on ? 1 : 0, padding: '3px 9px', fontSize: 11, borderRadius: '3px 3px 0 0', border: '1px solid #919b9c', borderBottom: 'none', marginBottom: on ? -1 : 0, background: on ? '#ece9d8' : 'linear-gradient(#f4f2ea,#e0ddce)', color: on ? '#000' : '#8a867a', cursor: on ? 'default' : 'not-allowed' }}>
            {t}
          </div>
        )
      })}
    </div>
  )
}

export default function DateTimeProperties() {
  const [dialog, setDialog] = useState<{ event: CalEvent | null; date: string } | null>(null)
  const [reload, setReload] = useState(0)   // se incrementa tras cada escritura → XpCalendar refetchea

  return (
    <div className="xp-dialog" style={{ height: '100%', display: 'flex', flexDirection: 'column', padding: '7px 8px 8px' }}>
      <TabBar />
      {/* Panel de contenido (borde raised → look tabbed de XP) */}
      <div style={{ flex: 1, borderStyle: 'solid', borderWidth: 1, borderColor: '#fff #919b9c #919b9c #fff', background: '#ece9d8', padding: 12, display: 'flex', gap: 12, alignItems: 'center', justifyContent: 'center' }}>
        <GroupBox label="Fecha">
          <XpCalendar
            onNew={(date) => setDialog({ event: null, date })}
            onEdit={(event, date) => setDialog({ event, date })}
            reloadToken={reload}
          />
        </GroupBox>
        <GroupBox label="Hora"><AnalogClock /></GroupBox>
      </div>

      {/* Diálogo de evento fuera del GroupBox → su scrim `absolute inset-0` se scopea a la ventana. */}
      {dialog && (
        <EventDialog
          event={dialog.event} date={dialog.date}
          onClose={() => setDialog(null)}
          onSaved={() => setReload((r) => r + 1)}
        />
      )}
    </div>
  )
}
