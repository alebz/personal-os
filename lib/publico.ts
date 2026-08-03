// Público Gourmet — constantes compartidas (rutas + componentes). Fuente única de: contenedores,
// categorías de costo, y los DEFAULTS INTELIGENTES por categoría (origen + fijo/variable) que hacen
// la captura rápida. El default se aplica al elegir categoría; el usuario puede overridear (1 tap) y
// la elección es sticky en burst — así meter 5 insumos seguidos no re-pregunta nada.

export type ContainerKey = 'clip' | 'caja_chica' | 'caja_pos'
export type OriginKey = ContainerKey | null   // null = "sin caja" (protocolo/condonado; no toca contenedor)
export type CostCategory = 'insumo' | 'nomina' | 'gasto_fijo' | 'reinversion' | 'renta_condonada'
export type CostKind = 'fijo' | 'variable'

// Contenedores de dinero del negocio. En F1 son ATRIBUCIÓN (enum en cada movimiento); en F5 nacen
// como fondos keyed (finance_envelopes scope='publico') SOLO para el ledger de ajustes del cuadre.
export const CONTAINERS: { key: ContainerKey; label: string; tipo: 'banco' | 'efectivo' }[] = [
  { key: 'clip',       label: 'CLIP',       tipo: 'banco' },     // caen las ventas con tarjeta
  { key: 'caja_chica', label: 'Caja chica', tipo: 'efectivo' },
  { key: 'caja_pos',   label: 'Caja POS',   tipo: 'efectivo' },  // caen las ventas en efectivo
]
export const containerLabel = (k: ContainerKey) => CONTAINERS.find((c) => c.key === k)?.label ?? k
// Etiqueta de ORIGEN incluyendo "sin caja" (null). Para selectores/listados.
export const originLabel = (k: OriginKey) => (k == null ? 'Sin caja' : containerLabel(k))
// Opciones del selector de origen: los 3 contenedores + "Sin caja" (protocolo/condonado, no toca caja).
export const ORIGIN_OPTIONS: { key: OriginKey; label: string }[] = [
  ...CONTAINERS.map((c) => ({ key: c.key as OriginKey, label: c.label })),
  { key: null, label: 'Sin caja' },
]

// Categorías de costo + su default de origen y de naturaleza (confirmados por Alex 2026-08):
//  insumo→CLIP·variable · nómina→CLIP·fijo · gasto_fijo→Caja chica·fijo · reinversión→CLIP·(excluida).
// `kind: null` = reinversión: NO entra en la utilidad operativa (es uso de la utilidad, su ROI es F4).
export const COST_CATEGORIES: {
  key: CostCategory; label: string; defaultOrigin: OriginKey; defaultKind: CostKind | null
}[] = [
  { key: 'insumo',          label: 'Insumo',          defaultOrigin: 'clip',       defaultKind: 'variable' },
  { key: 'nomina',          label: 'Nómina',          defaultOrigin: 'clip',       defaultKind: 'fijo' },
  { key: 'gasto_fijo',      label: 'Gasto fijo',      defaultOrigin: 'caja_chica', defaultKind: 'fijo' },
  { key: 'reinversion',     label: 'Reinversión',     defaultOrigin: 'clip',       defaultKind: null },
  // Renta condonada (arreglo Ameno): NO-operativa (fuera de utilidad operativa), sin caja por default.
  { key: 'renta_condonada', label: 'Renta condonada', defaultOrigin: null,         defaultKind: null },
]
export const catDefaults = (k: CostCategory) => COST_CATEGORIES.find((c) => c.key === k)!

// Ventas → contenedor (regla determinista, sin campo extra): efectivo cae en Caja POS, tarjeta en CLIP.
export const SALES_CONTAINER: Record<'efectivo' | 'tarjeta', ContainerKey> = {
  efectivo: 'caja_pos',
  tarjeta: 'clip',
}

// Utilidad OPERATIVA = ventas − (insumo + nómina + gasto_fijo). Reinversión NO cuenta (uso de utilidad).
export const OPERATING_CATEGORIES: CostCategory[] = ['insumo', 'nomina', 'gasto_fijo']
