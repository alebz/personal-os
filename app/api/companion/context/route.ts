import { NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase'

export const runtime = 'nodejs'

// GET /api/companion/context
// Returns a plain-text OS context summary for the Adán companion preamble.
export async function GET() {
  const supabase = createServerClient()
  const today = new Date().toISOString().split('T')[0]
  const lines: string[] = [`Fecha: ${today}`]

  // ── Habits ────────────────────────────────────────────────────────────────
  try {
    const { data } = await supabase
      .from('daily_logs')
      .select('metadata')
      .eq('kind', 'habits')
      .eq('log_date', today)
      .maybeSingle()

    const habits = (data?.metadata as { habits?: { done?: string[]; total?: number } } | null)
      ?.habits
    if (habits) {
      const done = habits.done ?? []
      const total = habits.total ?? 0
      lines.push(
        `Hábitos hoy: ${done.length}/${total} completados${done.length ? ` (${done.join(', ')})` : ''}`,
      )
    }
  } catch {
    /* ignore */
  }

  // ── Goals ─────────────────────────────────────────────────────────────────
  try {
    const SENTINEL = '2000-01-01'
    const { data } = await supabase
      .from('daily_logs')
      .select('metadata')
      .eq('kind', 'goals')
      .eq('log_date', SENTINEL)
      .maybeSingle()

    const meta = data?.metadata as {
      goals_week?: { text: string; done: boolean }[]
      goals_month?: { text: string; done: boolean }[]
    } | null

    const week = meta?.goals_week ?? []
    const month = meta?.goals_month ?? []

    if (week.length) {
      const doneW = week.filter((g) => g.done).map((g) => g.text)
      const pendW = week.filter((g) => !g.done).map((g) => g.text)
      lines.push(`Metas semanales: ${doneW.length}/${week.length} hechas`)
      if (pendW.length) lines.push(`  Pendientes: ${pendW.slice(0, 3).join(', ')}`)
    }
    if (month.length) {
      const pendM = month.filter((g) => !g.done).map((g) => g.text)
      lines.push(`Metas mensuales: ${month.filter((g) => g.done).length}/${month.length} hechas`)
      if (pendM.length) lines.push(`  Pendientes: ${pendM.slice(0, 2).join(', ')}`)
    }
  } catch {
    /* ignore */
  }

  // ── Tasks ─────────────────────────────────────────────────────────────────
  try {
    const { data } = await supabase
      .from('tasks')
      .select('title, urgency, priority_score')
      .is('completed_at', null)
      .order('priority_score', { ascending: false, nullsFirst: false })
      .limit(5)

    if (data?.length) {
      lines.push(`Tareas abiertas (top ${data.length}): ${data.map((t) => `"${t.title}"`).join(', ')}`)
    }
  } catch {
    /* ignore */
  }

  // ── Finance balance ───────────────────────────────────────────────────────
  try {
    const { data } = await supabase
      .from('finance_balance')
      .select('tarjeta, efectivo, caja_fuerte')
      .order('updated_at', { ascending: false })
      .limit(1)
      .maybeSingle()

    if (data) {
      const total = (data.tarjeta ?? 0) + (data.efectivo ?? 0) + (data.caja_fuerte ?? 0)
      lines.push(`Balance total: $${total.toLocaleString('es-MX')}`)
    }
  } catch {
    /* ignore */
  }

  return NextResponse.json({ context: lines.join('\n') })
}
