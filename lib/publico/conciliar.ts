import type { createServerClient } from '@/lib/supabase'
import { normAlias } from '@/lib/ticketExtract'

type Supa = ReturnType<typeof createServerClient>

// ── CONCILIACIÓN factura ↔ gasto ya registrado ──────────────────────────────────────────────────────────
// Una compra deja HUELLA en varios lados: la fotografías, Poster la registra, y semanas después llega el CFDI
// al correo. Sin conciliar, capturar la factura mete el gasto OTRA VEZ (así se colaron $5,451 de gasto fantasma
// en jul-ago 2026). Este módulo contesta: "¿este CFDI YA está en los libros?" — y si sí, capturarlo debe LIGAR
// (pegarle los conceptos exactos al movimiento que ya existe) en vez de crear uno nuevo.
//
// El proveedor se resuelve por ALIAS: el CFDI trae el nombre fiscal ("ABASTECEDORA DE BEBIDAS Y CERVEZA DE
// HOLBOX") y los libros el canónico ("Holbeer"). ticket_supplier_aliases ya guarda ese puente — lo aprende sola
// cada captura, así que la 1ª factura de un proveedor se liga a mano y de ahí en adelante empata sola.

export type MovCandidato = {
  id: string; date: string; amount: number
  proveedor: string | null; note: string | null
  origin: string | null; category: string
  ticket_scan_id: string | null; source: string | null
}

export type FacturaLite = { uuid: string; fecha: string; total: number; emisor_nombre: string | null }

export type MatchFactura = {
  costoId: string; date: string; amount: number; label: string
  origin: string | null; category: string
  delta: number; dias: number
  confianza: 'exacta' | 'probable'
  yaTieneScan: boolean          // el movimiento YA trae itemización (un ticket de foto) → conflicto, nunca automático
  proveedorCanonico: string | null
}

// Ventana de búsqueda. Ancha a propósito: la factura suele timbrarse días después de la compra. La ventana NO
// decide el automatismo — eso lo hacen los umbrales de abajo.
const DIAS_VENTANA = 7
// Tolerancia de monto: el CFDI y lo tecleado en el POS difieren por centavos de redondeo de IVA (Holbeer:
// $1,476.00 en el CFDI vs $1,476.36 en Poster). Un peso, o medio por ciento en compras grandes.
export const toleranciaMonto = (total: number) => Math.max(1, Math.abs(total) * 0.005)

// Umbrales para que un match sea INEQUÍVOCO (los únicos que se ligan solos, sin que lo veas):
const AUTO_DELTA_MAX = 1      // hasta un peso de diferencia
const AUTO_DIAS_MAX = 3       // hasta 3 días entre la compra y el timbrado

const dias = (a: string, b: string) =>
  Math.round(Math.abs(new Date(`${a}T12:00:00Z`).getTime() - new Date(`${b}T12:00:00Z`).getTime()) / 86400000)

/** Nombre fiscal del CFDI → proveedor canónico de los libros, vía los alias ya aprendidos. */
export function resolverProveedor(emisorNombre: string | null, aliases: Map<string, string>): string | null {
  const raw = normAlias(emisorNombre ?? '')
  if (!raw) return null
  return aliases.get(raw) ?? null
}

// ¿Este movimiento es de ese proveedor? El nombre canónico puede venir en la columna `proveedor` o embebido en
// la nota ("Alimentos Selectos del Bajío · Poster #155"), según cómo se haya registrado.
function esDelProveedor(m: MovCandidato, canonico: string): boolean {
  const c = normAlias(canonico)
  if (!c) return false
  const p = normAlias(m.proveedor ?? '')
  if (p && (p === c || p.includes(c) || c.includes(p))) return true
  const n = normAlias(m.note ?? '')
  return !!n && n.includes(c)
}

/**
 * Busca el movimiento ya registrado que corresponde a esta factura. Devuelve null si es gasto NUEVO.
 * Sin proveedor resuelto no hay match: empatar solo por monto+fecha confundiría dos compras del mismo día.
 */
export function buscarMatch(f: FacturaLite, movs: MovCandidato[], aliases: Map<string, string>, scanPropio?: string | null): MatchFactura | null {
  const canonico = resolverProveedor(f.emisor_nombre, aliases)
  if (!canonico) return null
  const total = Number(f.total ?? 0)
  const tol = toleranciaMonto(total)

  const cands = movs
    // No empatar contra lo que la propia factura ya generó. Solo aplica si YA tiene scan: si scanPropio es null,
    // comparar contra null descartaría justo los movimientos sin itemizar, que son los que buscamos.
    .filter((m) => !scanPropio || (m.id !== scanPropio && m.ticket_scan_id !== scanPropio))
    .filter((m) => esDelProveedor(m, canonico))
    .map((m) => ({ m, delta: Math.abs(Number(m.amount) - total), d: dias(m.date, f.fecha) }))
    .filter((c) => c.delta <= tol && c.d <= DIAS_VENTANA)
    .sort((a, b) => a.delta - b.delta || a.d - b.d)

  if (!cands.length) return null
  const best = cands[0]
  const yaTieneScan = !!best.m.ticket_scan_id

  // INEQUÍVOCO = un solo candidato, casi el mismo monto, casi la misma fecha, y el movimiento aún sin itemizar.
  // Si ya trae scan, la compra está capturada por otra vía (foto): eso es un CONFLICTO que decides tú, no un
  // ligado automático — ligar dos itemizaciones al mismo costo perdería una de las dos.
  const exacta = cands.length === 1 && best.delta <= AUTO_DELTA_MAX && best.d <= AUTO_DIAS_MAX && !yaTieneScan

  return {
    costoId: best.m.id, date: best.m.date, amount: Number(best.m.amount),
    label: best.m.proveedor || best.m.note || best.m.category,
    origin: best.m.origin, category: best.m.category,
    delta: Math.round(best.delta * 100) / 100, dias: best.d,
    confianza: exacta ? 'exacta' : 'probable',
    yaTieneScan, proveedorCanonico: canonico,
  }
}

/** Los movimientos contra los que se concilia + el diccionario de alias, en una sola ida a la base. */
export async function cargarContexto(supabase: Supa): Promise<{ movs: MovCandidato[]; aliases: Map<string, string> }> {
  const [costos, sup] = await Promise.all([
    supabase.from('publico_costos').select('id, date, amount, proveedor, note, origin, category, ticket_scan_id, source').eq('scope', 'publico'),
    supabase.from('ticket_supplier_aliases').select('raw_norm, proveedor').is('deleted_at', null),
  ])
  const movs = ((costos.data ?? []) as MovCandidato[])
  const aliases = new Map<string, string>()
  for (const a of (sup.data ?? []) as Array<{ raw_norm: string; proveedor: string }>) if (a.raw_norm && a.proveedor) aliases.set(a.raw_norm, a.proveedor)
  return { movs, aliases }
}
