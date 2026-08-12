import Anthropic from '@anthropic-ai/sdk'
import type { SupabaseClient } from '@supabase/supabase-js'

// Extracción de tickets de compra por foto (Público). La IA PROPONE un borrador; el humano confirma. Este
// módulo NO escribe gastos: solo lee la foto, aplica los alias aprendidos y devuelve el borrador editable.
//
// Modelo: Sonnet (override por-ruta). Medí haiku vs sonnet contra 5 tickets reales: en los difíciles haiku
// leía mal el proveedor (hasta en tickets limpios), inventaba líneas y afirmaba "alta" confianza estando
// equivocado; sonnet acertó proveedor/itemización y marcó su incertidumbre. El costo extra (~1.4¢/ticket)
// es irrelevante. NO usar el ANTHROPIC_MODEL global (está en haiku por costo para otras rutas).
const MODEL = 'claude-sonnet-4-6'

export type TicketItem = {
  codigo: string | null
  descripcion: string          // canónico (tras alias) al devolver el borrador; crudo al salir de la IA
  descripcion_raw: string      // lo que leyó la IA (para aprender el alias)
  cantidad: number | null
  unidad: string | null
  precio_unitario: number | null
  importe: number
  es_descuento: boolean
  categoria?: string | null    // prellenado por el alias de producto, si existe
  aliased?: boolean            // true si un alias reemplazó el texto crudo
  // Mapeo a Poster (Fase 0 — solo alimenta la lista lista-para-teclear; NO escribe al POS):
  posterIngredientId?: number | null   // id de Poster; null = sin mapear → solo panel
  factorABase?: number | null          // num_poster = cantidad * factorABase
  tocaStock?: boolean                  // false = gasto que NO va a inventario (default true)
  ivaTasa?: number | null              // tasa de IVA de la línea: 0 | 0.16 | null (sin definir → no adivinar)
  pesoVariable?: boolean               // true si el alias es de peso variable (cantidad = el peso leído, no un conteo)
  discrepancia?: string | null         // la IA marcó esta línea como dudosa (leyó X pero no cuadra con Y)
}
export type TicketDraft = {
  proveedor: string
  proveedor_raw: string
  proveedor_rfc: string | null
  sucursal: string | null
  fecha: string | null
  moneda: string
  subtotal: number | null
  descuento: number | null
  impuestos: number | null
  total: number | null
  legibilidad: 'alta' | 'media' | 'baja'
  notas: string | null
  items: TicketItem[]
  proveedorAliased: boolean
  posterSupplierId: number | null   // mapeo de proveedor a Poster (Fase 0); null = sin mapear
  // Desglose de pago leído del ticket (regla fija: efectivo → caja chica, tarjeta → CLIP). null = no legible.
  pagoEfectivo: number | null
  pagoTarjeta: number | null
  pagoUltimos4: string | null
}
export type ExtractResult = { ok: true; model: string; raw: unknown; draft: TicketDraft; aliasWarning?: string } | { ok: false; error: string; status: number }

// Normaliza para el match de alias: mayúsculas, sin acentos, espacios colapsados, sin puntuación de borde.
export function normAlias(s: string): string {
  return (s ?? '')
    .normalize('NFD').replace(/[̀-ͯ]/g, '')   // quita acentos
    .toUpperCase().replace(/[^A-Z0-9 ]/g, ' ').replace(/\s+/g, ' ').trim()
}

// STEM: normAlias sin los tokens puramente numéricos. Para consolidar productos de PESO VARIABLE, cuyo peso
// va en el nombre y cambia en cada compra. "QUESO MANCHEGO 1.234 KG" → normAlias "QUESO MANCHEGO 1 234 KG"
// → stem "QUESO MANCHEGO KG". Se usa SOLO para el match de filas peso_variable (opt-in), nunca en general
// (si no, fusionaría "LECHE 1L" con "LECHE 2L", que son productos distintos).
export function stemAlias(s: string): string {
  return normAlias(s).split(' ').filter((t) => t && !/^\d+$/.test(t)).join(' ')
}

