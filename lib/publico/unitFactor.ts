// FACTOR A LA UNIDAD BASE de Poster: num_poster = cantidad_del_ticket × factor. Dos casos, CASO A con PRIORIDAD:
//
//   CASO A — la LÍNEA vende por peso/volumen y trae unidad explícita ("2.27 KG", "500 G", "1 L", "750 ML").
//            El factor NO se adivina: es conversión pura contra la unidad base del ingrediente en Poster.
//            kg→kg=1 · g→kg=0.001 · l→l=1 · ml→l=0.001. Determinista.
//
//   CASO B — la línea vende por PIEZA (cantidad 1, unidad PZA) y el peso vive en el NOMBRE ("BABY BELLA 500 GR").
//            Ahí sí hay que parsear el nombre.
//
// Si la unidad del ticket es INCOMPATIBLE con la base del ingrediente (litros contra kilos), NO se infiere —
// necesita densidad. Se devuelve 'incompatible' para que el humano lo resuelva; nunca se adivina.

export type FactorResult = number | 'incompatible' | null   // número = resuelto · 'incompatible' = requiere humano · null = no aplica CASO A y el nombre no dio nada

const KG = new Set(['KG', 'K', 'KGS', 'KILO', 'KILOS', 'KILOGRAMO', 'KILOGRAMOS'])
const G = new Set(['G', 'GR', 'GRS', 'GRAMO', 'GRAMOS'])
const L = new Set(['L', 'LT', 'LTS', 'LITRO', 'LITROS'])
const ML = new Set(['ML', 'MILILITRO', 'MILILITROS', 'CC'])

// Unidad del ticket normalizada. Todo lo que no sea peso/volumen conocido → 'PZA' (pieza/paquete/unidad).
export function normTicketUnit(u: string | null | undefined): 'KG' | 'G' | 'L' | 'ML' | 'PZA' | null {
  const s = (u ?? '').toUpperCase().replace(/[^A-Z]/g, '')
  if (!s) return null
  if (KG.has(s)) return 'KG'
  if (G.has(s)) return 'G'
  if (L.has(s)) return 'L'
  if (ML.has(s)) return 'ML'
  return 'PZA'
}

// CASO A: conversión determinista de la unidad de peso/volumen del ticket a la unidad base del ingrediente.
function convFactor(tu: 'KG' | 'G' | 'L' | 'ML', ingUnit: string | undefined): number | 'incompatible' {
  const iu = (ingUnit ?? '').toLowerCase()
  if (iu === 'kg') { if (tu === 'KG') return 1; if (tu === 'G') return 0.001; return 'incompatible' }   // peso contra volumen → densidad
  if (iu === 'l') { if (tu === 'L') return 1; if (tu === 'ML') return 0.001; return 'incompatible' }
  return 'incompatible'   // ingrediente por pieza pero la línea viene por peso/volumen → revisar
}

// CASO B: el peso/volumen está embebido en el nombre. (La lógica que ya existía, ahora como fallback.)
function parseNameFactor(name: string, ingUnit: string | undefined): FactorResult {
  const N = (name ?? '').toUpperCase()
  const m = N.match(/(\d+(?:[.,]\d+)?)\s*(KG|GR|G|ML|LT|L)\b/)
  if (m) {
    const v = parseFloat(m[1].replace(',', '.')), u = m[2]
    if (ingUnit === 'kg') { if (u === 'KG') return v; if (u === 'G' || u === 'GR') return v / 1000 }
    if (ingUnit === 'l') { if (u === 'L' || u === 'LT') return v; if (u === 'ML') return v / 1000 }
    return 'incompatible'   // la unidad del nombre no cuadra con la base
  }
  if (/\b\d+(?:[.,]\d+)?\b/.test(N)) return null   // número suelto sin unidad → ambiguo, no adivinar
  return 1   // sin peso en el nombre → 1 pieza = 1 unidad base
}

// Propone el factor. CASO A (unidad de la línea) tiene prioridad; solo si es pieza/sin unidad cae al nombre.
export function proposeFactor(name: string, ticketUnit: string | null | undefined, ingUnit: string | undefined): FactorResult {
  const tu = normTicketUnit(ticketUnit)
  if (tu && tu !== 'PZA') return convFactor(tu, ingUnit)   // CASO A — determinista, sin tocar el nombre
  return parseNameFactor(name, ingUnit)                    // CASO B — el peso vive en el nombre
}
