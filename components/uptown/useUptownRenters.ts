'use client'

import { useCallback, useEffect, useState } from 'react'

// Inquilinos de Uptown como DATOS (tabla uptown_renters), compartido por ambos shells (arcade + XP).
// `rent` = renta ACTUAL = semilla para meses SIN fila en uptown_rents; el monto real de cada mes ya
// vive congelado en uptown_rents.amount → editar rent nunca reescribe el pasado.
export interface Renter {
  id: string; name: string; location: string | null; rent: number
  start_month: string | null; sort_order: number; archived: boolean
}

async function j(url: string, method: string, body?: unknown) {
  const r = await fetch(url, { method, headers: { 'content-type': 'application/json' }, body: body ? JSON.stringify(body) : undefined })
  return r.json().catch(() => ({}))
}

export function useUptownRenters() {
  const [renters, setRenters] = useState<Renter[]>([])

  const load = useCallback(async () => {
    try {
      const r = await fetch('/api/uptown/renters')
      if (r.ok) setRenters((await r.json()).map((x: Renter) => ({ ...x, rent: Number(x.rent) })))
    } catch { /* mantiene lo previo */ }
  }, [])
  useEffect(() => { void load() }, [load])

  // Activos para un mes = no archivados + ya arrancados (start_month ≤ mes).
  const activeFor = useCallback(
    (month: string) => renters.filter((r) => !r.archived && (!r.start_month || month >= r.start_month)),
    [renters],
  )

  const add     = async (name: string, rent: number, location?: string | null) => { await j('/api/uptown/renters', 'POST', { name, rent, location }); await load() }
  const edit    = async (id: string, patch: Partial<Renter>) => { await j(`/api/uptown/renters/${id}`, 'PATCH', patch); await load() }
  const remove  = async (id: string) => { const res = await j(`/api/uptown/renters/${id}`, 'DELETE'); await load(); return res as { archived?: boolean; deleted?: boolean; movements?: number } }
  const reorder = async (ids: string[]) => {
    setRenters((prev) => ids.map((id) => prev.find((r) => r.id === id)).filter(Boolean) as Renter[])  // optimista
    await j('/api/uptown/renters/reorder', 'POST', { ids }); await load()
  }

  return { renters, activeFor, add, edit, remove, reorder, refresh: load }
}
