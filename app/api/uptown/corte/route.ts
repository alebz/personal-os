import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { createServerClient } from '@/lib/supabase'

export async function GET(req: NextRequest) {
  const month = req.nextUrl.searchParams.get('month')
  if (!month) return NextResponse.json({ error: 'month required' }, { status: 400 })

  const supabase = createServerClient()
  const { data, error } = await supabase
    .from('uptown_cortes')
    .select('*')
    .eq('month', month)
    .order('created_at', { ascending: false })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data ?? [])
}

export async function POST(req: NextRequest) {
  let body: {
    month?: string
    sistema?: number
    real?: number
    diferencia?: number
    concepto?: string
    cuenta_bancaria?: number
    efectivo?: number
  }
  try { body = await req.json() } catch { return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }) }

  try {
    const { month, sistema, real, diferencia, concepto, cuenta_bancaria, efectivo } = body
    if (!month || sistema == null || real == null || diferencia == null) {
      return NextResponse.json({ error: 'month, sistema, real, diferencia required' }, { status: 400 })
    }

    const supabase = createServerClient()

    // Record the corte
    const { data: corte, error: corteErr } = await supabase
      .from('uptown_cortes')
      .insert({
        month, sistema, real, diferencia, concepto: concepto || null,
      })
      .select()
      .single()

    if (corteErr) {
      console.error('CORTE API ERROR - supabase insert:', corteErr)
      return NextResponse.json({ error: corteErr.message }, { status: 500 })
    }

    // Reset all paid flags and clear extras — clean slate for next period
    await Promise.all([
      supabase.from('uptown_rents').update({ paid: false }).eq('month', month),
      supabase.from('uptown_fixed_expenses').update({ paid: false }).eq('month', month),
      supabase.from('uptown_nomina').update({ paid: false }).eq('month', month),
      supabase.from('uptown_extra_expenses').delete().eq('month', month),
      supabase.from('uptown_extra_income').delete().eq('month', month),
    ])

    return NextResponse.json({ corte }, { status: 201 })
  } catch (err) {
    console.error('CORTE API ERROR:', err)
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
