'use client'

import { useSyncExternalStore } from 'react'

// STORE GLOBAL DE NOTIFICACIONES (XP/MSN). Cualquier parte del OS empuja notificaciones con
// pushNotification(); el tray muestra el contador + centro (historial persistido) y <XpNotifications>
// pinta los TOASTS apilados. El "target" es un descriptor SERIALIZABLE (no una función) para sobrevivir
// recargas — XPDesktop lo mapea a abrir la app correcta.

export type NotifTarget = 'lolo' | 'cerebro' | 'calendario' | 'tareas' | null
export interface Notif { id: string; icon: string; title: string; body: string; ts: number; target: NotifTarget; read: boolean }

const KEY = 'xp-notifications'
const MAX = 40
const EMPTY: Notif[] = []

const canLS = typeof window !== 'undefined'
function loadInit(): Notif[] { if (!canLS) return []; try { const r = localStorage.getItem(KEY); return r ? JSON.parse(r) : [] } catch { return [] } }

let items: Notif[] = loadInit()
const storeSubs = new Set<() => void>()
const toastSubs = new Set<(n: Notif) => void>()

function persist() { if (!canLS) return; try { localStorage.setItem(KEY, JSON.stringify(items.slice(0, MAX))) } catch { /* ignore */ } }
function emit() { persist(); storeSubs.forEach((l) => l()) }

export function pushNotification(n: { id?: string; icon: string; title: string; body: string; target?: NotifTarget }): void {
  const id = n.id ?? `n${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`
  const notif: Notif = { id, icon: n.icon, title: n.title, body: n.body, target: n.target ?? null, ts: Date.now(), read: false }
  items = [notif, ...items.filter((x) => x.id !== id)].slice(0, MAX)   // dedupe por id, más reciente primero
  emit()
  toastSubs.forEach((l) => l(notif))
}

export function markAllRead() { if (items.some((n) => !n.read)) { items = items.map((n) => ({ ...n, read: true })); emit() } }
export function clearAll() { items = []; emit() }
export function unreadCount() { return items.reduce((s, n) => s + (n.read ? 0 : 1), 0) }

export function subscribeToasts(cb: (n: Notif) => void) { toastSubs.add(cb); return () => { toastSubs.delete(cb) } }

function subscribe(cb: () => void) { storeSubs.add(cb); return () => { storeSubs.delete(cb) } }
export function useNotifications(): Notif[] { return useSyncExternalStore(subscribe, () => items, () => EMPTY) }

// "hace 3 min" / "hace 1 h" / "ayer"
export function timeAgo(ts: number): string {
  const s = Math.floor((Date.now() - ts) / 1000)
  if (s < 60) return 'ahora'
  const m = Math.floor(s / 60); if (m < 60) return `hace ${m} min`
  const h = Math.floor(m / 60); if (h < 24) return `hace ${h} h`
  const d = Math.floor(h / 24); return d === 1 ? 'ayer' : `hace ${d} d`
}
