'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'

// CALENDARIO bajo XP = OUTLOOK 2003 Calendar (alma de época). App propia (ventana + ícono), NO cara del
// tambor — el arcade conserva su calendario de Inicio. "Calendario Chingón" v1: eventos manuales (tabla
// tasks kind=event vía /api/calendar) + iCal (Apple) + CUMPLEAÑOS de contactos, con vistas Día/Semana/
// Mes/Agenda. El color CLASIFICA por FUENTE (evento=azul, iCal=verde, cumple=oro) — gramática lista para
// sumar fuentes futuras (compromisos con plazo, tareas con fecha, sábados del valet). El calendario como
// AGREGADOR de todo lo fechado del OS.

const DOW = ['lun', 'mar', 'mié', 'jue', 'vie', 'sáb', 'dom']
const MONTHS = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre']

const OL = {
  head1: '#f4f8fe', head2: '#c9ddf5', line: '#a8c0e0', blue: '#15427e', accent: '#2b5fb0',
  today: '#fff0c2', sel: '#316ac5', weekend: '#f5f8fc', rule: '#cfd9e8',
  event: '#2b6fd6', ical: '#0a9e6e', bday: '#c98a12',
}

const pad = (n: number) => String(n).padStart(2, '0')
const ymd = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
const addDays = (d: Date, n: number) => { const x = new Date(d); x.setDate(x.getDate() + n); return x }
const startOfWeek = (d: Date) => { const x = new Date(d); const dow = (x.getDay() + 6) % 7; x.setDate(x.getDate() - dow); x.setHours(0, 0, 0, 0); return x }
const sameDay = (a: Date, b: Date) => a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate()
const monthGrid = (year: number, month: number) => { const first = new Date(year, month, 1); const start = startOfWeek(first); return Array.from({ length: 42 }, (_, i) => addDays(start, i)) }

interface CalEvent { uid: string; title: string; start: string; end: string; allDay: boolean; note?: string }
interface Marker { key: string; day: string; title: string; time: string | null; ts: number; type: 'event' | 'ical' | 'bday'; note?: string; editId: string | null }
interface Contact { id: string; name: string; birthday: string | null }

function eventToMarker(e: CalEvent): Marker {
  const captured = e.uid.startsWith('captured:')
  if (e.allDay) {
    const day = e.start.slice(0, 10)
    return { key: e.uid, day, title: e.title, time: null, ts: new Date(day + 'T00:00:00').getTime() - 1, type: captured ? 'event' : 'ical', note: e.note, editId: captured ? e.uid.slice(9) : null }
  }
  const d = new Date(e.start)
  return { key: e.uid, day: ymd(d), title: e.title, time: `${pad(d.getHours())}:${pad(d.getMinutes())}`, ts: d.getTime(), type: captured ? 'event' : 'ical', note: e.note, editId: captured ? e.uid.slice(9) : null }
}

function birthdayMarkers(contacts: Contact[], from: Date, to: Date): Marker[] {
  const out: Marker[] = []
  for (const c of contacts) {
    if (!c.birthday) continue
    const mm = c.birthday.slice(5, 10)   // MM-DD
    for (let y = from.getFullYear(); y <= to.getFullYear(); y++) {
      const day = `${y}-${mm}`
      const t = new Date(day + 'T00:00:00')
      if (isNaN(t.getTime())) continue
      if (t >= from && t <= to) out.push({ key: `bday:${c.id}:${y}`, day, title: `${c.name}`, time: null, ts: t.getTime() - 2, type: 'bday', editId: null })
    }
  }
  return out
}

const VIEWS = [{ id: 'dia', label: 'Día' }, { id: 'semana', label: 'Semana' }, { id: 'mes', label: 'Mes' }, { id: 'agenda', label: 'Agenda' }] as const
type View = typeof VIEWS[number]['id']

