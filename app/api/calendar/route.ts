import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import ICAL from 'ical.js'
import { createServerClient } from '@/lib/supabase'
import { type Rrule, generateOccurrences, eachDay, normalizeRrule } from '@/lib/calendarRecurrence'

export const runtime = 'nodejs'

// ── Types ─────────────────────────────────────────────────────────────────────

export interface CalEvent {
  uid:    string
  title:  string
  // Timed events: ISO UTC string. All-day events: "YYYY-MM-DD"
  start:  string
  end:    string
  allDay: boolean
  note?:  string   // optional free-text note (captured events only)
  // Multi-día (v1: un marcador por día del tramo). Presentes SOLO en los marcadores de un evento
  // multi-día — llevan el evento COMPLETO (fechas locales YYYY-MM-DD) para que el editor prellene el
  // rango sin re-consultar. El uid de cada marcador es `captured:<id>#<YYYY-MM-DD>` (único por día).
  spanStart?: string
  spanEnd?:   string
  rrule?:     Rrule   // presente en las ocurrencias de una serie recurrente (para que el editor prellene la regla)
}


// ── iCal cache (5 min TTL, keyed by range) ───────────────────────────────────
// Only the slow external iCal fetch is cached. Captured events are a fast Supabase query and are
// always fetched fresh, so create/edit/delete reflect immediately with no cache to bust.

const _icalCache = new Map<string, { events: CalEvent[]; ts: number }>()
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

interface ExceptionRow { series_id: string; occurrence_date: string; cancelled: boolean; override: { title?: string; event_time?: string; note?: string } | null }

async function fetchCapturedEvents(fromStr: string, toStr: string): Promise<CalEvent[]> {
  try {
    const supabase = createServerClient()
    const [tasksRes, exRes] = await Promise.all([
      supabase.from('tasks').select('id, title, metadata, urgency').eq('kind', 'event').eq('status', 'todo').order('created_at', { ascending: false }),
      supabase.from('event_exceptions').select('series_id, occurrence_date, cancelled, override'),
    ])
    const data = tasksRes.data
    if (!data?.length) return []

    // Excepciones agrupadas por serie: cancelled (salta la ocurrencia) u override (título/hora/nota).
    const exBySeries = new Map<string, Map<string, ExceptionRow>>()
    for (const e of (exRes.data ?? []) as ExceptionRow[]) {
      let m = exBySeries.get(e.series_id); if (!m) { m = new Map(); exBySeries.set(e.series_id, m) }
      m.set(e.occurrence_date, e)
    }

    return data.flatMap((row): CalEvent[] => {
      const meta = (row.metadata ?? {}) as { event_date?: string; event_end_date?: string; event_time?: string; note?: string; rrule?: Rrule }
      const event_date = meta.event_date
      const event_time = meta.event_time
      if (!event_date) return []

      // Recurrencia: una ocurrencia por fecha generada dentro del rango, con excepciones aplicadas. Precede
      // al multi-día (excluyentes en v1). Cada ocurrencia lleva la regla para que el editor la prellene.
      const rrule = meta.rrule
      if (rrule && (rrule.freq === 'weekly' || rrule.freq === 'monthly' || rrule.freq === 'yearly')) {
        const ex = exBySeries.get(row.id as string)
        return generateOccurrences(event_date, rrule, fromStr, toStr).flatMap((ds): CalEvent[] => {
          const x = ex?.get(ds)
          if (x?.cancelled) return []                         // "solo este" borrado → se salta
          const ov = x?.override ?? null                      // "solo este" editado → sobrescribe campos
          const title = ov?.title ?? row.title
          const time  = ov?.event_time ?? event_time
          const note  = ov?.note ?? meta.note
          const start = time ? `${ds}T${time}:00` : ds
          const endDate = time
            ? (() => { const dd = new Date(`${ds}T${time}:00`); dd.setHours(dd.getHours() + 1); return dd.toISOString().slice(0, 16) + ':00' })()
            : ds
          return [{ uid: `captured:${row.id}#${ds}`, title, start, end: endDate, allDay: !time, rrule, ...(note ? { note } : {}) }]
        })
      }

      // Multi-día: un marcador all-day por cada día del tramo [event_date..event_end_date] que caiga en
      // el rango pedido. Cada marcador lleva spanStart/spanEnd (para el editor) y un uid único por día.
      const end_date = meta.event_end_date
      if (end_date && end_date > event_date) {
        return eachDay(event_date, end_date)
          .filter(d => d >= fromStr && d <= toStr)
          .map((d): CalEvent => ({
            uid:    `captured:${row.id}#${d}`,
            title:  row.title,
            start:  d, end: d, allDay: true,
            spanStart: event_date, spanEnd: end_date,
            ...(meta.note ? { note: meta.note } : {}),
          }))
      }

      // Un solo día (comportamiento actual).
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
        ...(meta.note ? { note: meta.note } : {}),
      }]
    })
  } catch {
    return []
  }
}

