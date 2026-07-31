import { NextResponse } from 'next/server'

export const runtime = 'nodejs'
export const revalidate = 1800   // 30 min: FX (ECB) es diario, las noticias no urgen

// MARKET — alimenta el "alma de época" de Finanzas bajo XP (MSN Money 2003). El indicador VIVO y REAL
// es USD/MXN (frankfurter.app, base ECB, sin API key: spot + serie para el sparkline). Las noticias son
// reales (RSS de Investing.com MX). Los índices bursátiles van DECORATIVOS de época (no hay fuente
// gratis confiable de índices en vivo; el spec ya los contempla como decoración — el FX es lo real).

const FX_URL = (from: string, to: string) => `https://api.frankfurter.app/latest?from=${from}&to=${to}`
const FX_SERIES = (from: string, to: string, start: string, end: string) =>
  `https://api.frankfurter.app/${start}..${end}?from=${from}&to=${to}`
const NEWS_URL = 'https://mx.investing.com/rss/news.rss'

function isoDaysAgo(days: number): string {
  const d = new Date()
  d.setDate(d.getDate() - days)
  return d.toISOString().slice(0, 10)
}

interface Quote { pair: string; rate: number; prevClose: number; change: number; changePct: number; spark: number[]; asOf: string }

// USD/MXN real: spot + serie ~40 días → sparkline, cierre previo, cambio del día.
async function fetchFx(): Promise<Quote | null> {
  try {
    const [spotRes, serRes] = await Promise.all([
      fetch(FX_URL('USD', 'MXN'), { next: { revalidate } }),
      fetch(FX_SERIES('USD', 'MXN', isoDaysAgo(45), isoDaysAgo(0)), { next: { revalidate } }),
    ])
    const spot = await spotRes.json() as { rates?: { MXN?: number }; date?: string }
    const ser = await serRes.json() as { rates?: Record<string, { MXN?: number }> }
    const days = Object.keys(ser.rates ?? {}).sort()
    const spark = days.map((d) => ser.rates![d].MXN!).filter((n) => typeof n === 'number')
    const rate = spot.rates?.MXN ?? spark[spark.length - 1]
    if (!rate) return null
    // cierre previo = penúltimo punto de la serie (o el último si spot ya es de hoy y coincide)
    const prevClose = spark.length >= 2 ? spark[spark.length - 2] : rate
    const change = rate - prevClose
    return {
      pair: 'USD/MXN', rate, prevClose, change,
      changePct: prevClose ? (change / prevClose) * 100 : 0,
      spark: spark.slice(-30),
      asOf: spot.date ?? days[days.length - 1] ?? '',
    }
  } catch { return null }
}

interface NewsItem { title: string; link: string; date: string }

// RSS de Investing.com MX (real). Parseo con regex (sin dependencia XML): título (CDATA o plano), link, fecha.
async function fetchNews(): Promise<NewsItem[]> {
  try {
    const res = await fetch(NEWS_URL, {
      headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 5.1; rv:7.0) Gecko/20100101 Firefox/7.0' },
      next: { revalidate },
    })
    if (!res.ok) return []
    const xml = await res.text()
    const items: NewsItem[] = []
    const blocks = xml.match(/<item>([\s\S]*?)<\/item>/g) ?? []
    for (const block of blocks.slice(0, 8)) {
      const title = pick(block, 'title')
      const link = pick(block, 'link')
      const date = pick(block, 'pubDate')
      if (title) items.push({ title, link, date })
    }
    return items
  } catch { return [] }
}

function pick(block: string, tag: string): string {
  const m = new RegExp(`<${tag}>([\\s\\S]*?)</${tag}>`).exec(block)
  if (!m) return ''
  return m[1].replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1').replace(/&amp;/g, '&').replace(/&#39;|&apos;/g, "'").replace(/&quot;/g, '"').trim()
}

// Índices decorativos de época — el "look" de MSN Money 2003. NO en vivo (el spec los quiere decorativos);
// el único indicador REAL es el FX de arriba. Valores plausibles con un cambio fijo de sabor.
const DECOR_INDICES = [
  { name: 'Dow Jones', value: 41_218.4, change: 138.2, changePct: 0.34 },
  { name: 'Nasdaq', value: 17_842.6, change: -52.9, changePct: -0.30 },
  { name: 'S&P 500', value: 5_614.1, change: 11.7, changePct: 0.21 },
  { name: 'IPC BMV', value: 53_907.0, change: 402.5, changePct: 0.75 },
]

export async function GET() {
  const [fx, news] = await Promise.all([fetchFx(), fetchNews()])
  return NextResponse.json({ fx, news, indices: DECOR_INDICES })
}
