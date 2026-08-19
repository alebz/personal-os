'use client'

import { useCallback, useEffect, useState } from 'react'
import { MONEY } from '../money/MoneyChrome'
import { pesos } from './kit'

// BARRA DE ESTADO al fondo de la ventana (idiomática de XP) — el indicador de FRESCURA de los datos. Dos capas:
//   1) Heartbeat de VENTAS + botón "importar ahora" (lo que había).
//   2) SALUD DEL CRON completa (/api/publico/cron-health): caza los 3 modos de falla silenciosa que la auditoría
//      encontró — paso que TRUENA (rojo), sin éxito reciente / STALE (rojo), y "verde pero VACÍO" (ámbar: corrió
//      bien pero lleva demasiado sin traer datos, p.ej. Clip importando cero). Antes, 4 de 5 pasos podían estar
//      muertos con el cron en verde; ahora la barra lo grita.

type Sync = { last_success_at: string | null; last_import_date: string | null; last_error: string | null }
type Problema = { step: string; state: 'empty' | 'stale' | 'error'; detail: string }
type Health = { worst: 'unknown' | 'ok' | 'empty' | 'stale' | 'error'; problemas: Problema[] }

const panel = (bad?: boolean): React.CSSProperties => ({
  display: 'inline-flex', alignItems: 'center', gap: 4, padding: '0 8px', height: 18,
  border: '1px solid', borderColor: bad ? '#c31212' : '#8a97a0 #ffffff #ffffff #8a97a0',
  background: bad ? '#c31212' : 'transparent', color: bad ? '#fff' : '#3a4656', fontWeight: bad ? 700 : 400,
})
// Panel de color explícito (para el ámbar de "verde pero vacío", que no es un rojo de "tronó").
const panelColor = (bg: string): React.CSSProperties => ({
  display: 'inline-flex', alignItems: 'center', gap: 4, padding: '0 8px', height: 18,
  border: '1px solid', borderColor: bg, background: bg, color: '#fff', fontWeight: 700,
})

export default function PublicoStatusBar() {
  const [sync, setSync] = useState<Sync | null>(null)
  const [prop, setProp] = useState<{ pendiente: number; nivel: 'verde' | 'amarillo' | 'rojo' } | null>(null)
  const [health, setHealth] = useState<Health | null>(null)
  const [importing, setImporting] = useState(false)

  const load = useCallback(async () => {
    fetch('/api/publico/poster/import').then((r) => r.json()).then((s) => { if (s) setSync(s) }).catch(() => {})
    fetch('/api/publico/propinas').then((r) => r.json()).then((p) => { if (p && typeof p.pendiente === 'number') setProp({ pendiente: p.pendiente, nivel: p.nivel }) }).catch(() => {})
    fetch('/api/publico/cron-health').then((r) => r.json()).then((h) => { if (h && h.worst) setHealth(h) }).catch(() => {})
  }, [])
  useEffect(() => { void load() }, [load])

  async function importNow() {
    setImporting(true)
    try { await fetch('/api/publico/poster/import?days=14', { method: 'POST' }); await load() } finally { setImporting(false) }
  }

  const lastOk = sync?.last_success_at ? new Date(sync.last_success_at) : null
  const daysSince = lastOk ? Math.floor((Date.now() - lastOk.getTime()) / 86_400_000) : null
  const stale = !!sync?.last_error || daysSince == null || daysSince >= 2
  const heartbeat = sync?.last_error
    ? `Import del POS falló: ${sync.last_error}`
    : sync?.last_success_at
      ? `POS · último import ${daysSince === 0 ? 'hoy' : daysSince === 1 ? 'ayer' : `hace ${daysSince} días`}${stale ? ' — revísalo' : ''}`
      : 'POS · sin importar aún'

  const propColor = prop?.nivel === 'rojo' ? '#c31212' : prop?.nivel === 'amarillo' ? '#b45309' : '#5a6a86'

  // Salud del cron: el peor problema manda el color. error/stale = rojo (tronó o no corre); empty = ámbar (verde
  // pero vacío). El texto nombra el paso — "clip: en verde pero no ha importado NADA nunca" es la alerta de Clip.
  const top = health?.problemas?.[0]
  const cronBad = health?.worst === 'error' || health?.worst === 'stale'
  const cronEmpty = health?.worst === 'empty'

  return (
    <div style={{ flexShrink: 0, display: 'flex', alignItems: 'center', gap: 3, height: 22, background: '#ece9d8', borderTop: '1px solid #ffffff', padding: '0 3px', fontSize: 11, fontFamily: 'inherit' }}>
      <div style={panel(stale)}>{stale && <span>⚠</span>}{heartbeat}</div>
      {top && (cronBad || cronEmpty) && (
        <div style={panelColor(cronBad ? '#c31212' : '#b45309')} title={health!.problemas.map((p) => `${p.step}: ${p.detail}`).join(' · ')}>
          <span>⚠</span>{top.step}: {top.detail}{health!.problemas.length > 1 ? ` (+${health!.problemas.length - 1})` : ''}
        </div>
      )}
      {health?.worst === 'ok' && <div style={{ ...panel(), color: '#0a7d18' }}>cron ✓</div>}
      {health?.worst === 'unknown' && <div style={{ ...panel(), color: '#8a97a0', fontStyle: 'italic' }}>cron · sin datos</div>}
      {prop && prop.pendiente > 0 && <div style={{ ...panel(), color: propColor, fontWeight: prop.nivel === 'rojo' ? 700 : 400 }}>debes {pesos(prop.pendiente)} de propina</div>}
      <div style={{ flex: 1 }} />
      <button onClick={() => void importNow()} disabled={importing} style={{ ...panel(), cursor: importing ? 'default' : 'pointer', opacity: importing ? 0.6 : 1, background: 'linear-gradient(#fff,#e9f0fa)' }}>{importing ? 'importando…' : 'importar ahora'}</button>
    </div>
  )
}
