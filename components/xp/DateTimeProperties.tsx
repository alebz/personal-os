'use client'

import { useEffect, useState } from 'react'
import type { CalEvent } from '@/app/api/calendar/route'
import { GroupBox, XpSelect, XpSpinner } from './xp-controls'

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

// ── Calendario XP ────────────────────────────────────────────────────────────
function XpCalendar() {
  const today = new Date()
  const [y, setY] = useState(today.getFullYear())
  const [m, setM] = useState(today.getMonth())
  const [sel, setSel] = useState(key(today))
  const [events, setEvents] = useState<CalEvent[]>([])

  const cells = buildGrid(y, m)
  useEffect(() => {
    const from = key(cells[0].date), to = key(cells[cells.length - 1].date)
    let live = true
    fetch(`/api/calendar?from=${from}&to=${to}`)
      .then((r) => r.json())
      .then((d: CalEvent[] | { error: string }) => { if (live && Array.isArray(d)) setEvents(d) })
      .catch(() => {})
    return () => { live = false }
  }, [y, m])   // eslint-disable-line react-hooks/exhaustive-deps

  const byDate = new Set(events.map((e) => (e.allDay ? e.start.slice(0, 10) : key(new Date(e.start)))))
  const todayKey = key(today)

  return (
    <div style={{ width: 224 }}>
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
  return (
    <div className="xp-dialog" style={{ height: '100%', display: 'flex', flexDirection: 'column', padding: '7px 8px 8px' }}>
      <TabBar />
      {/* Panel de contenido (borde raised → look tabbed de XP) */}
      <div style={{ flex: 1, borderStyle: 'solid', borderWidth: 1, borderColor: '#fff #919b9c #919b9c #fff', background: '#ece9d8', padding: 12, display: 'flex', gap: 12, alignItems: 'flex-start' }}>
        <GroupBox label="Fecha"><XpCalendar /></GroupBox>
        <GroupBox label="Hora"><AnalogClock /></GroupBox>
      </div>
    </div>
  )
}
