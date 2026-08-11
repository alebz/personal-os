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
}
export type ExtractResult = { ok: true; model: string; raw: unknown; draft: TicketDraft } | { ok: false; error: string; status: number }

// Normaliza para el match de alias: mayúsculas, sin acentos, espacios colapsados, sin puntuación de borde.
export function normAlias(s: string): string {
  return (s ?? '')
    .normalize('NFD').replace(/[̀-ͯ]/g, '')   // quita acentos
    .toUpperCase().replace(/[^A-Z0-9 ]/g, ' ').replace(/\s+/g, ' ').trim()
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
          },
          required: ['descripcion', 'importe', 'es_descuento'],
        },
      },
      subtotal: { type: ['number', 'null'] },
      descuento: { type: ['number', 'null'] },
      impuestos: { type: ['number', 'null'] },
      total: { type: ['number', 'null'] },
      articulos_declarados: { type: ['number', 'null'] },
      legibilidad: { type: 'string', enum: ['alta', 'media', 'baja'] },
      notas: { type: ['string', 'null'], description: 'campos ilegibles o dudas' },
    },
    required: ['proveedor', 'items', 'total', 'legibilidad'],
  },
}

const SYS = `Eres un extractor de tickets de compra mexicanos (súper, proveedores). Lee la foto y llena la herramienta.
Reglas: transcribe la descripción TAL CUAL aparece (no traduzcas, no expandas abreviaturas). Montos como números en la moneda del ticket.
Si un dígito/campo es ilegible o está tapado, pon null y anótalo en notas — NUNCA inventes. Marca cupones/descuentos con es_descuento=true.
legibilidad = tu confianza global en la lectura.`

type RawItem = { codigo?: string | null; descripcion: string; cantidad?: number | null; unidad?: string | null; precio_unitario?: number | null; importe: number; es_descuento?: boolean }
type RawExtract = {
  proveedor: string; proveedor_rfc?: string | null; sucursal?: string | null; fecha?: string | null; moneda?: string
  items: RawItem[]; subtotal?: number | null; descuento?: number | null; impuestos?: number | null; total?: number | null
  legibilidad?: 'alta' | 'media' | 'baja'; notas?: string | null
}

// Llama a Sonnet con la foto y devuelve la extracción cruda (structured output forzado).
async function callModel(imageBase64: string, mediaType: string): Promise<RawExtract> {
  const client = new Anthropic()   // ANTHROPIC_API_KEY del entorno
  const media = (['image/jpeg', 'image/png', 'image/webp', 'image/gif'].includes(mediaType) ? mediaType : 'image/jpeg') as 'image/jpeg' | 'image/png' | 'image/webp' | 'image/gif'
  const res = await client.messages.create({
    model: MODEL, max_tokens: 2000, system: SYS,
    tools: [TOOL], tool_choice: { type: 'tool', name: 'registrar_ticket' },
    messages: [{ role: 'user', content: [
      { type: 'image', source: { type: 'base64', media_type: media, data: imageBase64 } },
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
  const provNorm = normAlias(raw.proveedor)
  const itemNorms = [...new Set(raw.items.map((i) => normAlias(i.descripcion)))]

  const [{ data: supRow }, { data: prodRows }] = await Promise.all([
    supabase.from('ticket_supplier_aliases').select('proveedor').eq('raw_norm', provNorm).maybeSingle(),
    itemNorms.length
      ? supabase.from('ticket_product_aliases').select('raw_norm, descripcion, categoria, unidad').in('raw_norm', itemNorms)
      : Promise.resolve({ data: [] as Array<{ raw_norm: string; descripcion: string; categoria: string | null; unidad: string | null }> }),
  ])
  const prodMap = new Map((prodRows ?? []).map((r) => [r.raw_norm, r]))

  const items: TicketItem[] = raw.items.map((i) => {
    const alias = prodMap.get(normAlias(i.descripcion))
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
  }
}

export async function extractTicket(supabase: SupabaseClient, imageBase64: string, mediaType: string): Promise<ExtractResult> {
  if (!process.env.ANTHROPIC_API_KEY) return { ok: false, error: 'ANTHROPIC_API_KEY no configurado', status: 400 }
  let raw: RawExtract
  try { raw = await callModel(imageBase64, mediaType) }
  catch (e) { return { ok: false, error: `extracción falló: ${e instanceof Error ? e.message : String(e)}`, status: 502 } }
  const draft = await applyAliases(supabase, raw)
  return { ok: true, model: MODEL, raw, draft }
}
