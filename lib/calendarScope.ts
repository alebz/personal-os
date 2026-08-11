// Cliente: aplica editar/borrar una ocurrencia de serie según el ALCANCE elegido. Ruta a los endpoints
// de F3 (exception / split / base). Devuelve la respuesta cruda para manejar el pre-confirm de podado
// ({ needsConfirm, staleCount }). Compartido por las tres superficies (arcade, XP, tray).
export type Scope = 'solo' | 'siguientes' | 'toda'
type EditValues = { title: string; event_date: string; event_time?: string; note?: string; rrule?: unknown }

export async function applyScope(p: {
  mode: 'edit' | 'delete'; scope: Scope; seriesId: string; occ: string; confirmPrune?: boolean; edit?: EditValues
}): Promise<{ ok?: boolean; needsConfirm?: boolean; staleCount?: number }> {
  const post = (u: string, b: unknown) => fetch(u, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(b) }).then(r => r.json())
  const { mode, scope, seriesId, occ, confirmPrune, edit } = p

  if (mode === 'delete') {
    if (scope === 'solo') return post('/api/calendar/exception', { series_id: seriesId, occurrence_date: occ, cancelled: true })
    if (scope === 'siguientes') return post(`/api/calendar/${seriesId}/split`, { cut_date: occ, mode: 'delete', confirmPrune })
    await fetch(`/api/calendar/${seriesId}`, { method: 'DELETE' }); return { ok: true }
  }

  const e = edit!
  if (scope === 'solo') return post('/api/calendar/exception', { series_id: seriesId, occurrence_date: occ, override: { title: e.title, event_time: e.event_time, note: e.note } })
  if (scope === 'siguientes') return post(`/api/calendar/${seriesId}/split`, { cut_date: occ, mode: 'edit', confirmPrune, newEvent: { title: e.title, event_date: occ, event_time: e.event_time, note: e.note, rrule: e.rrule } })
  return fetch(`/api/calendar/${seriesId}`, { method: 'PATCH', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ title: e.title, event_date: e.event_date, event_time: e.event_time, note: e.note, rrule: e.rrule, confirmPrune }) }).then(r => r.json())
}
