import Anthropic from '@anthropic-ai/sdk'
import { getOpenAI } from '@/lib/openai'

// --- Domain constants --------------------------------------------------------

export const URGENCIES = ['today', 'this_week', 'this_month', 'someday'] as const
export type Urgency = (typeof URGENCIES)[number]

export const KINDS = ['task', 'reminder', 'log', 'note', 'idea', 'contact'] as const
export type Kind = (typeof KINDS)[number]

/** Kinds that become rows in `tasks`; everything else becomes a `daily_logs` row. */
const TASK_KINDS = new Set<Kind>(['task', 'reminder'])
export function isTaskKind(kind: Kind): boolean {
  return TASK_KINDS.has(kind)
}

export function isContactKind(kind: Kind): boolean {
  return kind === 'contact'
}

/** The user's entities. `entity_id` here is a stable slug, resolved to a UUID downstream. */
export const ENTITIES = [
  { slug: 'barbajan', name: 'Barbaján', type: 'barbershop', keywords: ['barbaj', 'barber', 'haircut', 'fade', 'clipper'] },
  { slug: 'publico_gourmet', name: 'Público Gourmet', type: 'pizzeria', keywords: ['publico', 'público', 'pizza', 'pizzeria', 'dough', 'oven'] },
  { slug: 'zozoaga_roasters', name: 'Zozoaga Roasters', type: 'coffee', keywords: ['zozoaga', 'roaster', 'coffee', 'beans', 'espresso', 'roast'] },
  { slug: 'east_garden', name: 'The East Garden', type: 'yoga', keywords: ['east garden', 'yoga', 'studio', 'mat', 'instructor', 'class'] },
  { slug: 'uptown', name: 'Uptown', type: 'property', keywords: ['uptown', 'property', 'tenant', 'rent', 'lease', 'apartment', 'unit'] },
  { slug: 'freelance', name: 'Freelance', type: 'freelance', keywords: ['freelance', 'client', 'invoice', 'contract', 'gig', 'proposal'] },
  { slug: 'personal', name: 'Personal', type: 'personal', keywords: ['personal', 'home', 'family', 'gym', 'doctor'] },
] as const

export type EntitySlug = (typeof ENTITIES)[number]['slug']
const ENTITY_SLUGS = ENTITIES.map((e) => e.slug)

// --- Contact categories ------------------------------------------------------

export const CONTACT_CATEGORIES = [
  'Familia',
  'Círculo cercano',
  'Círculo extendido',
  'Proveedores',
  'Clientes',
  'Enemigos',
] as const
export type ContactCategory = (typeof CONTACT_CATEGORIES)[number]

export type ContactFields = {
  /** Person's full name, or null if not extracted. */
  name: string | null
  /** Relationship category. Default to "Círculo extendido" when ambiguous. */
  category: ContactCategory | null
  /** YYYY-MM-DD. Use 1900 as the year when only day+month are mentioned. Null if not mentioned. */
  birthday: string | null
  /** Free-form context, interests, or anything else worth remembering. */
  notes: string | null
  /** Where they work or how the user knows them. */
  company: string | null
}

// --- Classification result ---------------------------------------------------

export type CaptureClassification = {
  kind: Kind
  urgency: Urgency
  /** Entity slug, or null if none clearly applies. */
  entity_id: EntitySlug | null
  tags: string[]
  summary: string
  /** Populated when kind === 'contact'; all-null otherwise. */
  contact_fields: ContactFields
}

export type ClassifyResult = CaptureClassification & {
  /** Which classifier produced the result — useful for auditing. */
  via: 'claude' | 'openai' | 'regex'
}

// --- Prompt + schema shared by the LLM classifiers ---------------------------

const ENTITY_GUIDE = ENTITIES.map((e) => `- "${e.slug}": ${e.name} (${e.type})`).join('\n')

const CONTACT_CATEGORY_GUIDE = `
  - "Familia": hermano/a, papá, mamá, tío/a, primo/a, family
  - "Círculo cercano": amigo cercano, mejor amigo, socio/a, pareja, confidente
  - "Círculo extendido": conocido, colega, contacto de trabajo, acquaintance
  - "Proveedores": proveedor, supplier, vendedor, quien provee un servicio
  - "Clientes": cliente, customer, quien compra o contrata
  - "Enemigos": rival, enemigo, conflicto abierto`