export default function CalendarioApp() {
  const [view, setView] = useState<View>('mes')
  const [cursor, setCursor] = useState(() => { const d = new Date(); d.setHours(0, 0, 0, 0); return d })
  const [events, setEvents] = useState<CalEvent[]>([])
  const [contacts, setContacts] = useState<Contact[]>([])
  const [dialog, setDialog] = useState<{ date: string; marker?: Marker } | null>(null)

  // rango a traer según la vista
  const range = useMemo(() => {
    if (view === 'mes') { const g = monthGrid(cursor.getFullYear(), cursor.getMonth()); return { from: g[0], to: g[41] } }
    if (view === 'semana') { const s = startOfWeek(cursor); return { from: s, to: addDays(s, 6) } }
    if (view === 'dia') return { from: cursor, to: cursor }
    return { from: cursor, to: addDays(cursor, 45) }   // agenda
  }, [view, cursor])

  const load = useCallback(() => {
    fetch(`/api/calendar?from=${ymd(range.from)}&to=${ymd(range.to)}`).then((r) => r.json()).then((d) => { if (Array.isArray(d)) setEvents(d) }).catch(() => {})
  }, [range.from, range.to])
  useEffect(() => { load() }, [load])
  useEffect(() => { fetch('/api/contacts').then((r) => r.json()).then((d) => { if (Array.isArray(d)) setContacts(d) }).catch(() => {}) }, [])

  const markers = useMemo(() => {
    const evs = events.map(eventToMarker)
    const bds = birthdayMarkers(contacts, addDays(range.from, -1), addDays(range.to, 1))
    return [...evs, ...bds]
  }, [events, contacts, range.from, range.to])

  const byDay = useMemo(() => { const m: Record<string, Marker[]> = {}; for (const mk of markers) (m[mk.day] ??= []).push(mk); for (const k in m) m[k].sort((a, b) => a.ts - b.ts); return m }, [markers])

  const nav = (dir: number) => setCursor((c) => { if (view === 'mes') return new Date(c.getFullYear(), c.getMonth() + dir, 1); if (view === 'semana') return addDays(c, dir * 7); if (view === 'agenda') return addDays(c, dir * 14); return addDays(c, dir) })
  const today = () => { const d = new Date(); d.setHours(0, 0, 0, 0); setCursor(d) }
  const openNew = (day: string) => setDialog({ date: day })
  const openMarker = (mk: Marker) => { if (mk.editId) setDialog({ date: mk.day, marker: mk }); else setDialog({ date: mk.day }) }

  const title = view === 'mes' ? `${MONTHS[cursor.getMonth()]} ${cursor.getFullYear()}`
    : view === 'semana' ? (() => { const s = startOfWeek(cursor); const e = addDays(s, 6); return `${s.getDate()} ${MONTHS[s.getMonth()].slice(0, 3)} – ${e.getDate()} ${MONTHS[e.getMonth()].slice(0, 3)} ${e.getFullYear()}` })()
      : view === 'dia' ? `${DOW[(cursor.getDay() + 6) % 7]} ${cursor.getDate()} de ${MONTHS[cursor.getMonth()]} ${cursor.getFullYear()}`
        : 'Próximos eventos'

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column', background: '#fff', fontFamily: 'inherit', fontSize: 11, color: '#1a2a44' }}>
      {/* Barra de menú (decorativa) */}
      <div style={{ display: 'flex', gap: 13, padding: '2px 9px', background: '#f7f9fc', borderBottom: '1px solid #cdd6e2', fontSize: 11, color: '#333' }}>{['Archivo', 'Editar', 'Ver', 'Ir', 'Herramientas', 'Ayuda'].map((m) => <span key={m}>{m}</span>)}</div>
      {/* Toolbar Outlook */}
      <div style={{ flexShrink: 0, display: 'flex', alignItems: 'center', gap: 6, padding: '4px 8px', background: `linear-gradient(180deg,${OL.head1},${OL.head2})`, borderBottom: `1px solid ${OL.line}` }}>
        <OlBtn onClick={() => openNew(ymd(cursor))} primary>📅 Nuevo evento</OlBtn>
        <OlBtn onClick={today}>Hoy</OlBtn>
        <button onClick={() => nav(-1)} style={navBtn}>‹</button>
        <button onClick={() => nav(1)} style={navBtn}>›</button>
        <span style={{ fontWeight: 700, color: OL.blue, marginLeft: 4, textTransform: 'capitalize', flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{title}</span>
        <span style={{ display: 'inline-flex', border: `1px solid ${OL.line}`, borderRadius: 3, overflow: 'hidden' }}>
          {VIEWS.map((v) => <button key={v.id} onClick={() => setView(v.id)} style={{ border: 0, cursor: 'pointer', padding: '2px 9px', fontSize: 11, fontFamily: 'inherit', background: view === v.id ? `linear-gradient(${OL.accent},#1c4790)` : '#eef4fc', color: view === v.id ? '#fff' : OL.blue, fontWeight: view === v.id ? 700 : 400 }}>{v.label}</button>)}
        </span>
      </div>

      {/* Cuerpo: Date Navigator + vista */}
      <div style={{ flex: 1, minHeight: 0, display: 'flex' }}>
        <div style={{ flexShrink: 0, width: 168, borderRight: `1px solid ${OL.rule}`, background: '#f3f7fd', padding: 8 }}>
          <MiniMonth cursor={cursor} onPick={(d) => { setCursor(d); if (view === 'mes' || view === 'agenda') setView('dia') }} byDay={byDay} />
          <div style={{ marginTop: 10, fontSize: 10, color: '#5a6a86', lineHeight: 1.7 }}>
            <div style={{ fontWeight: 700, color: OL.blue, marginBottom: 2 }}>Leyenda</div>
            <Legend color={OL.event} label="Evento" /><Legend color={OL.ical} label="Apple Calendar" /><Legend color={OL.bday} label="🎂 Cumpleaños" />
          </div>
        </div>
        <div style={{ flex: 1, minWidth: 0, overflow: 'auto', background: '#fff' }}>
          {view === 'mes' && <MesView cursor={cursor} byDay={byDay} onNew={openNew} onMarker={openMarker} />}
          {view === 'semana' && <SemanaView cursor={cursor} byDay={byDay} onNew={openNew} onMarker={openMarker} />}
          {view === 'dia' && <DiaView cursor={cursor} markers={byDay[ymd(cursor)] ?? []} onNew={openNew} onMarker={openMarker} />}
          {view === 'agenda' && <AgendaView from={cursor} byDay={byDay} onMarker={openMarker} />}
        </div>
      </div>

      {dialog && <EventDialog date={dialog.date} marker={dialog.marker} onClose={() => setDialog(null)} onSaved={() => { setDialog(null); load() }} />}
    </div>
  )
}

// ── primitivas ──
function OlBtn({ children, onClick, primary }: { children: React.ReactNode; onClick: () => void; primary?: boolean }) {
  return <button onClick={onClick} style={{ border: `1px solid ${OL.line}`, borderRadius: 3, padding: '2px 10px', fontSize: 11, fontFamily: 'inherit', cursor: 'pointer', color: primary ? '#fff' : OL.blue, background: primary ? `linear-gradient(${OL.accent},#1c4790)` : 'linear-gradient(#fff,#e9f0fa)' }}>{children}</button>
}
const navBtn: React.CSSProperties = { border: `1px solid ${OL.line}`, background: 'linear-gradient(#fff,#e9f0fa)', borderRadius: 3, width: 20, height: 20, cursor: 'pointer', color: OL.blue, fontWeight: 700, lineHeight: 1, padding: 0 }
function Legend({ color, label }: { color: string; label: string }) { return <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}><span style={{ width: 9, height: 9, borderRadius: 2, background: color, flexShrink: 0 }} />{label}</div> }
const mkColor = (t: Marker['type']) => (t === 'bday' ? OL.bday : t === 'ical' ? OL.ical : OL.event)

