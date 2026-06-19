import Anthropic from '@anthropic-ai/sdk'
import { getOpenAI } from '@/lib/openai'

// --- Domain constants --------------------------------------------------------

export const URGENCIES = ['today', 'this_week', 'this_month', 'someday'] as const
export type Urgency = (typeof URGENCIES)[number]

export const KINDS = ['task', 'reminder', 'log', 'note', 'idea'] as const
export type Kind = (typeof KINDS)[number]

/** Kinds that become rows in `tasks`; everything else becomes a `daily_logs` row. */
const TASK_KINDS = new Set<Kind>(['task', 'reminder'])
export function isTaskKind(kind: Kind): boolean {
  return TASK_KINDS.has(kind)
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

export type CaptureClassification = {
  kind: Kind
  urgency: Urgency
  /** Entity slug, or null if none clearly applies. */
  entity_id: EntitySlug | null
  tags: string[]
  summary: string
}

export type ClassifyResult = CaptureClassification & {
  /** Which classifier produced the result — useful for auditing. */
  via: 'claude' | 'openai' | 'regex'
}

// --- Prompt + schema shared by the LLM classifiers ---------------------------

const ENTITY_GUIDE = ENTITIES.map((e) => `- "${e.slug}": ${e.name} (${e.type})`).join('\n')

const SYSTEM_PROMPT = `You triage short personal captures (typed or transcribed from voice) into a structured record.

Classify each capture:
- kind: "task" or "reminder" for actionable items; "log" for things that happened; "note" for reference info; "idea" for thoughts/proposals.
- urgency: "today", "this_week", "this_month", or "someday". Infer from time cues ("tonight", "by Friday", "next month"). Default to "someday" when there is no signal.
- entity_id: which business/area this belongs to, by slug, or null if none clearly applies:
${ENTITY_GUIDE}
- tags: 0-5 short lowercase keyword tags.
- summary: one concise sentence (<= 140 chars) describing the capture.`

const JSON_SCHEMA = {
  type: 'object',
  properties: {
    kind: { type: 'string', enum: [...KINDS] },
    urgency: { type: 'string', enum: [...URGENCIES] },
    entity_id: {
      anyOf: [{ type: 'string', enum: [...ENTITY_SLUGS] }, { type: 'null' }],
    },
    tags: { type: 'array', items: { type: 'string' } },
    summary: { type: 'string' },
  },
  required: ['kind', 'urgency', 'entity_id', 'tags', 'summary'],
  additionalProperties: false,
} as const

// --- Normalisation -----------------------------------------------------------

function normalize(raw: unknown, text: string): CaptureClassification {
  const obj = (raw ?? {}) as Record<string, unknown>
  const kind = KINDS.includes(obj.kind as Kind) ? (obj.kind as Kind) : 'note'
  const urgency = URGENCIES.includes(obj.urgency as Urgency)
    ? (obj.urgency as Urgency)
    : 'someday'
  const entity_id = ENTITY_SLUGS.includes(obj.entity_id as EntitySlug)
    ? (obj.entity_id as EntitySlug)
    : null
  const tags = Array.isArray(obj.tags)
    ? obj.tags.filter((t): t is string => typeof t === 'string').slice(0, 5)
    : []
  const summary =
    typeof obj.summary === 'string' && obj.summary.trim()
      ? obj.summary.trim().slice(0, 140)
      : text.slice(0, 140)
  return { kind, urgency, entity_id, tags, summary }
}

// --- Tier 1: Claude ----------------------------------------------------------

async function classifyWithClaude(text: string): Promise<CaptureClassification> {
  if (!process.env.ANTHROPIC_API_KEY) throw new Error('ANTHROPIC_API_KEY not set')
  const client = new Anthropic()
  const response = await client.messages.create({
    model: 'claude-opus-4-8',
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
