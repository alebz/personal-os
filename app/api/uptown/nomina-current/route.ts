import { NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase'

export const runtime = 'nodejs'

function saturdaysInMonth(month: string): { num: number; date: string }[] {
  const [y, mo] = month.split('-').map(Number)
  const d = new Date(y, mo - 1, 1)
  while (d.getDay() !== 6) d.setDate(d.getDate() + 1)
  const result: { num: number; date: string }[] = []
  let n = 1
  while (d.getMonth() === mo - 1) {
    result.push({
      num: n,
      date: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`,
    })
    d.setDate(d.getDate() + 7)
    n++
  }
  return result
}

export async function GET() {
  const now = new Date()
  const today = now.toLocaleDateString('en-CA', { timeZone: 'America/Mexico_City' })
  const month = today.slice(0, 7)

  const sats = saturdaysInMonth(month)
  let weekNum: number | null = null
  let weekDate: string | null = null

  for (const sat of sats) {
    if (sat.date <= today) {
      weekNum = sat.num
      weekDate = sat.date
    }
  }

  if (weekNum === null) {
    return NextResponse.json(null)
  }

  const supabase = createServerClient()
  const { data } = await supabase
    .from('uptown_nomina')
    .select('week_num, amount, paid, method')
    .eq('month', month)
    .eq('week_num', weekNum)
    .maybeSingle()

  return NextResponse.json({
    week_num:  weekNum,
    week_date: weekDate,
    amount:    data ? Number(data.amount) : null,
    paid:      data ? Boolean(data.paid)  : false,
    method:    data?.method ?? null,
  })
}