function Chip({ mk, onClick }: { mk: Marker; onClick: () => void }) {
  return (
    <div onClick={(e) => { e.stopPropagation(); onClick() }} title={mk.title} style={{ display: 'flex', alignItems: 'center', gap: 3, fontSize: 10, padding: '0 3px 0 0', borderRadius: 2, marginBottom: 1, cursor: 'pointer', background: `${mkColor(mk.type)}18`, borderLeft: `3px solid ${mkColor(mk.type)}`, overflow: 'hidden' }}>
      <span style={{ paddingLeft: 3, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{mk.type === 'bday' ? '🎂 ' : mk.time ? `${mk.time} ` : ''}{mk.title}</span>
    </div>
  )
}

function MiniMonth({ cursor, onPick, byDay }: { cursor: Date; onPick: (d: Date) => void; byDay: Record<string, Marker[]> }) {
  const [my, setMy] = useState({ y: cursor.getFullYear(), m: cursor.getMonth() })
  useEffect(() => { setMy({ y: cursor.getFullYear(), m: cursor.getMonth() }) }, [cursor])
  const grid = monthGrid(my.y, my.m); const now = new Date()
  return (
    <div style={{ border: `1px solid ${OL.line}`, borderRadius: 3, background: '#fff', overflow: 'hidden' }}>
      <div style={{ display: 'flex', alignItems: 'center', background: `linear-gradient(${OL.accent},#1c4790)`, color: '#fff', fontSize: 10.5, fontWeight: 700, padding: '2px 4px' }}>
        <button onClick={() => setMy((s) => ({ ...s, m: s.m - 1 < 0 ? 11 : s.m - 1, y: s.m - 1 < 0 ? s.y - 1 : s.y }))} style={miniNav}>‹</button>
        <span style={{ flex: 1, textAlign: 'center', textTransform: 'capitalize' }}>{MONTHS[my.m].slice(0, 3)} {my.y}</span>
        <button onClick={() => setMy((s) => ({ ...s, m: s.m + 1 > 11 ? 0 : s.m + 1, y: s.m + 1 > 11 ? s.y + 1 : s.y }))} style={miniNav}>›</button>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7,1fr)', fontSize: 9, color: '#8a93a8', padding: '1px 0' }}>{DOW.map((d) => <span key={d} style={{ textAlign: 'center' }}>{d[0]}</span>)}</div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7,1fr)' }}>
        {grid.map((d, i) => {
          const inM = d.getMonth() === my.m; const isToday = sameDay(d, now); const isSel = sameDay(d, cursor); const has = (byDay[ymd(d)]?.length ?? 0) > 0
          return <button key={i} onClick={() => onPick(new Date(d))} style={{ border: 0, cursor: 'pointer', fontSize: 9.5, padding: '1px 0', fontFamily: 'inherit', height: 17, position: 'relative', background: isSel ? OL.sel : isToday ? OL.today : 'transparent', color: isSel ? '#fff' : inM ? '#1a2a44' : '#b7becb', fontWeight: isToday || isSel ? 700 : 400 }}>{d.getDate()}{has && <span style={{ position: 'absolute', bottom: 1, left: '50%', transform: 'translateX(-50%)', width: 3, height: 3, borderRadius: '50%', background: isSel ? '#fff' : OL.event }} />}</button>
        })}
      </div>
    </div>
  )
}
const miniNav: React.CSSProperties = { border: 0, background: 'rgba(255,255,255,0.2)', color: '#fff', cursor: 'pointer', width: 15, height: 15, borderRadius: 2, lineHeight: 1, padding: 0, fontSize: 10 }

// ── Vistas ──
function MesView({ cursor, byDay, onNew, onMarker }: { cursor: Date; byDay: Record<string, Marker[]>; onNew: (d: string) => void; onMarker: (m: Marker) => void }) {
  const grid = monthGrid(cursor.getFullYear(), cursor.getMonth()); const now = new Date()
  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column', minHeight: 320 }}>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7,1fr)', background: `linear-gradient(${OL.head1},${OL.head2})`, borderBottom: `1px solid ${OL.line}` }}>{DOW.map((d) => <span key={d} style={{ textAlign: 'center', fontSize: 10.5, fontWeight: 700, color: OL.blue, padding: '3px 0', textTransform: 'capitalize' }}>{d}</span>)}</div>
      <div style={{ flex: 1, display: 'grid', gridTemplateColumns: 'repeat(7,1fr)', gridTemplateRows: 'repeat(6,1fr)' }}>
        {grid.map((d, i) => {
          const inM = d.getMonth() === cursor.getMonth(); const key = ymd(d); const items = byDay[key] ?? []; const isToday = sameDay(d, now); const wknd = d.getDay() === 0 || d.getDay() === 6
          return (
            <div key={i} onDoubleClick={() => onNew(key)} style={{ borderRight: `1px solid ${OL.rule}`, borderBottom: `1px solid ${OL.rule}`, background: isToday ? OL.today : wknd ? OL.weekend : '#fff', padding: '1px 2px', overflow: 'hidden', minHeight: 0, cursor: 'default' }}>
              <div style={{ textAlign: 'right', fontSize: 10, fontWeight: isToday ? 700 : 400, color: inM ? '#1a2a44' : '#b7becb', paddingRight: 2 }}>{d.getDate()}</div>
              {items.slice(0, 4).map((m) => <Chip key={m.key} mk={m} onClick={() => onMarker(m)} />)}
              {items.length > 4 && <div style={{ fontSize: 9, color: OL.accent, paddingLeft: 3 }}>+{items.length - 4} más</div>}
            </div>
          )
        })}
      </div>
    </div>
  )
}

