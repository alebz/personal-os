'use client'

import { useEffect, useState } from 'react'
import { pushNotification, subscribeToasts, markAllRead, type Notif, type NotifTarget } from '@/lib/notifications'

// TOASTS APILADOS estilo MSN — leen del store global (lib/notifications). Los nuevos entran abajo-derecha
// y empujan a los viejos hacia arriba (la esquina está anclada al tray). Además, al abrir XP (1×/día),
// arma el RESUMEN del día (cumpleaños/eventos/tareas) y lo empuja escalonado para que se apile.

const todayStr = () => { const d = new Date(); return [d.getFullYear(), String(d.getMonth() + 1).padStart(2, '0'), String(d.getDate()).padStart(2, '0')].join('-') }
const addDaysStr = (iso: string, n: number) => { const [y, m, d] = iso.split('-').map(Number); const x = new Date(y, m - 1, d + n); return [x.getFullYear(), String(x.getMonth() + 1).padStart(2, '0'), String(x.getDate()).padStart(2, '0')].join('-') }
const ymd = (dt: Date) => [dt.getFullYear(), String(dt.getMonth() + 1).padStart(2, '0'), String(dt.getDate()).padStart(2, '0')].join('-')

interface CalEvent { uid: string; title: string; start: string; allDay: boolean }
interface Contact { id: string; name: string; birthday: string | null }
interface Task { id: string; completed_at: string | null; urgency: string | null; due_date: string | null; kind?: string | null }

export default function XpNotifications({ onOpen }: { onOpen: (t: NotifTarget) => void }) {
  const [toasts, setToasts] = useState<Notif[]>([])

  // Toasts nuevos: se apilan (máx 4 visibles) y cada uno se cierra solo tras ~9s (sigue en el historial).
  useEffect(() => subscribeToasts((n) => {
    setToasts((t) => [...t, n].slice(-4))
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== n.id)), 9000)
  }), [])

  // Resumen del día → empuja al store (1×/día).
  useEffect(() => {
    const today = todayStr()
    try { if (localStorage.getItem('xp-notif-digest') === today) return } catch { /* ignore */ }
    let live = true
    ;(async () => {
      const [contacts, events, tasks] = await Promise.all([
        fetch('/api/contacts').then((r) => r.json()).catch(() => []),
        fetch(`/api/calendar?from=${today}&to=${addDaysStr(today, 1)}`).then((r) => r.json()).catch(() => []),
        fetch('/api/tasks').then((r) => r.json()).catch(() => []),
      ])
      if (!live) return
      const out: { icon: string; title: string; body: string; target: NotifTarget }[] = []
      const mmdd = today.slice(5)
      for (const c of (Array.isArray(contacts) ? contacts : []) as Contact[]) {
        if (c.birthday && c.birthday.slice(5, 10) === mmdd) out.push({ icon: '🎂', title: 'Cumpleaños hoy', body: `${c.name} cumple años hoy. ¿Le escribes?`, target: 'cerebro' })
      }
      for (const e of (Array.isArray(events) ? events : []) as CalEvent[]) {
        const day = e.allDay ? e.start.slice(0, 10) : ymd(new Date(e.start))
        const time = e.allDay ? '' : new Date(e.start).toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit', hour12: false })
        if (day === today) out.push({ icon: '📅', title: 'Evento hoy', body: time ? `${time} · ${e.title}` : e.title, target: 'calendario' })
        else if (day === addDaysStr(today, 1)) out.push({ icon: '📅', title: 'Mañana', body: e.title, target: 'calendario' })
      }
      const due = (Array.isArray(tasks) ? tasks : []).filter((t: Task) => t.kind !== 'event' && !t.completed_at && (t.urgency === 'today' || t.due_date === today))
      if (due.length) out.push({ icon: '🗒', title: 'Tareas de hoy', body: `Tienes ${due.length} tarea${due.length > 1 ? 's' : ''} para hoy.`, target: 'tareas' })

      if (out.length === 0) return
      try { localStorage.setItem('xp-notif-digest', today) } catch { /* ignore */ }
      out.forEach((p, i) => setTimeout(() => { if (live) pushNotification(p) }, i * 750))   // escalonado → se apilan
    })()
    return () => { live = false }
  }, [])

  if (toasts.length === 0) return null
  return (
    <div style={{ position: 'absolute', right: 12, bottom: 40, zIndex: 12000, display: 'flex', flexDirection: 'column', gap: 7, alignItems: 'flex-end' }}>
      {toasts.map((n) => (
        <Toast key={n.id} n={n}
          onClick={() => { markAllRead(); onOpen(n.target); setToasts((t) => t.filter((x) => x.id !== n.id)) }}
          onClose={() => setToasts((t) => t.filter((x) => x.id !== n.id))} />
      ))}
    </div>
  )
}

function Toast({ n, onClick, onClose }: { n: Notif; onClick: () => void; onClose: () => void }) {
  const isImg = n.icon.startsWith('/')
  return (
    <div style={{ width: 256, animation: 'xpToastIn .26s ease-out' }}>
      <style>{'@keyframes xpToastIn{from{opacity:0;transform:translateY(12px)}to{opacity:1;transform:none}}'}</style>
      <div onClick={onClick} style={{ position: 'relative', background: 'linear-gradient(180deg,#fbfdff,#e9f1fc)', border: '1px solid #6b8fc0', borderRadius: 5, boxShadow: '0 5px 16px rgba(0,0,0,0.32)', padding: '8px 10px 9px', cursor: 'pointer' }}>
        <button onClick={(e) => { e.stopPropagation(); onClose() }} aria-label="Cerrar" style={{ position: 'absolute', top: 4, right: 4, width: 15, height: 15, border: '1px solid #9db2cf', borderRadius: 2, background: 'linear-gradient(#fff,#dbe6f5)', cursor: 'pointer', fontSize: 10, lineHeight: 1, color: '#4a5b76', padding: 0 }}>×</button>
        <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginBottom: 3, paddingRight: 16 }}>
          {isImg
            ? <img src={n.icon} alt="" width={18} height={18} style={{ borderRadius: 3, objectFit: 'cover', flexShrink: 0 }} />
            : <span style={{ fontSize: 15 }}>{n.icon}</span>}
          <span style={{ fontWeight: 700, fontSize: 11.5, color: '#12386e', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{n.title}</span>
        </div>
        <div style={{ fontSize: 11, color: '#33415c', lineHeight: 1.35, paddingLeft: 25, display: '-webkit-box', WebkitLineClamp: 3, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>{n.body}</div>
      </div>
    </div>
  )
}