const TOOL: Anthropic.Tool = {
  name: 'registrar_ticket',
  description: 'Registra los datos extraídos del ticket de compra.',
  input_schema: {
    type: 'object',
    properties: {
      proveedor: { type: 'string', description: 'Nombre comercial del establecimiento' },
      proveedor_rfc: { type: ['string', 'null'] },
      sucursal: { type: ['string', 'null'] },
      fecha: { type: ['string', 'null'], description: 'YYYY-MM-DD' },
      moneda: { type: 'string' },
      items: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            codigo: { type: ['string', 'null'] },
            descripcion: { type: 'string', description: 'Texto tal como aparece en el ticket, sin traducir' },
            cantidad: { type: ['number', 'null'] },
            unidad: { type: ['string', 'null'] },
            precio_unitario: { type: ['number', 'null'] },
            importe: { type: 'number' },
            es_descuento: { type: 'boolean', description: 'true si la línea es un cupón/descuento (resta)' },
            iva_tasa: { type: ['number', 'null'], description: 'Tasa de IVA de ESTA línea, leída del marcador impreso (letra/código junto al precio): 0 si es exenta o tasa 0% (alimentos básicos), 0.16 si causa 16%. null si NO hay marcador legible o es ambiguo — NUNCA la adivines.' },
            discrepancia: { type: ['string', 'null'], description: 'null si la lectura de la línea es clara. Ponlo SOLO si un dígito está físicamente ilegible/borroso/tapado y tu lectura es incierta; describe qué dígito y tu duda. NO hagas aritmética: no marques nada por "no cuadra la suma" — eso lo verifica el código.' },
          },
          required: ['descripcion', 'importe', 'es_descuento'],
        },
      },
      subtotal: { type: ['number', 'null'] },
      descuento: { type: ['number', 'null'] },
      impuestos: { type: ['number', 'null'] },
      total: { type: ['number', 'null'] },
      articulos_declarados: { type: ['number', 'null'] },
      pago_efectivo: { type: ['number', 'null'], description: 'Monto pagado en EFECTIVO según el desglose de pago del ticket. null si no lo trae/no es legible.' },
      pago_tarjeta: { type: ['number', 'null'], description: 'Monto pagado con TARJETA (crédito/débito) según el desglose de pago del ticket. null si no lo trae/no es legible.' },
      pago_ultimos4: { type: ['string', 'null'], description: 'Últimos 4 dígitos de la tarjeta si aparecen. null si no.' },
      legibilidad: { type: 'string', enum: ['alta', 'media', 'baja'] },
      notas: { type: ['string', 'null'], description: 'campos ilegibles o dudas' },
    },
    required: ['proveedor', 'items', 'total', 'legibilidad'],
  },
}