function SemanaView({ cursor, byDay, onNew, onMarker }: { cursor: Date; byDay: Record<string, Marker[]>; onNew: (d: string) => void; onMarker: (m: Marker) => void }) {
  const s = startOfWeek(cursor); const days = Array.from({ length: 7 }, (_, i) => addDays(s, i)); const now = new Date()
  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7,1fr)', height: '100%', minHeight: 320 }}>
      {days.map((d, i) => {
        const key = ymd(d); const items = byDay[key] ?? []; const isToday = sameDay(d, now)
        return (
          <div key={i} onDoubleClick={() => onNew(key)} style={{ borderRight: i < 6 ? `1px solid ${OL.rule}` : 'none', display: 'flex', flexDirection: 'column', minWidth: 0 }}>
            <div style={{ textAlign: 'center', fontSize: 10.5, fontWeight: 700, padding: '3px 0', color: isToday ? '#fff' : OL.blue, background: isToday ? OL.accent : `linear-gradient(${OL.head1},${OL.head2})`, borderBottom: `1px solid ${OL.line}`, textTransform: 'capitalize' }}>{DOW[i]} {d.getDate()}</div>
            <div style={{ flex: 1, padding: 3, overflow: 'auto', background: isToday ? OL.today : '#fff' }}>{items.map((m) => <Chip key={m.key} mk={m} onClick={() => onMarker(m)} />)}</div>
          </div>
        )
      })}
    </div>
  )
}

