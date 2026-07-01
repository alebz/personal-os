import { NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase'

export interface DayPoint { date: string; balance: number }

export async function GET() {
  const supabase = createServerClient()

  const todayLocal = new Date().toLocaleDateString('en-CA', { timeZone: 'America/Mexico_City' })

  // ── ALX: personal finance — 30-day daily balance sparkline ───────────────

  const days: string[] = []
  const anchor = new Date(todayLocal + 'T12:00:00')
  for (let i = 29; i >= 0; i--) {
    const d = new Date(anchor)
    d.setDate(d.getDate() - i)
    days.push(d.toISOString().slice(0, 10))
  }

  const [balRes, movsRes] = await Promise.all([
    supabase
      .from('finance_balance')
      .select('tarjeta, efectivo, caja_fuerte')
      .order('updated_at', { ascending: false })
      .limit(1)
      .maybeSingle(),
    supabase
      .from('finance_movements')
      .select('date, amount, flow')
      .gte('date', days[0])
      .lte('date', days[days.length - 1])
      .order('date', { ascending: false })
      .order('created_at', { ascending: false }),
  ])

  const currentTotal =
    Number(balRes.data?.tarjeta    ?? 0) +
    Number(balRes.data?.efectivo   ?? 0) +
    Number(balRes.data?.caja_fuerte ?? 0)

  // Group movements by date
  const byDate: Record<string, Array<{ amount: number; flow: string }>> = {}
  for (const m of (movsRes.data ?? []) as Array<{ date: string; amount: number; flow: string }>) {
    const key = String(m.date)
    ;(byDate[key] ??= []).push({ amount: Number(m.amount), flow: m.flow })
  }

  // Reconstruct daily balances backwards from today's known balance
  let running = currentTotal
  const alxRev: DayPoint[] = []
  for (let i = days.length - 1; i >= 0; i--) {
    alxRev.push({ date: days[i], balance: Math.round(running) })
    for (const m of byDate[days[i]] ?? []) {
      running = m.flow === 'in' ? running - m.amount : running + m.amount
    }
  }
  const alx = alxRev.reverse()

  // ── UPT: Uptown — 6-month monthly net sparkline ──────────────────────────

  const months: string[] = []
  const now = new Date(anchor)
  for (let i = 5; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1)
    months.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`)
  }

  const [rentsR, expR, nomR, xIncR, xExpR] = await Promise.all([
    supabase.from('uptown_rents').select('month, amount, paid').in('month', months),
    supabase.from('uptown_fixed_expenses').select('month, amount, paid').in('month', months),
    supabase.from('uptown_nomina').select('month, amount, paid').in('month', months),
    supabase.from('uptown_extra_income').select('month, amount').in('month', months),
    supabase.from('uptown_extra_expenses').select('month, amount').in('month', months),
  ])

  type PaidRow = { month: string; amount: number; paid: boolean }
  type FreeRow = { month: string; amount: number }

  const paidSum = (rows: PaidRow[], month: string) =>
    rows.filter(r => r.month === month && r.paid).reduce((s, r) => s + Number(r.amount), 0)
  const allSum  = (rows: FreeRow[], month: string) =>
    rows.filter(r => r.month === month).reduce((s, r) => s + Number(r.amount), 0)

  const upt: DayPoint[] = months.map(month => {
    const income = paidSum((rentsR.data ?? []) as PaidRow[], month) + allSum((xIncR.data ?? []) as FreeRow[], month)
    const outgo  = paidSum((expR.data  ?? []) as PaidRow[], month) + paidSum((nomR.data ?? []) as PaidRow[], month) + allSum((xExpR.data ?? []) as FreeRow[], month)
    return { date: month, balance: Math.round(income - outgo) }
  })

  return NextResponse.json({ alx, upt })
}
