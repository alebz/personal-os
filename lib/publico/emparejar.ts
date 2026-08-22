import { normAlias } from '@/lib/ticketExtract'

// ── EMPAREJAR el catálogo con lo que REALMENTE compras ───────────────────────────────────────────────────
// El costo de un producto solo llega por su liga a una fila-alias (lo aprendido de tus facturas). Las filas que
// nacieron en Poster no tienen esa liga, así que se quedan sin costo aunque el precio exacto YA esté en el
// sistema: "Aceite Trufado" (de Poster, en litros) y "Aceite aroma Trufa Negra 250 ml" (de la factura, $185 la
// botella) son dos registros que nadie conectó. Esto propone los pares; tú confirmas.
//
// LA UNIDAD ES LO PELIGROSO. Compras botellas de 250 ml pero cuentas litros: ligar sin convertir deja el aceite
// en $185/l cuando vale $740/l. Un costo equivocado es peor que uno faltante — el faltante se ve, el equivocado
// se cree. Por eso el factor se propone junto con el par, y el costo final se muestra ANTES de aceptar.

export type FilaCatalogo = { id: string; nombre: string; unidad_base: string | null; costo: number | null; cuenta_stock: boolean; alias_raw_norm: string | null; poster_ingredient_id: number | null; activo: boolean }
export type FilaAlias = { raw_norm: string; descripcion: string; unidad: string | null; factor_a_base: number | null; importe_acumulado: number; cantidad_acumulada: number; veces: number; toca_stock: boolean }

export type Sugerencia = {
  catalogoId: string; nombre: string; unidadBase: string | null
  rawNorm: string; descripcion: string; unidadCompra: string | null
  veces: number; importe: number; cantidad: number
  factor: number | null            // cuántas unidades base trae UNA unidad de compra (250 ml → 0.25 l)
  factorDeducido: boolean          // true = salió de la medida en el nombre; false = ya venía guardado
  costo: number | null             // $ por unidad base, con el factor aplicado
  costoSinFactor: number | null    // lo que saldría SIN convertir — para que se vea el tamaño del error
  pack: { n: number; medida: number; unidad: string } | null   // "6/1.5 LT" → la rejilla trae 6 de 1.5 LT
  score: number
  confianza: 'alta' | 'revisar'   // 'revisar' = solo la mitad del nombre coincide; es una corazonada, no un hallazgo
}

// Palabras que no distinguen un producto de otro: marcas de tamaño, unidades y relleno.
const RUIDO = new Set(['DE', 'DEL', 'LA', 'EL', 'LOS', 'LAS', 'CON', 'SIN', 'PARA', 'ORG', 'PZA', 'PZAS', 'PIEZA',
  'ML', 'LT', 'LTS', 'GR', 'GRS', 'KG', 'KGS', 'BOTELLA', 'PAQUETE', 'BOLSA', 'CAJA', 'LATA'])
const tokens = (s: string) => normAlias(s).split(' ').filter((t) => t.length >= 3 && !/^\d+$/.test(t) && !RUIDO.has(t))

// Dos palabras "son la misma" si coinciden, si una contiene a la otra, o si comparten raíz. Los umbrales
// salieron de errores REALES contra el catálogo de Público: con contención libre, "SALSA macha" empataba con
// "Sal"; con raíz de 4, "CLAMSHELL" empataba con "Clamato" y proponía $799/l de un producto equivocado. Exigir
// 5 letras en ambos casos mata esos dos y conserva los buenos (TRUFADO↔TRUFA, ALBAHACA↔ALBAHACAR).
const mismaPalabra = (a: string, b: string) =>
  a === b
  || ((a.includes(b) || b.includes(a)) && Math.min(a.length, b.length) >= 5)
  || (a.length >= 5 && b.length >= 5 && a.slice(0, 5) === b.slice(0, 5))

/** Qué tanto del nombre del catálogo aparece en el de la compra. 1 = todas sus palabras coinciden. */
export function parecido(nombreCatalogo: string, descripcionAlias: string): number {
  const a = tokens(nombreCatalogo), b = tokens(descripcionAlias)
  if (!a.length || !b.length) return 0
  const hits = a.filter((x) => b.some((y) => mismaPalabra(x, y))).length
  return hits / a.length
}

const MEDIDA = /(\d+(?:[.,]\d+)?)\s*(ml|mls|l|lt|lts|litros?|g|gr|grs|gramos?|kg|kgs|kilos?)\b/gi
// PAQUETE: "6/1.5 LT" = seis botellas de 1.5 L · "24/355 ML" = veinticuatro latas. Sin esto, el agua mineral
// quedaba en $98/l cuando vale $16/l (se tomaba 1.5 como si la compra fuera UNA botella).
const PACK = /(\d+)\s*\/\s*(\d+(?:[.,]\d+)?)\s*(ml|mls|l|lt|lts|g|gr|grs|kg|kgs)\b/i

/** El paquete que declara el nombre, para poder EXPLICAR el factor en vez de solo escupirlo. */
export function packDe(descripcion: string): { n: number; medida: number; unidad: string } | null {
  const m = descripcion.match(PACK)
  if (!m) return null
  const n = Number(m[1]), medida = Number(m[2].replace(',', '.'))
  if (!Number.isFinite(n) || !Number.isFinite(medida) || n <= 1 || medida <= 0) return null
  return { n, medida, unidad: m[3].toUpperCase() }
}
const BASE_LITRO = new Set(['L', 'LT', 'LTS', 'LITRO', 'LITROS'])
const BASE_KILO = new Set(['KG', 'KGS', 'KILO', 'KILOS'])

