'use client'

import { useCallback, useEffect, useState } from 'react'
import type { Fund, FundHandlers } from '@/components/finance/CajaFuerteSection'

function todayStr() {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}
async function post(url: string, body: unknown) { await fetch(url, { method: 'POST',  headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) }) }
async function patch(url: string, body: unknown) { await fetch(url, { method: 'PATCH', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) }) }
async function del(url: string) { await fetch(url, { method: 'DELETE' }) }

// One source of truth + handlers for a scope's Caja Fuerte funds. Both Finanzas Alex ('personal') and
// Uptown ('uptown') use it — same endpoints, different scope, no duplicated logic. `month` stamps the
// aportar/retirar movements; `afterChange` (optional) lets a consumer refresh its own derived state
// (e.g. Finanzas' Historial + wallet deltas) after any fund mutation.
export function useCajaFuerte(scope: 'personal' | 'uptown', month: string, afterChange?: () => void) {
  const [funds, setFunds] = useState<Fund[]>([])

  // load() only depends on scope → the mount effect never re-fires on month/afterChange changes.
  const load = useCallback(async () => {
    try {
      const r = await fetch(`/api/finance/funds?scope=${scope}&archived=1`)
      if (r.ok) setFunds(await r.json())
    } catch { /* keep prior */ }
  }, [scope])

  useEffect(() => { void load() }, [load])

  // refresh() = reload funds + let the consumer sync its own state. Called imperatively after a
  // mutation (never in an effect), so a fresh afterChange each render is harmless.
  const refresh = useCallback(async () => { await load(); afterChange?.() }, [load, afterChange])

  const handlers: FundHandlers = {
    onAportaRetira: async (id, flow, desc, amount) => {
      await post('/api/finance/movements', {
        month, date: todayStr(), description: desc, amount, flow, category: 'fondo',
        commitment_id: null, envelope_id: id, metodo: null,
      })
      await refresh()
    },
    onCreate:       async (label, target) => { await post('/api/finance/envelopes', { label, target, scope }); await refresh() },
    onUpdateTarget: async (id, target)    => { await patch(`/api/finance/envelopes/${id}`, { target });        await refresh() },
    onUpdateLabel:  async (id, label)     => { await patch(`/api/finance/envelopes/${id}`, { label });         await refresh() },
    onArchive:      async (id)            => { await patch(`/api/finance/envelopes/${id}`, { archived: true }); await refresh() },
    onRestore:      async (id)            => { await patch(`/api/finance/envelopes/${id}`, { archived: false }); await refresh() },
    onDelete:       async (id)            => { await del(`/api/finance/envelopes/${id}`); await refresh() },
  }

  return { funds, refresh, handlers }
}