const SYSTEM_PROMPT = `You triage short personal captures (typed or transcribed from voice) into a structured record. Messages may be in Spanish or English.

Classify each capture:
- kind:
  • "task" or "reminder" — actionable items to do
  • "log" — things that already happened
  • "note" — reference information
  • "idea" — thoughts or proposals
  • "contact" — adding or saving a person (triggered by phrases like "agrega a", "guarda contacto", "nuevo contacto", "add contact", mentioning a person's name + category or birthday)
- urgency: "today", "this_week", "this_month", or "someday". Infer from time cues ("tonight", "by Friday", "next month"). Default to "someday" when there is no signal.
- entity_id: which business/area this belongs to, by slug, or null if none clearly applies:
${ENTITY_GUIDE}
- tags: 0-5 short lowercase keyword tags.
- summary: one concise sentence (<= 140 chars) describing the capture.
- contact_fields: ALWAYS include this object. When kind is "contact", extract:
  • name: person's full name
  • category: one of the following (infer from relationship words):${CONTACT_CATEGORY_GUIDE}
  • birthday: YYYY-MM-DD. If only month+day mentioned, use 1900 as year (e.g. "15 de marzo" → "1900-03-15"). Null if not mentioned.
  • notes: any additional context, relationship details, or information
  • company: where they work or how the user knows them; null if not mentioned
  When kind is NOT "contact", set all contact_fields values to null.`

const JSON_SCHEMA = {
  type: 'object',
  properties: {
    kind:      { type: 'string', enum: [...KINDS] },
    urgency:   { type: 'string', enum: [...URGENCIES] },
    entity_id: {
      anyOf: [{ type: 'string', enum: [...ENTITY_SLUGS] }, { type: 'null' }],
    },
    tags:    { type: 'array', items: { type: 'string' } },
    summary: { type: 'string' },
    contact_fields: {
      type: 'object',
      properties: {
        name:     { anyOf: [{ type: 'string' }, { type: 'null' }] },
        category: { anyOf: [{ type: 'string', enum: [...CONTACT_CATEGORIES] }, { type: 'null' }] },
        birthday: { anyOf: [{ type: 'string' }, { type: 'null' }] },
        notes:    { anyOf: [{ type: 'string' }, { type: 'null' }] },
        company:  { anyOf: [{ type: 'string' }, { type: 'null' }] },
      },
      required: ['name', 'category', 'birthday', 'notes', 'company'],
      additionalProperties: false,
    },
  },
  required: ['kind', 'urgency', 'entity_id', 'tags', 'summary', 'contact_fields'],
  additionalProperties: false,
} as const

// --- Normalisation -----------------------------------------------------------

function nullContactFields(): ContactFields {
  return { name: null, category: null, birthday: null, notes: null, company: null }
}

function normalizeContactFields(obj: Record<string, unknown>, kind: Kind): ContactFields {
  if (kind !== 'contact') return nullContactFields()
  const cf =
    typeof obj.contact_fields === 'object' && obj.contact_fields !== null
      ? (obj.contact_fields as Record<string, unknown>)
      : {}
  return {
    name:     typeof cf.name     === 'string' ? cf.name.trim()    || null : null,
    category: CONTACT_CATEGORIES.includes(cf.category as ContactCategory)
      ? (cf.category as ContactCategory)
      : 'Círculo extendido',
    birthday: typeof cf.birthday === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(cf.birthday)
      ? cf.birthday
      : null,
    notes:    typeof cf.notes    === 'string' ? cf.notes.trim()   || null : null,
    company:  typeof cf.company  === 'string' ? cf.company.trim() || null : null,
  }
}

function normalize(raw: unknown, text: string): CaptureClassification {
  const obj = (raw ?? {}) as Record<string, unknown>
  const kind     = KINDS.includes(obj.kind as Kind) ? (obj.kind as Kind) : 'note'
  const urgency  = URGENCIES.includes(obj.urgency as Urgency) ? (obj.urgency as Urgency) : 'someday'
  const entity_id = ENTITY_SLUGS.includes(obj.entity_id as EntitySlug) ? (obj.entity_id as EntitySlug) : null
  const tags = Array.isArray(obj.tags)
    ? obj.tags.filter((t): t is string => typeof t === 'string').slice(0, 5)
    : []
  const summary =
    typeof obj.summary === 'string' && obj.summary.trim()
      ? obj.summary.trim().slice(0, 140)
      : text.slice(0, 140)
  const contact_fields = normalizeContactFields(obj, kind)
  return { kind, urgency, entity_id, tags, summary, contact_fields }
}

// --- Tier 1: Claude ----------------------------------------------------------

