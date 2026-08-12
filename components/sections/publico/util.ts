// Público — helpers compartidos entre PublicoContent, TicketFoto y AliasManager (Fase 0: extraídos tal cual).
// Fecha en día natural local + tipos del catálogo Poster (solo lectura) para los selectores de mapeo.

export const localDate = (d = new Date()) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
export const addDays = (iso: string, n: number) => { const d = new Date(iso + 'T12:00:00'); d.setDate(d.getDate() + n); return localDate(d) }
export const dayLabel = (iso: string) => {
  const d = new Date(iso + 'T12:00:00')
  return d.toLocaleDateString('es-MX', { weekday: 'short', day: '2-digit', month: 'short' })
}

export type PosterIngredient = { id: number; name: string; unit: string }
export type PosterSupplier = { id: number; name: string }
export type PosterCatalog = { ingredients: PosterIngredient[]; suppliers: PosterSupplier[] }