/**
 * Cuántas unidades base trae UNA unidad de compra, deducido de la medida en el nombre.
 * "Aceite aroma Trufa Negra 250 ml" con base `l` → 0.25. "KS PIMIENTA 400G" con base `kg` → 0.4.
 * Devuelve null si la base es por pieza (ahí una compra es una pieza y no hay nada que convertir) o si el
 * nombre no dice la medida — en esos casos el factor lo pones tú.
 */
export function factorSugerido(descripcion: string, unidadBase: string | null): number | null {
  const base = (unidadBase ?? '').trim().toUpperCase()
  const esLitro = BASE_LITRO.has(base), esKilo = BASE_KILO.has(base)
  const pack = descripcion.match(PACK)

  // Base por PIEZA: lo único convertible es el tamaño del paquete (un 24-pack son 24 piezas, no una).
  if (!esLitro && !esKilo) {
    if (!pack) return null
    const n = Number(pack[1])
    return Number.isFinite(n) && n > 1 ? n : null
  }

  // Base por volumen/peso: un paquete son N × M unidades, no M.
  if (pack) {
    const n = Number(pack[1]), m = Number(pack[2].replace(',', '.')), u = pack[3].toUpperCase()
    if (Number.isFinite(n) && Number.isFinite(m) && n > 0 && m > 0) {
      const total = n * m
      if (esLitro) { if (u.startsWith('ML')) return total / 1000; if (u.startsWith('L')) return total }
      else { if (u.startsWith('KG')) return total; if (u.startsWith('G')) return total / 1000 }
    }
  }

  // La última medida del nombre: el tamaño suele ir al final ("Aceite ... 250 ml").
  const todas = [...descripcion.matchAll(MEDIDA)]
  if (!todas.length) return null
  const m = todas[todas.length - 1]
  const valor = Number(m[1].replace(',', '.'))
  if (!Number.isFinite(valor) || valor <= 0) return null
  const u = m[2].toUpperCase()

  if (esLitro) {
    if (u.startsWith('ML')) return valor / 1000
    if (u.startsWith('L')) return valor
    return null   // gramos en un producto que se mide en litros: no se convierte a ciegas
  }
  if (u.startsWith('KG') || u.startsWith('KILO')) return valor
  if (u.startsWith('G')) return valor / 1000
  return null
}

const redondea = (n: number) => Math.round(n * 10000) / 10000
export const costoPorBase = (importe: number, cantidad: number, factor: number | null): number | null => {
  if (!(importe > 0 && cantidad > 0)) return null
  const base = factor && factor > 0 ? cantidad * factor : cantidad
  return redondea(importe / base)
}

const MIN_SCORE = 0.5   // al menos la mitad del nombre del catálogo tiene que aparecer en la compra

/**
 * Para cada fila del catálogo SIN costo, la compra que mejor le corresponde. Una compra no se propone dos veces:
 * si dos productos la reclaman, se queda con el de mejor parecido y el otro se deja sin sugerencia (mejor
 * quedarse callado que proponer un par dudoso que meta un costo equivocado).
 */
export function sugerirPares(catalogo: FilaCatalogo[], aliases: FilaAlias[]): Sugerencia[] {
  const libres = aliases.filter((a) => a.toca_stock && Number(a.importe_acumulado) > 0 && Number(a.cantidad_acumulada) > 0)
  const objetivo = catalogo.filter((c) => c.activo && c.cuenta_stock && !c.alias_raw_norm)

  const cands: Sugerencia[] = []
  for (const c of objetivo) {
    for (const a of libres) {
      const score = parecido(c.nombre, a.descripcion)
      if (score < MIN_SCORE) continue
      const deducido = factorSugerido(a.descripcion, c.unidad_base)
      const factor = a.factor_a_base != null ? Number(a.factor_a_base) : deducido
      cands.push({
        catalogoId: c.id, nombre: c.nombre, unidadBase: c.unidad_base,
        rawNorm: a.raw_norm, descripcion: a.descripcion, unidadCompra: a.unidad,
        veces: a.veces, importe: Number(a.importe_acumulado), cantidad: Number(a.cantidad_acumulada),
        factor, factorDeducido: a.factor_a_base == null && deducido != null,
        costo: costoPorBase(Number(a.importe_acumulado), Number(a.cantidad_acumulada), factor),
        costoSinFactor: costoPorBase(Number(a.importe_acumulado), Number(a.cantidad_acumulada), null),
        pack: packDe(a.descripcion),
        score: Math.round(score * 100) / 100,
        confianza: score >= 0.66 ? 'alta' : 'revisar',
      })
    }
  }

  // Mejor primero, y cada compra se asigna a un solo producto (y cada producto a una sola compra).
  cands.sort((x, y) => y.score - x.score || y.veces - x.veces)
  const usadoAlias = new Set<string>(), usadoCat = new Set<string>()
  const out: Sugerencia[] = []
  for (const s of cands) {
    if (usadoAlias.has(s.rawNorm) || usadoCat.has(s.catalogoId)) continue
    usadoAlias.add(s.rawNorm); usadoCat.add(s.catalogoId)
    out.push(s)
  }
  return out
}
