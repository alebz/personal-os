import { NextResponse } from 'next/server'
import ICAL from 'ical.js'
import { createServerClient } from '@/lib/supabase'

export const runtime = 'nodejs'

// ── Types ─────────────────────────────────────────────────────────────────────

export interface CalEvent {
  uid:    string
  title:  string
  // Timed events: ISO UTC string. All-day events: "YYYY-MM-DD"
  start:  string
  end:    string
  allDay: boolean
}

// ── Module-level cache (5 min TTL) ───────────────────────────────────────────

let _cache: { events: CalEvent[]; ts: number } | null = null
const CACHE_TTL = 5 * 60 * 1000

// ── Helpers ───────────────────────────────────────────────────────────────────

function icalTimeToStr(t: ICAL.Time): string {
  if (t.isDate) return t.toString().slice(0, 10)
  return t.toJSDate().toISOString()
}

// ── Core fetch + parse ────────────────────────────────────────────────────────

async function fetchAndParse(): Promise<CalEvent[]> {
  const raw = process.env.APPLE_CALENDAR_ICAL_URL
  if (!raw) throw new Error('APPLE_CALENDAR_ICAL_URL is not configured')
  const url = raw.replace(/^webcal:\/\//i, 'https://')

  const res = await fetch(url, {
    cache: 'no-store',
    headers: {
      'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    },
  })
  if (!res.ok) {
    const body = await res.text()
    console.error('[calendar] fetch failed:', res.status, body.slice(0, 300))
    throw new Error(`iCal fetch failed: ${res.status} ${res.statusText}`)
  }

  const icalStr = await res.text()

  const jcalData = ICAL.parse(icalStr)
  const comp     = new ICAL.Component(jcalData)
  const vevents  = comp.getAllSubcomponents('vevent')

  // 14-day window anchored to UTC today
  const now       = new Date()
  const todayUTC  = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()))
  const windowEnd = new Date(todayUTC)
  windowEnd.setUTCDate(windowEnd.getUTCDate() + 14)

  const winStart = ICAL.Time.fromJSDate(todayUTC)
  const winEnd   = ICAL.Time.fromJSDate(windowEnd)

  const events: CalEvent[] = []

  for (const vevent of vevents) {
    const event = new ICAL.Event(vevent)

    if (event.isRecurring()) {
      const iter  = event.iterator()
      let   next: ICAL.Time | null
      let   guard = 500

      while (guard-- > 0 && (next = iter.next()) !== null) {
        if (next.compare(winEnd) >= 0) break
        if (next.compare(winStart) < 0) continue

        const details = event.getOccurrenceDetails(next)
        events.push({
          uid:    `${event.uid}_${next.toString()}`,
          title:  details.item.summary || event.summary || '(Sin título)',
          start:  icalTimeToStr(details.startDate),
          end:    icalTimeToStr(details.endDate),
          allDay: details.startDate.isDate,
        })
      }
    } else {
      const start = event.startDate
      if (start.compare(winStart) >= 0 && start.compare(winEnd) < 0) {
        events.push({
          uid:    event.uid,
          title:  event.summary || '(Sin título)',
          start:  icalTimeToStr(start),
          end:    icalTimeToStr(event.endDate),
          allDay: start.isDate,
        })
      }
    }
  }

  events.sort((a, b) => a.start.localeCompare(b.start))
  return events
}

// ── Supabase captured events ──────────────────────────────────────────────────

async function fetchCapturedEvents(): Promise<CalEvent[]> {
  try {
    const supabase = createServerClient()
    const { data } = await supabase
      .from('tasks')
      .select('id, title, metadata, urgency')
      .eq('kind', 'event')
      .eq('status', 'todo')
      .order('created_at', { ascending: false })

    if (!data?.length) return []

    const now = new Date()
    const todayStr = now.toLocaleDateString('en-CA', { timeZone: 'America/Mexico_City' })
    const in14 = new Date(now); in14.setDate(in14.getDate() + 14)
    const in14Str = in14.toLocaleDateString('en-CA', { timeZone: 'America/Mexico_City' })

    return data.flatMap((row): CalEvent[] => {
      const meta = (row.metadata ?? {}) as { event_date?: string; event_time?: string }
      const event_date = meta.event_date
      const event_time = meta.event_time
      if (!event_date) return []
      if (event_date < todayStr || event_date > in14Str) return []

      const start = event_time ? `${event_date}T${event_time}:00` : event_date
      const endDate = event_time
        ? (() => { const d = new Date(`${event_date}T${event_time}:00`); d.setHours(d.getHours() + 1); return d.toISOString().slice(0, 16) + ':00' })()
        : event_date

      return [{
        uid:    `captured:${row.id}`,
        title:  row.title,
        start,
        end:    endDate,
        allDay: !event_time,
      }]
    })
  } catch {
    return []
  }
}

// ── Handler ───────────────────────────────────────────────────────────────────

export async function GET() {
  const now = Date.now()

  if (_cache && now - _cache.ts < CACHE_TTL) {
    return NextResponse.json(_cache.events, { headers: { 'Cache-Control': 'no-store' } })
  }

  try {
    const [icalEvents, capturedEvents] = await Promise.all([
      fetchAndParse().catch(() => [] as CalEvent[]),
      fetchCapturedEvents(),
    ])
    const events = [...icalEvents, ...capturedEvents].sort((a, b) => a.start.localeCompare(b.start))
    _cache = { events, ts: now }
    return NextResponse.json(events, { headers: { 'Cache-Control': 'no-store' } })
  } catch (err) {
    console.error('[calendar] error:', err)
    return NextResponse.json(
      { error: err instanceof Error ? err.message : String(err) },
      { status: 500, headers: { 'Cache-Control': 'no-store' } }
    )
  }
}