const SYS = `Eres un extractor de tickets de compra mexicanos (súper, proveedores). Lee la foto y llena la herramienta.
Reglas: transcribe la descripción TAL CUAL aparece (no traduzcas, no expandas abreviaturas). Montos como números en la moneda del ticket.
Si un dígito/campo es ilegible o está tapado, pon null y anótalo en notas — NUNCA inventes. Marca cupones/descuentos con es_descuento=true.
NUNCA "corrijas" ni armonices un número para que cuadre: transcribe SIEMPRE el valor tal como lo lees. NO hagas aritmética ni deduzcas lo que un valor "debería" valer para que la suma cuadre — la reconciliación de sumas la hace el sistema en código, no tú. El campo discrepancia es SOLO para cuando un dígito está físicamente ILEGIBLE (borroso, tapado, cortado) y tu lectura es incierta: descríbelo (ej. "el 3er dígito está borroso, pudo ser 6 u 8"). Si el número se lee claro, discrepancia=null AUNQUE parezca raro o no cuadre con otras líneas. Ajustar un valor en silencio es un error grave que corrompe datos sin hacer ruido.
cantidad y unidad: cantidad = el número de la COLUMNA de cantidad del ticket (cuántas compraste), NO el gramaje/tamaño que viene dentro del NOMBRE. unidad = la unidad de esa cantidad (PZA, KG, G, L, ML). Ej: "BABY BELLA 500 GR" comprando 1 → cantidad=1, unidad=PZA (el "500 GR" es parte del nombre). Si el ticket vende a granel por peso, cantidad = el peso y unidad = KG o G. SIEMPRE llena unidad; si de plano no puedes deducirla, ponla null y anótalo.
IVA por línea: DÓNDE buscar el marcador — casi siempre es una letra o código de impuesto pegado al precio de cada renglón (Costco imprime una letra/código por línea; otras cadenas usan una letra a la derecha del importe). Además, al PIE del ticket suele venir un desglose de IVA: úsalo para cruzar — si el IVA del pie solo cuadra con ciertos renglones, esos son los gravados (0.16) y el resto va a 0. Pon iva_tasa=0 para exento/tasa 0% (alimentos básicos: harina, verdura, queso, huevo) o 0.16 para 16% (bebidas, refrescos, procesados, limpieza, desechables). Pon iva_tasa=null SOLO si de verdad no hay ni marcador por línea ni desglose al pie legibles — no lo adivines.
Método de pago: el ticket trae un desglose de pago al pie (ej. "Efectivo $1,000.00", "Crédito/Débito $574.59", a veces con últimos 4 dígitos). Léelo a los campos pago_efectivo, pago_tarjeta, pago_ultimos4 — NO lo mandes a notas. Si no aparece o no es legible, déjalos null (no adivines).
legibilidad = tu confianza global en la lectura.`

type RawItem = { codigo?: string | null; descripcion: string; cantidad?: number | null; unidad?: string | null; precio_unitario?: number | null; importe: number; es_descuento?: boolean; iva_tasa?: number | null; discrepancia?: string | null }
type RawExtract = {
  proveedor: string; proveedor_rfc?: string | null; sucursal?: string | null; fecha?: string | null; moneda?: string
  items: RawItem[]; subtotal?: number | null; descuento?: number | null; impuestos?: number | null; total?: number | null
  pago_efectivo?: number | null; pago_tarjeta?: number | null; pago_ultimos4?: string | null
  legibilidad?: 'alta' | 'media' | 'baja'; notas?: string | null
}

// Anthropic NO decodifica HEIC/HEIF (el formato por defecto del iPhone). El cliente intenta re-encodar a JPEG
// en un canvas, pero eso solo funciona donde el navegador sabe decodificar HEIC (iOS Safari). Desde Chrome de
// escritorio el .heic llega crudo y la API responde 400 "Could not process image". Detectamos HEIC por
// magic bytes (`....ftyp` + marca heic/heix/mif1/heif/msf1) además del media_type, y lo convertimos a JPEG
// aquí, en el server, para que funcione desde cualquier cliente.
function isHeic(buf: Buffer, mediaType: string): boolean {
  if (/hei[cf]|hevc/i.test(mediaType)) return true
  if (buf.length < 12 || buf.toString('ascii', 4, 8) !== 'ftyp') return false
  return ['heic', 'heix', 'hevc', 'hevx', 'mif1', 'msf1', 'heif'].includes(buf.toString('ascii', 8, 12).toLowerCase())
}

// Normaliza a un formato que Anthropic sí procesa. Devuelve base64 JPEG si la entrada era HEIC; si no, la deja igual.
async function toSupportedImage(imageBase64: string, mediaType: string): Promise<{ data: string; media: 'image/jpeg' | 'image/png' | 'image/webp' | 'image/gif' }> {
  const buf = Buffer.from(imageBase64, 'base64')
  if (isHeic(buf, mediaType)) {
    const convert = (await import('heic-convert')).default
    const out = await convert({ buffer: buf, format: 'JPEG', quality: 0.85 })
    return { data: Buffer.from(out).toString('base64'), media: 'image/jpeg' }
  }
  const media = (['image/jpeg', 'image/png', 'image/webp', 'image/gif'].includes(mediaType) ? mediaType : 'image/jpeg') as 'image/jpeg' | 'image/png' | 'image/webp' | 'image/gif'
  return { data: imageBase64, media }
}

