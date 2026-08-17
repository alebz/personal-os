// Público — helpers compartidos entre PublicoContent, TicketFoto y AliasManager (Fase 0: extraídos tal cual).
// Fecha en día natural local + tipos del catálogo Poster (solo lectura) para los selectores de mapeo.

export const localDate = (d = new Date()) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
export const addDays = (iso: string, n: number) => { const d = new Date(iso + 'T12:00:00'); d.setDate(d.getDate() + n); return localDate(d) }
export const dayLabel = (iso: string) => {
  const d = new Date(iso + 'T12:00:00')
  return d.toLocaleDateString('es-MX', { weekday: 'short', day: '2-digit', month: 'short' })
}
// Corto es-MX "6 ago" (día antes que mes, nunca MM/DD) para etiquetas inline como "vence 6 ago".
export const dayMonth = (iso: string) => new Date(iso + 'T12:00:00').toLocaleDateString('es-MX', { day: 'numeric', month: 'short' })
// Mes legible es-MX "agosto 2026" desde "YYYY-MM".
export const monthName = (ym: string) => { const [y, m] = ym.split('-').map(Number); return `${new Date(y, m - 1, 1).toLocaleDateString('es-MX', { month: 'long' })} ${y}` }

export type PosterIngredient = { id: number; name: string; unit: string; unitCost?: number }   // unitCost = prime_cost ÷ 10000 (pesos/unidad base)
export type PosterMerch = { id: number; name: string; unit: string }   // mercancía de reventa (menu.getProducts)
export type PosterSupplier = { id: number; name: string }
export type PosterCatalog = { ingredients: PosterIngredient[]; merchandise: PosterMerch[]; suppliers: PosterSupplier[] }
