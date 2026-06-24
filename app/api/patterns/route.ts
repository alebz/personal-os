import type { NextRequest } from 'next/server'
import { NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import { createServerClient } from '@/lib/supabase'

export const runtime = 'nodejs'

const SYSTEM_PROMPT = `Eres el motor de detección de patrones de Cerebro — la mente analítica de Alex.

Tu tarea es identificar patrones significativos, no obvios y accionables en los datos de vida de Alex.

REGLAS:
- NO resumas información. DETECTA patrones, tendencias y correlaciones entre dominios.
- Los mejores insights cruzan dominios (ej: hábitos ↔ productividad, creatividad ↔ bienestar).
- Sé específico: menciona detalles reales del corpus cuando refuercen el patrón.
- Prioriza lo que Alex probablemente no ha notado por sí mismo.
- Genera entre 4 y 7 insights, ordenados de mayor a menor relevancia.
- Ajusta la confianza según la cantidad y consistencia de evidencia en el corpus.

CATEGORÍAS:
- "energy"       → productividad, estado de ánimo, energía física o mental
- "creative"     → trabajo creativo, proyectos, ideas, arte, branding
- "relationship" → relaciones, colaboraciones, personas recurrentes
- "financial"    → gastos, ingresos, compromisos económicos
- "recurring"    → temas, lugares, conceptos que aparecen con frecuencia
- "behavioral"   → hábitos, rutinas, ciclos de comportamiento

Responde ÚNICAMENTE con JSON válido, sin texto adicional:
{
  "insights": [
    {
      "category": "energy|creative|relationship|financial|recurring|behavioral",
      "title": "Título conciso (máx. 8 palabras)",
      "insight": "Descripción del patrón en 2-3 oraciones. Cita ejemplos concretos del corpus.",
      "confidence": <0-100>,
      "evidence": [
        { "type": "journal|task|habit|note|contact|log|idea", "count": <número>, "label": "descripción breve" }
      ]
    }
  ],
  "summary": "Síntesis de 1-2 oraciones sobre lo más significativo que revelan los datos."
}`

// Per-kind entry caps — prevents any single category from dominating the prompt
const PER_KIND_CAP: Record<string, number> = {
  journal:  60,
  task:     60,
  habit:    40,
  note:     30,
  contact:  25,
  idea:     25,
  log:      20,
  reminder: 15,
}

function truncate(s: string, max = 220): string {
  return s.length > max ? s.slice(0, max) + '…' : s
}

function buildCorpus(
  grouped: Record<string, { content: string; created_at: string }[]>
): string {
  return Object.entries(grouped)
    .map(([kind, entries]) => {
      const cap  = PER_KIND_CAP[kind] ?? 20
      const rows = entries
        .slice(0, cap)
        .map(e => `[${e.created_at.slice(0, 10)}] ${truncate(e.content)}`)
        .join('\n')
      return `## ${kind.toUpperCase()} (${entries.length} total)\n${rows}`
    })
    .join('\n\n')
}

export async function POST(req: NextRequest) {
  let body: { focus?: string }
  try { body = await req.json() } catch { body = {} }

  const supabase = createServerClient()

  // Broad temporal scan — no embedding needed, we want everything
  const { data, error } = await supabase
    .from('memory_chunks')
    .select('content, metadata, created_at')
    .order('created_at', { ascending: false })
    .limit(400)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // Group by metadata.kind
  const grouped: Record<string, { content: string; created_at: string }[]> = {}
  for (const row of (data ?? [])) {
    const kind = String((row.metadata as Record<string, unknown>)?.kind ?? 'nota')
    ;(grouped[kind] ??= []).push({ content: row.content, created_at: row.created_at })
  }

  const analyzed = {
    total:  data?.length ?? 0,
    byKind: Object.fromEntries(Object.entries(grouped).map(([k, v]) => [k, v.length])),
  }

  const focusLine = body.focus?.trim()
    ? `Área de enfoque: ${body.focus.trim()}\n\n`
    : ''

  const corpus = buildCorpus(grouped)

  const anthropic = new Anthropic()
  const msg = await anthropic.messages.create({
    model:      process.env.ANTHROPIC_MODEL ?? 'claude-sonnet-4-6',
    max_tokens: 2048,
    system:     SYSTEM_PROMPT,
    messages: [
      {
        role:    'user',
        content: `${focusLine}CORPUS:\n\n${corpus}`,
      },
    ],
  })

  const raw      = msg.content.find(b => b.type === 'text')?.text ?? '{}'
  const jsonText = raw.replace(/^```(?:json)?\n?/, '').replace(/\n?```$/, '').trim()

  let result
  try {
    result = JSON.parse(jsonText)
  } catch {
    return NextResponse.json({ error: 'Failed to parse analysis', raw }, { status: 500 })
  }

  return NextResponse.json({ ...result, analyzed })
}
