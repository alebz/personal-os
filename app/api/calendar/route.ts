import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
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

// ── Module-level cache (5 min TTL, keyed by range) ───────────────────────────

const _cache = new Map<string, { events: CalEvent[]; ts: number }>()
const CACHE_TTL = 5 * 60 * 1000

// ── Helpers ───────────────────────────────────────────────────────────────────

function icalTimeToStr(t: ICAL.Time): string {
  if (t.isDate) return t.toString().slice(0, 10)
  return t.toJSDate().toISOString()
}

// ── Core fetch + parse ────────────────────────────────────────────────────────

async function fetchAndParse(winStartDate: Date, winEndDate: Date): Promise<CalEvent[]> {
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

  // Window supplied by the caller (the visible month grid).
  const winStart = ICAL.Time.fromJSDate(winStartDate)
  const winEnd   = ICAL.Time.fromJSDate(winEndDate)

  const events: CalEvent[] = []

  for (const vevent of vevents) {
    const event = new ICAL.Event(vevent)

    if (event.isRecurring()) {
      const iter  = event.iterator()
      let   next: ICAL.Time | null
      let   guard = 3000

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

async function fetchCapturedEvents(fromStr: string, toStr: string): Promise<CalEvent[]> {
  try {
    const supabase = createServerClient()
    const { data } = await supabase
      .from('tasks')
      .select('id, title, metadata, urgency')
      .eq('kind', 'event')
      .eq('status', 'todo')
      .order('created_at', { ascending: false })

    if (!data?.length) return []

    return data.flatMap((row): CalEvent[] => {
      const meta = (row.metadata ?? {}) as { event_date?: string; event_time?: string }
      const event_date = meta.event_date
      const event_time = meta.event_time
      if (!event_date) return []
      if (event_date < fromStr || event_date > toStr) return []

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

export async function POST(req: NextRequest) {
  try {
    const { title, event_date, event_time } = await req.json()
    if (!title?.trim() || !event_date) {
      return NextResponse.json({ error: 'title and event_date required' }, { status: 400 })
    }
    const supabase = createServerClient()
    const { error } = await supabase.from('tasks').insert({
      title: title.trim(),
      kind: 'event',
      status: 'todo',
      urgency: 'someday',
      metadata: { event_date, ...(event_time ? { event_time } : {}) },
    })
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    _cache.clear()  // bust cache so next GET reflects the new event
    return NextResponse.json({ ok: true })
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}

export async function GET(req: NextRequest) {
  const now = Date.now()

  // Range comes from the visible month grid: ?from=YYYY-MM-DD&to=YYYY-MM-DD
  // Fallback (no params): today → +31 days.
  const { searchParams } = new URL(req.url)
  const nowDate = new Date()
  const fromStr = searchParams.get('from')
    ?? new Date(Date.UTC(nowDate.getUTCFullYear(), nowDate.getUTCMonth(), nowDate.getUTCDate())).toISOString().slice(0, 10)
  const toStr = searchParams.get('to')
    ?? (() => { const d = new Date(); d.setUTCDate(d.getUTCDate() + 31); return d.toISOString().slice(0, 10) })()

  const cacheKey = `${fromStr}|${toStr}`
  const hit = _cache.get(cacheKey)
  if (hit && now - hit.ts < CACHE_TTL) {
    return NextResponse.json(hit.events, { headers: { 'Cache-Control': 'no-store' } })
  }

  // iCal parser wants Date bounds. winEnd is exclusive, so +1 day on `to`
  // makes the `to` day itself fully included.
  const winStartDate = new Date(`${fromStr}T00:00:00Z`)
  const winEndDate   = new Date(`${toStr}T00:00:00Z`)
  winEndDate.setUTCDate(winEndDate.getUTCDate() + 1)

  try {
    const [icalEvents, capturedEvents] = await Promise.all([
      fetchAndParse(winStartDate, winEndDate).catch(() => [] as CalEvent[]),
      fetchCapturedEvents(fromStr, toStr),
    ])
    const events = [...icalEvents, ...capturedEvents].sort((a, b) => a.start.localeCompare(b.start))
    _cache.set(cacheKey, { events, ts: now })
    return NextResponse.json(events, { headers: { 'Cache-Control': 'no-store' } })
  } catch (err) {
    console.error('[calendar] error:', err)
    return NextResponse.json(
      { error: err instanceof Error ? err.message : String(err) },
      { status: 500, headers: { 'Cache-Control': 'no-store' } }
    )
  }
}
