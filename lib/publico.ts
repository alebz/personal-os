// Público Gourmet — constantes compartidas (rutas + componentes). Fuente única de: contenedores,
// categorías de costo, y los DEFAULTS INTELIGENTES por categoría (origen + fijo/variable) que hacen
// la captura rápida. El default se aplica al elegir categoría; el usuario puede overridear (1 tap) y
// la elección es sticky en burst — así meter 5 insumos seguidos no re-pregunta nada.

export type ContainerKey = 'clip' | 'caja_chica' | 'caja_pos'
export type CostCategory = 'insumo' | 'nomina' | 'gasto_fijo' | 'reinversion'
export type CostKind = 'fijo' | 'variable'

// Contenedores de dinero del negocio. En F1 son ATRIBUCIÓN (enum en cada movimiento); en F5 nacen
// como fondos keyed (finance_envelopes scope='publico') SOLO para el ledger de ajustes del cuadre.
export const CONTAINERS: { key: ContainerKey; label: string; tipo: 'banco' | 'efectivo' }[] = [
  { key: 'clip',       label: 'CLIP',       tipo: 'banco' },     // caen las ventas con tarjeta
  { key: 'caja_chica', label: 'Caja chica', tipo: 'efectivo' },
  { key: 'caja_pos',   label: 'Caja POS',   tipo: 'efectivo' },  // caen las ventas en efectivo
]
export const containerLabel = (k: ContainerKey) => CONTAINERS.find((c) => c.key === k)?.label ?? k

// Categorías de costo + su default de origen y de naturaleza (confirmados por Alex 2026-08):
//  insumo→CLIP·variable · nómina→CLIP·fijo · gasto_fijo→Caja chica·fijo · reinversión→CLIP·(excluida).
// `kind: null` = reinversión: NO entra en la utilidad operativa (es uso de la utilidad, su ROI es F4).
export const COST_CATEGORIES: {
  key: CostCategory; label: string; defaultOrigin: ContainerKey; defaultKind: CostKind | null
}[] = [
  { key: 'insumo',      label: 'Insumo',      defaultOrigin: 'clip',       defaultKind: 'variable' },
  { key: 'nomina',      label: 'Nómina',      defaultOrigin: 'clip',       defaultKind: 'fijo' },
  { key: 'gasto_fijo',  label: 'Gasto fijo',  defaultOrigin: 'caja_chica', defaultKind: 'fijo' },
  { key: 'reinversion', label: 'Reinversión', defaultOrigin: 'clip',       defaultKind: null },
]
export const catDefaults = (k: CostCategory) => COST_CATEGORIES.find((c) => c.key === k)!

// Ventas → contenedor (regla determinista, sin campo extra): efectivo cae en Caja POS, tarjeta en CLIP.
export const SALES_CONTAINER: Record<'efectivo' | 'tarjeta', ContainerKey> = {
  efectivo: 'caja_pos',
  tarjeta: 'clip',
}

// Utilidad OPERATIVA = ventas − (insumo + nómina + gasto_fijo). Reinversión NO cuenta (uso de utilidad).
export const OPERATING_CATEGORIES: CostCategory[] = ['insumo', 'nomina', 'gasto_fijo']
