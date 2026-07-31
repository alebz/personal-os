'use client'

import { useEffect, useState } from 'react'

// GLOBOS DE NOTIFICACIÓN del tray (XP) — vuelven PROACTIVO al OS. Al abrir XP (una vez al día), reúne
// señales REALES del OS y las muestra como globos en la esquina, uno a la vez, apuntando al tray:
//  · 🎂 cumpleaños de hoy (contactos)   · 📅 eventos de hoy/mañana (calendario)   · 🗒 tareas de hoy.
// Clic en el globo → abre la app correspondiente. Auto-avanza cada ~8.5s; × cierra.

const todayStr = () => { const d = new Date(); return [d.getFullYear(), String(d.getMonth() + 1).padStart(2, '0'), String(d.getDate()).padStart(2, '0')].join('-') }
const addDaysStr = (iso: string, n: number) => { const [y, m, d] = iso.split('-').map(Number); const x = new Date(y, m - 1, d + n); return [x.getFullYear(), String(x.getMonth() + 1).padStart(2, '0'), String(x.getDate()).padStart(2, '0')].join('-') }
const ymd = (dt: Date) => [dt.getFullYear(), String(dt.getMonth() + 1).padStart(2, '0'), String(dt.getDate()).padStart(2, '0')].join('-')

interface Notif { id: string; icon: string; title: string; body: string; action?: () => void }
interface CalEvent { uid: string; title: string; start: string; allDay: boolean }
interface Contact { id: string; name: string; birthday: string | null }
interface Task { id: string; completed_at: string | null; urgency: string | null; due_date: string | null; kind?: string | null }

export default function XpNotifications({ onOpenCerebro, onOpenCalendario, onOpenTareas }: {
  onOpenCerebro: () => void; onOpenCalendario: () => void; onOpenTareas: () => void
}) {
  const [queue, setQueue] = useState<Notif[]>([])

  useEffect(() => {
    const today = todayStr()
    try { if (localStorage.getItem('xp-notif-shown') === today) return } catch { /* ignore */ }
    let live = true
    ;(async () => {
      const [contacts, events, tasks] = await Promise.all([
        fetch('/api/contacts').then((r) => r.json()).catch(() => []),
        fetch(`/api/calendar?from=${today}&to=${addDaysStr(today, 1)}`).then((r) => r.json()).catch(() => []),
        fetch('/api/tasks').then((r) => r.json()).catch(() => []),
      ])
      if (!live) return
      const out: Notif[] = []
      const mmdd = today.slice(5)
      // 🎂 cumpleaños de hoy
      for (const c of (Array.isArray(contacts) ? contacts : []) as Contact[]) {
        if (c.birthday && c.birthday.slice(5, 10) === mmdd) out.push({ id: `b:${c.id}`, icon: '🎂', title: 'Cumpleaños hoy', body: `${c.name} cumple años hoy. ¿Le escribes?`, action: onOpenCerebro })
      }
      // 📅 eventos de hoy / mañana
      for (const e of (Array.isArray(events) ? events : []) as CalEvent[]) {
        const day = e.allDay ? e.start.slice(0, 10) : ymd(new Date(e.start))
        const time = e.allDay ? '' : new Date(e.start).toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit', hour12: false })
        if (day === today) out.push({ id: `e:${e.uid}`, icon: '📅', title: 'Evento hoy', body: time ? `${time} · ${e.title}` : e.title, action: onOpenCalendario })
        else if (day === addDaysStr(today, 1)) out.push({ id: `e:${e.uid}`, icon: '📅', title: 'Mañana', body: e.title, action: onOpenCalendario })
      }
      // 🗒 tareas de hoy
      const due = (Array.isArray(tasks) ? tasks : []).filter((t: Task) => t.kind !== 'event' && !t.completed_at && (t.urgency === 'today' || t.due_date === today))
      if (due.length) out.push({ id: 't:today', icon: '🗒', title: 'Tareas de hoy', body: `Tienes ${due.length} tarea${due.length > 1 ? 's' : ''} para hoy.`, action: onOpenTareas })

      if (out.length === 0) return
      try { localStorage.setItem('xp-notif-shown', today) } catch { /* ignore */ }
      setQueue(out.slice(0, 4))
    })()
    return () => { live = false }
  }, [onOpenCerebro, onOpenCalendario, onOpenTareas])

  // Avanza la cola: cada globo vive ~8.5s y luego pasa al siguiente.
  useEffect(() => {
    if (queue.length === 0) return
    const t = setTimeout(() => setQueue((q) => q.slice(1)), 8500)
    return () => clearTimeout(t)
  }, [queue])

  const cur = queue[0]
  if (!cur) return null
  const dismiss = () => setQueue((q) => q.slice(1))

  return (
    <div key={cur.id} style={{ position: 'absolute', right: 12, bottom: 40, zIndex: 12000, width: 256, animation: 'xpballoon .26s ease-out' }}>
      <style>{'@keyframes xpballoon{from{opacity:0;transform:translateY(10px)}to{opacity:1;transform:none}}'}</style>
      <div
        onClick={() => { cur.action?.(); dismiss() }}
        style={{ position: 'relative', background: 'linear-gradient(180deg,#fbfdff,#eef4fc)', border: '1px solid #6b8fc0', borderRadius: 5, boxShadow: '0 5px 18px rgba(0,0,0,0.35)', padding: '8px 10px 9px', cursor: cur.action ? 'pointer' : 'default' }}
      >
        <button onClick={(e) => { e.stopPropagation(); dismiss() }} aria-label="Cerrar" style={{ position: 'absolute', top: 4, right: 4, width: 15, height: 15, border: '1px solid #9db2cf', borderRadius: 2, background: 'linear-gradient(#fff,#dbe6f5)', cursor: 'pointer', fontSize: 10, lineHeight: 1, color: '#4a5b76', padding: 0 }}>×</button>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 3, paddingRight: 16 }}>
          <span style={{ fontSize: 15 }}>{cur.icon}</span>
          <span style={{ fontWeight: 700, fontSize: 11.5, color: '#12386e' }}>{cur.title}</span>
        </div>
        <div style={{ fontSize: 11, color: '#33415c', lineHeight: 1.35, paddingLeft: 21 }}>{cur.body}</div>
        {/* puntero hacia el tray (abajo-derecha) */}
        <span style={{ position: 'absolute', bottom: -7, right: 30, width: 12, height: 12, background: 'linear-gradient(135deg,#eef4fc,#eef4fc)', borderRight: '1px solid #6b8fc0', borderBottom: '1px solid #6b8fc0', transform: 'rotate(45deg)' }} />
      </div>
    </div>
  )
}