function DiaView({ cursor, markers, onNew, onMarker }: { cursor: Date; markers: Marker[]; onNew: (d: string) => void; onMarker: (m: Marker) => void }) {
  const key = ymd(cursor)
  return (
    <div style={{ padding: 12 }} onDoubleClick={() => onNew(key)}>
      {markers.length === 0 && <div style={{ color: '#8a93a8', fontStyle: 'italic', padding: '8px 2px' }}>Sin eventos este día. Doble clic para crear uno.</div>}
      {markers.map((m) => (
        <div key={m.key} onClick={() => onMarker(m)} style={{ display: 'flex', gap: 9, alignItems: 'flex-start', padding: '6px 8px', marginBottom: 4, borderRadius: 3, cursor: 'pointer', background: `${mkColor(m.type)}12`, borderLeft: `4px solid ${mkColor(m.type)}` }}>
          <span style={{ width: 44, flexShrink: 0, fontWeight: 700, color: mkColor(m.type), fontSize: 11 }}>{m.type === 'bday' ? '🎂' : m.time ?? 'Todo'}</span>
          <div style={{ minWidth: 0 }}><div style={{ fontWeight: 600 }}>{m.title}</div>{m.note && <div style={{ fontSize: 10, color: '#5a6a86', marginTop: 1 }}>{m.note}</div>}</div>
        </div>
      ))}
    </div>
  )
}