async function classifyWithClaude(text: string): Promise<CaptureClassification> {
  if (!process.env.ANTHROPIC_API_KEY) throw new Error('ANTHROPIC_API_KEY not set')
  const client = new Anthropic()
  const response = await client.messages.create({
    model: process.env.ANTHROPIC_MODEL ?? 'claude-opus-4-8',
    max_tokens: 1024,
    system: SYSTEM_PROMPT,
    output_config: {
      effort: 'low',
      format: { type: 'json_schema', schema: JSON_SCHEMA },
    },
    messages: [{ role: 'user', content: text }],
  })
  const block = response.content.find((b) => b.type === 'text')
  if (!block || block.type !== 'text') throw new Error('Claude returned no text block')
  return normalize(JSON.parse(block.text), text)
}

// --- Tier 2: OpenAI ----------------------------------------------------------

async function classifyWithOpenAI(text: string): Promise<CaptureClassification> {
  const response = await getOpenAI().chat.completions.create({
    model: 'gpt-4o-mini',
    messages: [
      { role: 'system', content: SYSTEM_PROMPT },
      { role: 'user', content: text },
    ],
    response_format: {
      type: 'json_schema',
      json_schema: { name: 'capture', strict: true, schema: JSON_SCHEMA },
    },
  })
  const content = response.choices[0]?.message?.content
  if (!content) throw new Error('OpenAI returned no content')
  return normalize(JSON.parse(content), text)
}

// --- Tier 3: regex -----------------------------------------------------------

function classifyWithRegex(text: string): CaptureClassification {
  const lower = text.toLowerCase()

  // Detect contact intent before anything else.
  const isContact =
    /\b(agrega(r)?|guarda(r)?)\s+(a|contacto|al?)\b/i.test(text) ||
    /\b(nuevo|nueva)\s+contacto\b/i.test(text) ||
    /\badd\s+contact\b/i.test(text) ||
    /\bcontacto:/i.test(text)

  if (isContact) {
    // Infer category from keywords.
    let category: ContactCategory = 'Círculo extendido'
    if (/\b(familia|hermano|hermana|papá|mamá|papa|mama|primo|prima|tío|tía)\b/i.test(text)) category = 'Familia'
    else if (/\b(amigo|amiga|cercano|cercana|socio|socia|mejor amigo)\b/i.test(text)) category = 'Círculo cercano'
    else if (/\b(proveedor|proveedora|supplier|vendedor)\b/i.test(text)) category = 'Proveedores'
    else if (/\b(cliente|customer)\b/i.test(text)) category = 'Clientes'
    else if (/\b(enemigo|rival)\b/i.test(text)) category = 'Enemigos'

    return {
      kind:     'contact',
      urgency:  'someday',
      entity_id: null,
      tags:     ['contacto'],
      summary:  text.slice(0, 140),
      contact_fields: {
        name:     null,
        category,
        birthday: null,
        notes:    text.slice(0, 1000) || null,
        company:  null,
      },
    }
  }

  const entity = ENTITIES.find((e) => e.keywords.some((k) => lower.includes(k)))

  let urgency: Urgency = 'someday'
  if (/\b(today|tonight|now|asap|urgent|immediately)\b/.test(lower)) urgency = 'today'
  else if (/\b(tomorrow|this week|by (mon|tue|wed|thu|fri|sat|sun))/.test(lower)) urgency = 'this_week'
  else if (/\b(this month|next week|end of month)\b/.test(lower)) urgency = 'this_month'

  const isTask =
    /\b(remind|don'?t forget|need to|have to|must|todo|to-?do|task|buy|call|email|schedule|book|fix|send|finish|pay|order|follow up)\b/.test(
      lower
    )
  const kind: Kind = /\bremind|don'?t forget\b/.test(lower)
    ? 'reminder'
    : isTask
      ? 'task'
      : 'note'

  return {
    kind,
    urgency,
    entity_id: entity?.slug ?? null,
    tags: [],
    summary: text.slice(0, 140),
    contact_fields: nullContactFields(),
  }
}

// --- Orchestrator ------------------------------------------------------------

export async function classifyCapture(text: string): Promise<ClassifyResult> {
  try {
    return { ...(await classifyWithClaude(text)), via: 'claude' }
  } catch (claudeErr) {
    console.warn('classifyCapture: Claude failed, falling back to OpenAI', claudeErr)
    try {
      return { ...(await classifyWithOpenAI(text)), via: 'openai' }
    } catch (openaiErr) {
      console.warn('classifyCapture: OpenAI failed, falling back to regex', openaiErr)
      return { ...classifyWithRegex(text), via: 'regex' }
    }
  }
}
