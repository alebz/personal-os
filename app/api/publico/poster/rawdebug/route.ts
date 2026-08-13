import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

export const runtime = 'nodejs'

// TEMPORAL (borrar): compara, para un día, el reporte de Poster (payed_card_sum) contra las transacciones
// de Clip /payments (amount/tip/total). Sirve para decidir si el ingreso de Poster ya trae la propina.
// GET ?date=2026-08-09
export async function GET(req: NextRequest) {
  const date = req.nextUrl.searchParams.get('date') ?? '2026-08-09'
  const out: Record<string, unknown> = { date }

  // ── Poster
  const ptoken = process.env.POSTER_TOKEN
  if (ptoken) {
    const d = date.replace(/-/g, '')
    const url = `https://joinposter.com/api/dash.getPaymentsReport?format=json&token=${encodeURIComponent(ptoken)}&date_from=${d}&date_to=${d}`
    out.poster = await fetch(url, { cache: 'no-store' }).then(r => r.json()).catch((e) => ({ err: String(e) }))
  } else out.poster = { err: 'sin POSTER_TOKEN' }

  // ── Clip /payments (auth por Authorization: Basic <b64>, Accept v2). Ventana amplia en UTC para cubrir el día MX.
  const ck = process.env.CLIP_API_KEY, cs = process.env.CLIP_SECRET_KEY
  if (ck && cs) {
    const b64 = Buffer.from(`${ck}:${cs}`).toString('base64')
    const from = `${date}T00:00:00.000Z`
    const [y, m, dd] = date.split('-').map(Number)
    const next = new Date(Date.UTC(y, m - 1, dd + 1)).toISOString().slice(0, 10)
    const to = `${next}T12:00:00.000Z`
    const url = `https://api-gw.payclip.com/payments?from=${from}&to=${to}&limit=100`
    const r = await fetch(url, { headers: { 'Authorization': `Basic ${b64}`, 'Accept': 'application/vnd.com.payclip.v2+json' }, cache: 'no-store' }).catch(() => null)
    if (r && r.ok) {
      const j = await r.json().catch(() => null) as { items?: Array<{ amount?: number; tip?: number; total?: number; created_at?: string; status?: string }> } | null
      const items = j?.items ?? []
      const sum = (f: 'amount' | 'tip' | 'total') => Math.round(items.reduce((a, it) => a + Number(it[f] ?? 0), 0) * 100) / 100
      out.clip = { status: 200, count: items.length, sumAmount: sum('amount'), sumTip: sum('tip'), sumTotal: sum('total'), sample: items.slice(0, 6).map(it => ({ amount: it.amount, tip: it.tip, total: it.total, status: it.status, at: it.created_at })) }
    } else {
      out.clip = { status: r ? r.status : 'network', body: r ? (await r.text().catch(() => '')).slice(0, 200) : '' }
    }
  } else out.clip = { err: 'sin credenciales Clip' }

  return NextResponse.json(out)
}