function AgendaView({ from, byDay, onMarker }: { from: Date; byDay: Record<string, Marker[]>; onMarker: (m: Marker) => void }) {
  const days = Array.from({ length: 46 }, (_, i) => addDays(from, i)).map((d) => ({ d, items: byDay[ymd(d)] ?? [] })).filter((x) => x.items.length > 0)
  const now = new Date()
  return (
    <div style={{ padding: '4px 0' }}>
      {days.length === 0 && <div style={{ color: '#8a93a8', fontStyle: 'italic', padding: 12 }}>Sin eventos próximos.</div>}
      {days.map(({ d, items }) => (
        <div key={ymd(d)}>
          <div style={{ background: `linear-gradient(${OL.head1},${OL.head2})`, borderTop: `1px solid ${OL.line}`, borderBottom: `1px solid ${OL.line}`, padding: '2px 10px', fontWeight: 700, fontSize: 10.5, color: sameDay(d, now) ? OL.accent : OL.blue, textTransform: 'capitalize' }}>{DOW[(d.getDay() + 6) % 7]} {d.getDate()} {MONTHS[d.getMonth()].slice(0, 3)}{sameDay(d, now) && ' · hoy'}</div>
          {items.map((m) => (
            <div key={m.key} onClick={() => onMarker(m)} style={{ display: 'flex', gap: 9, padding: '4px 10px', borderBottom: '1px solid #eef2f8', cursor: 'pointer', alignItems: 'center' }}>
              <span style={{ width: 40, flexShrink: 0, fontSize: 10.5, color: mkColor(m.type), fontWeight: 700 }}>{m.type === 'bday' ? '🎂' : m.time ?? '—'}</span>
              <span style={{ width: 3, height: 14, background: mkColor(m.type), borderRadius: 2, flexShrink: 0 }} />
              <span style={{ flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{m.title}</span>
            </div>
          ))}
        </div>
      ))}
    </div>
  )
}

// ── Diálogo de evento (crear/editar/borrar) ──
function EventDialog({ date, marker, onClose, onSaved }: { date: string; marker?: Marker; onClose: () => void; onSaved: () => void }) {
  const editing = !!marker?.editId
  const [title, setTitle] = useState(marker?.title ?? '')
  const [d, setD] = useState(marker?.day ?? date)
  const [time, setTime] = useState(marker?.time ?? '')
  const [note, setNote] = useState(marker?.note ?? '')
  const [busy, setBusy] = useState(false)

  async function save() {
    if (!title.trim() || busy) return
    setBusy(true)
    const body = { title: title.trim(), event_date: d, event_time: time || undefined, note: note || undefined }
    try {
      const r = await fetch(editing ? `/api/calendar/${marker!.editId}` : '/api/calendar', { method: editing ? 'PATCH' : 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) })
      if (r.ok) onSaved(); else setBusy(false)
    } catch { setBusy(false) }
  }
  async function remove() { if (!editing) return; setBusy(true); try { await fetch(`/api/calendar/${marker!.editId}`, { method: 'DELETE' }); onSaved() } catch { setBusy(false) } }

  return (
    <div onMouseDown={onClose} style={{ position: 'absolute', inset: 0, zIndex: 50, background: 'rgba(20,40,80,0.28)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div onMouseDown={(e) => e.stopPropagation()} style={{ width: 320, maxWidth: '92%', background: '#ece9d8', border: '1px solid #0831d8', borderRadius: 4, boxShadow: '0 6px 22px rgba(0,0,0,0.35)', overflow: 'hidden', fontSize: 11 }}>
        <div className="xp-titlebar" style={{ height: 24, color: '#fff', fontWeight: 700, padding: '0 4px 0 9px', display: 'flex', alignItems: 'center' }}><span style={{ flex: 1 }}>{editing ? 'Editar evento' : 'Nuevo evento'}</span><button onClick={onClose} style={{ border: 0, background: 'rgba(255,255,255,0.18)', color: '#fff', width: 16, height: 16, borderRadius: 2, cursor: 'pointer', lineHeight: 1 }}>×</button></div>
        <div style={{ padding: 11, display: 'flex', flexDirection: 'column', gap: 8 }}>
          <label style={lbl}>Título<input autoFocus value={title} onChange={(e) => setTitle(e.target.value)} className="xp-sunken" style={inp} /></label>
          <div style={{ display: 'flex', gap: 8 }}>
            <label style={{ ...lbl, flex: 1 }}>Fecha<input type="date" value={d} onChange={(e) => setD(e.target.value)} className="xp-sunken" style={inp} /></label>
            <label style={{ ...lbl, width: 96 }}>Hora<input type="time" value={time} onChange={(e) => setTime(e.target.value)} className="xp-sunken" style={inp} /></label>
          </div>
          <label style={lbl}>Nota<textarea value={note} onChange={(e) => setNote(e.target.value)} rows={2} className="xp-sunken" style={{ ...inp, resize: 'none' }} /></label>
        </div>
        <div style={{ padding: '7px 11px', borderTop: '1px solid #c9c6ba', background: '#f3f1e6', display: 'flex', gap: 7, alignItems: 'center' }}>
          {editing && <button onClick={remove} disabled={busy} className="xp-raised" style={{ ...btn, color: '#a02015' }}>Eliminar</button>}
          <span style={{ flex: 1 }} />
          <button onClick={onClose} className="xp-raised" style={btn}>Cancelar</button>
          <button onClick={save} disabled={busy || !title.trim()} className="xp-raised" style={btn}>{busy ? '…' : 'Guardar'}</button>
        </div>
      </div>
    </div>
  )
}
const lbl: React.CSSProperties = { display: 'flex', flexDirection: 'column', gap: 3, fontSize: 10.5, color: '#3a4a64' }
const inp: React.CSSProperties = { padding: '3px 5px', fontFamily: 'inherit', fontSize: 11, outline: 'none' }
const btn: React.CSSProperties = { padding: '3px 14px', fontSize: 11, fontFamily: 'inherit', cursor: 'pointer' }