// Llama a Sonnet con la foto y devuelve la extracción cruda (structured output forzado).
async function callModel(imageBase64: string, mediaType: string): Promise<RawExtract> {
  const client = new Anthropic()   // ANTHROPIC_API_KEY del entorno
  const { data, media } = await toSupportedImage(imageBase64, mediaType)
  const res = await client.messages.create({
    model: MODEL, max_tokens: 2000, system: SYS,
    tools: [TOOL], tool_choice: { type: 'tool', name: 'registrar_ticket' },
    messages: [{ role: 'user', content: [
      { type: 'image', source: { type: 'base64', media_type: media, data } },
      { type: 'text', text: 'Extrae este ticket.' },
    ] }],
  })
  const tool = res.content.find((c): c is Anthropic.ToolUseBlock => c.type === 'tool_use')
  if (!tool) throw new Error('la IA no devolvió extracción')
  return tool.input as RawExtract
}

// Aplica los alias APRENDIDOS antes de mostrar el borrador: traduce proveedor y productos a tu versión
// canónica y prellena categoría/unidad. Match exacto por texto normalizado.
async function applyAliases(supabase: SupabaseClient, raw: RawExtract): Promise<TicketDraft> {
  const rawItems = Array.isArray(raw.items) ? raw.items : []   // la IA podría no devolver items; no revientes
  const provNorm = normAlias(raw.proveedor)
  const itemNorms = [...new Set(rawItems.map((i) => normAlias(i.descripcion)))]

  type ProdAliasRow = { raw_norm: string; descripcion: string; categoria: string | null; unidad: string | null; poster_ingredient_id: number | null; factor_a_base: number | null; toca_stock: boolean | null; iva_tasa: number | null; peso_variable: boolean | null }
  const COLS = 'raw_norm, descripcion, categoria, unidad, poster_ingredient_id, factor_a_base, toca_stock, iva_tasa, peso_variable'
  const itemStems = [...new Set(rawItems.map((i) => stemAlias(i.descripcion)).filter(Boolean))]
  const [{ data: supRow }, { data: prodRows }, { data: stemRows }] = await Promise.all([
    supabase.from('ticket_supplier_aliases').select('proveedor, poster_supplier_id').eq('raw_norm', provNorm).is('deleted_at', null).maybeSingle(),
    itemNorms.length
      ? supabase.from('ticket_product_aliases').select(COLS).is('deleted_at', null).in('raw_norm', itemNorms)
      : Promise.resolve({ data: [] as ProdAliasRow[] }),
    // Peso variable: el texto (con el peso) cambia cada compra, así que el raw_norm exacto falla. Además busca
    // por STEM (sin el número) entre las filas marcadas peso_variable → todas las compras caen en la misma.
    itemStems.length
      ? supabase.from('ticket_product_aliases').select(`${COLS}, raw_stem`).eq('peso_variable', true).is('deleted_at', null).in('raw_stem', itemStems)
      : Promise.resolve({ data: [] as (ProdAliasRow & { raw_stem: string })[] }),
  ])
  const prodMap = new Map((prodRows ?? []).map((r) => [r.raw_norm, r as ProdAliasRow]))
  const stemMap = new Map(((stemRows ?? []) as (ProdAliasRow & { raw_stem: string })[]).map((r) => [r.raw_stem, r]))

  const items: TicketItem[] = rawItems.map((i) => {
    // Match exacto primero; si falla, match por stem SOLO contra filas peso_variable.
    const alias = prodMap.get(normAlias(i.descripcion)) ?? stemMap.get(stemAlias(i.descripcion))
    return {
      codigo: i.codigo ?? null,
      descripcion: alias?.descripcion ?? i.descripcion,
      descripcion_raw: i.descripcion,
      cantidad: i.cantidad ?? null,
      unidad: alias?.unidad ?? i.unidad ?? null,
      precio_unitario: i.precio_unitario ?? null,
      importe: Number(i.importe ?? 0),
      es_descuento: !!i.es_descuento,
      categoria: alias?.categoria ?? null,
      aliased: !!alias,
      posterIngredientId: alias?.poster_ingredient_id ?? null,
      factorABase: alias?.factor_a_base ?? null,
      tocaStock: alias?.toca_stock ?? true,
      // Tasa de la línea leída del ticket; si la IA no la pudo leer, cae al default aprendido del alias; si tampoco, null.
      ivaTasa: i.iva_tasa ?? alias?.iva_tasa ?? null,
      pesoVariable: !!alias?.peso_variable,
      discrepancia: i.discrepancia ?? null,
    }
  })

  return {
    proveedor: supRow?.proveedor ?? raw.proveedor,
    proveedor_raw: raw.proveedor,
    proveedor_rfc: raw.proveedor_rfc ?? null,
    sucursal: raw.sucursal ?? null,
    fecha: raw.fecha ?? null,
    moneda: raw.moneda ?? 'MXN',
    subtotal: raw.subtotal ?? null,
    descuento: raw.descuento ?? null,
    impuestos: raw.impuestos ?? null,
    total: raw.total ?? null,
    legibilidad: raw.legibilidad ?? 'media',
    notas: raw.notas ?? null,
    items,
    proveedorAliased: !!supRow,
    posterSupplierId: supRow?.poster_supplier_id ?? null,
    pagoEfectivo: raw.pago_efectivo ?? null,
    pagoTarjeta: raw.pago_tarjeta ?? null,
    pagoUltimos4: raw.pago_ultimos4 ?? null,
  }
}

