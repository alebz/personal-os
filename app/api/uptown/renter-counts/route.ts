import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { createServerClient } from '@/lib/supabase'

export async function POST(req: NextRequest) {
  let body: { renter?: string; paid_count?: number; total_months?: number }
  try { body = await req.json() } catch { return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }) }

  const { renter, paid_count, total_months } = body
  if (!renter || paid_count == null || total_months == null) {
    return NextResponse.json({ error: 'renter, paid_count, and total_months required' }, { status: 400 })
  }

  const supabase = createServerClient()
  const { error } = await supabase
    .from('uptown_renter_counts')
    .upsert({ renter, paid_count, total_months }, { onConflict: 'renter' })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