async function getIcalCached(fromStr: string, toStr: string): Promise<CalEvent[]> {
  const key = `${fromStr}|${toStr}`
  const hit = _icalCache.get(key)
  if (hit && Date.now() - hit.ts < CACHE_TTL) return hit.events

  // iCal parser wants Date bounds. winEnd is exclusive, so +1 day on `to` includes the `to` day.
  const winStartDate = new Date(`${fromStr}T00:00:00Z`)
  const winEndDate   = new Date(`${toStr}T00:00:00Z`)
  winEndDate.setUTCDate(winEndDate.getUTCDate() + 1)

  const events = await fetchAndParse(winStartDate, winEndDate).catch(() => [] as CalEvent[])
  _icalCache.set(key, { events, ts: Date.now() })
  return events
}

// ── Handler ───────────────────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  try {
    const { title, event_date, event_end_date, event_time, note, rrule } = await req.json()
    if (!title?.trim() || !event_date) {
      return NextResponse.json({ error: 'title and event_date required' }, { status: 400 })
    }
    const rule = normalizeRrule(rrule)
    // event_end_date solo se guarda si es un tramo real (posterior al inicio); si no, evento de un día.
    // Recurrencia y multi-día son excluyentes (v1): si hay regla, se ignora el fin de tramo.
    const endDate = !rule && typeof event_end_date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(event_end_date) && event_end_date > event_date ? event_end_date : null
    const supabase = createServerClient()
    const { error } = await supabase.from('tasks').insert({
      title: title.trim(),
      kind: 'event',
      status: 'todo',
      urgency: 'someday',
      metadata: {
        event_date,
        ...(endDate ? { event_end_date: endDate } : {}),
        ...(rule ? { rrule: rule } : {}),
        ...(event_time ? { event_time } : {}),
        ...(note?.trim() ? { note: note.trim() } : {}),
      },
    })
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ ok: true })
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}

export async function GET(req: NextRequest) {
  // Range comes from the visible month grid: ?from=YYYY-MM-DD&to=YYYY-MM-DD
  // Fallback (no params): today → +31 days.
  const { searchParams } = new URL(req.url)
  const nowDate = new Date()
  const fromStr = searchParams.get('from')
    ?? new Date(Date.UTC(nowDate.getUTCFullYear(), nowDate.getUTCMonth(), nowDate.getUTCDate())).toISOString().slice(0, 10)
  const toStr = searchParams.get('to')
    ?? (() => { const d = new Date(); d.setUTCDate(d.getUTCDate() + 31); return d.toISOString().slice(0, 10) })()

  try {
    const [icalEvents, capturedEvents] = await Promise.all([
      getIcalCached(fromStr, toStr),
      fetchCapturedEvents(fromStr, toStr),
    ])
    const events = [...icalEvents, ...capturedEvents].sort((a, b) => a.start.localeCompare(b.start))
    return NextResponse.json(events, { headers: { 'Cache-Control': 'no-store' } })
  } catch (err) {
    console.error('[calendar] error:', err)
    return NextResponse.json(
      { error: err instanceof Error ? err.message : String(err) },
      { status: 500, headers: { 'Cache-Control': 'no-store' } }
    )
  }
}