// Borrador SIN alias (fallback): mapea raw→draft sin tocar la base. Robusto ante items mal formado.
function rawDraft(raw: RawExtract): TicketDraft {
  const items: TicketItem[] = (Array.isArray(raw.items) ? raw.items : []).map((i) => ({
    codigo: i.codigo ?? null, descripcion: i.descripcion, descripcion_raw: i.descripcion,
    cantidad: i.cantidad ?? null, unidad: i.unidad ?? null, precio_unitario: i.precio_unitario ?? null,
    importe: Number(i.importe ?? 0), es_descuento: !!i.es_descuento, categoria: null, aliased: false,
    posterIngredientId: null, factorABase: null, tocaStock: true, ivaTasa: i.iva_tasa ?? null,
    pesoVariable: false, discrepancia: i.discrepancia ?? null,
  }))
  return {
    proveedor: raw.proveedor, proveedor_raw: raw.proveedor, proveedor_rfc: raw.proveedor_rfc ?? null,
    sucursal: raw.sucursal ?? null, fecha: raw.fecha ?? null, moneda: raw.moneda ?? 'MXN',
    subtotal: raw.subtotal ?? null, descuento: raw.descuento ?? null, impuestos: raw.impuestos ?? null,
    total: raw.total ?? null, legibilidad: raw.legibilidad ?? 'media', notas: raw.notas ?? null, items,
    proveedorAliased: false, posterSupplierId: null,
    pagoEfectivo: raw.pago_efectivo ?? null, pagoTarjeta: raw.pago_tarjeta ?? null, pagoUltimos4: raw.pago_ultimos4 ?? null,
  }
}

export async function extractTicket(supabase: SupabaseClient, imageBase64: string, mediaType: string): Promise<ExtractResult> {
  if (!process.env.ANTHROPIC_API_KEY) return { ok: false, error: 'ANTHROPIC_API_KEY no configurado', status: 400 }
  let raw: RawExtract
  try { raw = await callModel(imageBase64, mediaType) }
  catch (e) { return { ok: false, error: `extracción falló: ${e instanceof Error ? e.message : String(e)}`, status: 502 } }
  // applyAliases va en su PROPIO try: si la extracción (cara) ya salió bien, un tropiezo aplicando alias NO
  // debe tirar todo. Cae a un borrador sin alias (raw), que el humano igual puede confirmar/corregir.
  try {
    const draft = await applyAliases(supabase, raw)
    return { ok: true, model: MODEL, raw, draft }
  } catch (e) {
    return { ok: true, model: MODEL, raw, draft: rawDraft(raw), aliasWarning: e instanceof Error ? e.message : String(e) }
  }
}
