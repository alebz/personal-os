'use client'

import { useState, useEffect, useRef } from 'react'
import Shell from '@/components/Shell'

// ── Types ─────────────────────────────────────────────────────────────────────

interface JournalEntry {
  id:         string
  entry_date: string
  content:    string | null
  mood:       string | null
  summary:    string | null
  insights:   string[]
  created_at: string
  updated_at: string
}

interface SidebarEntry {
  entry_date: string
  mood:       string | null
  summary:    string | null
}

// ── Constants ─────────────────────────────────────────────────────────────────

const MOODS = [
  { value: 'excelente', emoji: '🌟', label: 'Excelente' },
  { value: 'bien',      emoji: '😊', label: 'Bien'      },
  { value: 'regular',   emoji: '😐', label: 'Regular'   },
  { value: 'bajo',      emoji: '😔', label: 'Bajo'      },
  { value: 'caotico',   emoji: '🌪️', label: 'Caótico'  },
] as const

// ── Helpers ───────────────────────────────────────────────────────────────────

function todayStr(): string {
  return new Date().toISOString().slice(0, 10)
}

function yesterdayStr(): string {
  const d = new Date()
  d.setDate(d.getDate() - 1)
  return d.toISOString().slice(0, 10)
}

function formatHeaderDate(dateStr: string): string {
  return new Date(dateStr + 'T12:00:00').toLocaleDateString('es-MX', {
    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
  })
}

function formatSidebarDate(dateStr: string): string {
  if (dateStr === todayStr())     return 'Hoy'
  if (dateStr === yesterdayStr()) return 'Ayer'
  return new Date(dateStr + 'T12:00:00').toLocaleDateString('es-MX', {
    weekday: 'short', day: 'numeric', month: 'short',
  })
}

function moodEmoji(mood: string | null): string {
  return MOODS.find(m => m.value === mood)?.emoji ?? ''
}

// ── Sub-components ────────────────────────────────────────────────────────────

function SidebarItem({
  date, mood, summary, active, isToday = false, onClick,
}: {
  date:     string
  mood:     string | null
  summary:  string | null
  active:   boolean
  isToday?: boolean
  onClick:  () => void
}) {
  const preview = summary
    ? summary.slice(0, 64) + (summary.length > 64 ? '…' : '')
    : null

  return (
    <button
      onClick={onClick}
      className={`w-full rounded-xl px-3 py-2.5 text-left transition-colors ${
        active
          ? 'bg-accent/10 border border-accent/20 text-accent'
          : 'border border-transparent text-ink-3 hover:bg-ink-1/40 hover:text-ink-4'
      }`}
    >
      <div className="flex items-center gap-1.5">
        {mood && <span className="text-sm leading-none">{moodEmoji(mood)}</span>}
        <span className={`text-xs font-semibold capitalize ${active ? 'text-accent' : 'text-ink-4'}`}>
          {isToday ? '✦ Hoy' : formatSidebarDate(date)}
        </span>
      </div>
      {preview && (
        <p className={`mt-0.5 text-[11px] leading-relaxed line-clamp-2 ${active ? 'text-accent/70' : 'text-ink-3'}`}>
          {preview}
        </p>
      )}
    </button>
  )
}

function SaveIndicator({ state }: { state: 'idle' | 'saving' | 'saved' | 'error' }) {
  if (state === 'idle')   return null
  if (state === 'saving') return <span className="text-xs text-ink-3 animate-pulse">Guardando…</span>
  if (state === 'saved')  return <span className="text-xs text-ok">✓ Guardado</span>
  return <span className="text-xs text-danger">Error al guardar</span>
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function JournalPage() {
  const [activeDate, setActiveDate]   = useState(todayStr)
  const [content, setContent]         = useState('')
  const [mood, setMood]               = useState('')
  const [summary, setSummary]         = useState('')
  const [insights, setInsights]       = useState<string[]>([])
  const [sidebarList, setSidebarList] = useState<SidebarEntry[]>([])
  const [loading, setLoading]         = useState(true)
  const [saveState, setSaveState]     = useState<'idle' | 'saving' | 'saved' | 'error'>('idle')
  const [summarizing, setSummarizing] = useState(false)
  const [summaryError, setSummaryError] = useState<string | null>(null)

  // Refs — keep latest values for the debounced save without stale closures
  const saveTimerRef    = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
  const clearSaveRef    = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
  const contentRef      = useRef(content)
  const moodRef         = useRef(mood)
  const summaryRef      = useRef(summary)
  const insightsRef     = useRef(insights)
  const activeDateRef   = useRef(activeDate)
  const textareaRef     = useRef<HTMLTextAreaElement>(null)

  contentRef.current    = content
  moodRef.current       = mood
  summaryRef.current    = summary
  insightsRef.current   = insights
  activeDateRef.current = activeDate

  // doSave reads from refs so it always has the latest values
  const doSaveRef = useRef(async () => {
    setSaveState('saving')
    try {
      const r = await fetch('/api/journal', {
        method:  'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          date:     activeDateRef.current,
          content:  contentRef.current,
          mood:     moodRef.current  || null,
          summary:  summaryRef.current,
          insights: insightsRef.current,
        }),
      })
      if (!r.ok) throw new Error(await r.text())
      setSaveState('saved')
      clearTimeout(clearSaveRef.current)
      clearSaveRef.current = setTimeout(() => setSaveState('idle'), 2000)
      void loadSidebar()
    } catch {
      setSaveState('error')
    }
  })

  // Update the ref body on each render so it closes over fresh setters
  doSaveRef.current = async () => {
    setSaveState('saving')
    try {
      const r = await fetch('/api/journal', {
        method:  'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          date:     activeDateRef.current,
          content:  contentRef.current,
          mood:     moodRef.current  || null,
          summary:  summaryRef.current,
          insights: insightsRef.current,
        }),
      })
      if (!r.ok) throw new Error(await r.text())
      setSaveState('saved')
      clearTimeout(clearSaveRef.current)
      clearSaveRef.current = setTimeout(() => setSaveState('idle'), 2000)
      void loadSidebar()
    } catch {
      setSaveState('error')
    }
  }

  function scheduleSave() {
    clearTimeout(saveTimerRef.current)
    saveTimerRef.current = setTimeout(() => void doSaveRef.current(), 1500)
  }

  // ── Load entry ──────────────────────────────────────────────────────────────

  async function loadEntry(date: string) {
    setLoading(true)
    setSaveState('idle')
    try {
      const r = await fetch(`/api/journal?date=${date}`)
      const data: JournalEntry | null = await r.json()
      if (data) {
        setContent(data.content ?? '')
        setMood(data.mood ?? '')
        setSummary(data.summary ?? '')
        setInsights(Array.isArray(data.insights) ? data.insights : [])
      } else {
        setContent('')
        setMood('')
        setSummary('')
        setInsights([])
      }
      setSummaryError(null)
    } catch {
      setContent('')
      setMood('')
    } finally {
      setLoading(false)
      // Resize textarea after content loads
      setTimeout(() => {
        if (textareaRef.current) {
          textareaRef.current.style.height = 'auto'
          textareaRef.current.style.height = textareaRef.current.scrollHeight + 'px'
        }
      }, 0)
    }
  }

  async function loadSidebar() {
    try {
      const r = await fetch('/api/journal/list')
      if (!r.ok) return
      setSidebarList(await r.json())
    } catch {}
  }

  useEffect(() => { void loadEntry(activeDate) }, [activeDate])
  useEffect(() => { void loadSidebar() }, [])

  // ── Handlers ────────────────────────────────────────────────────────────────

  function handleContentChange(val: string) {
    setContent(val)
    // Auto-grow
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto'
      textareaRef.current.style.height = textareaRef.current.scrollHeight + 'px'
    }
    scheduleSave()
  }

  function handleMoodChange(val: string) {
    const next = mood === val ? '' : val
    setMood(next)
    // Immediate save for mood (short debounce)
    clearTimeout(saveTimerRef.current)
    saveTimerRef.current = setTimeout(() => void doSaveRef.current(), 300)
  }

  function switchDate(date: string) {
    clearTimeout(saveTimerRef.current)
    setActiveDate(date)
    setSummaryError(null)
  }

  // ── AI Summarize ────────────────────────────────────────────────────────────

  async function handleSummarize() {
    if (!content.trim() || summarizing) return
    setSummarizing(true)
    setSummaryError(null)
    try {
      const r = await fetch('/api/journal/summarize', {
        method:  'POST',
        headers: { 'content-type': 'application/json' },
        body:    JSON.stringify({ content: content.trim() }),
      })
      if (!r.ok) throw new Error(await r.text())
      const data = await r.json()
      const newSummary  = data.summary  ?? ''
      const newInsights = Array.isArray(data.insights) ? data.insights : []
      setSummary(newSummary)
      setInsights(newInsights)
      // Save with the new summary immediately
      clearTimeout(saveTimerRef.current)
      saveTimerRef.current = setTimeout(() => void doSaveRef.current(), 200)
    } catch (e) {
      setSummaryError(String(e).replace('Error: ', ''))
    } finally {
      setSummarizing(false)
    }
  }

  // ── Render ───────────────────────────────────────────────────────────────────

  const isToday = activeDate === todayStr()
  const canSummarize = content.trim().length >= 50 && !summarizing

  // Today might not be in sidebarList if no entry has been created yet
  const todayInSidebar = sidebarList.find(e => e.entry_date === todayStr())

  return (
    <Shell glow="journal">
      <main className="mx-auto max-w-7xl px-4 py-6 sm:px-6">

        {/* Mobile: horizontal date scroll */}
        <div className="mb-4 lg:hidden overflow-x-auto -mx-1 px-1">
          <div className="flex gap-2 pb-1 min-w-max">
            <button
              onClick={() => switchDate(todayStr())}
              className={`flex-shrink-0 flex items-center gap-1 rounded-full px-3 py-1.5 text-xs font-medium border transition-colors ${
                isToday
                  ? 'border-accent/25 bg-accent/10 text-accent'
                  : 'border-ink-4/10 text-ink-3 hover:text-ink-4'
              }`}
            >
              {todayInSidebar?.mood && <span>{moodEmoji(todayInSidebar.mood)}</span>}
              <span>✦ Hoy</span>
            </button>
            {sidebarList
              .filter(e => e.entry_date !== todayStr())
              .map(e => (
                <button
                  key={e.entry_date}
                  onClick={() => switchDate(e.entry_date)}
                  className={`flex-shrink-0 flex items-center gap-1 rounded-full px-3 py-1.5 text-xs font-medium border transition-colors ${
                    activeDate === e.entry_date
                      ? 'border-accent/25 bg-accent/10 text-accent'
                      : 'border-ink-4/10 text-ink-3 hover:text-ink-4'
                  }`}
                >
                  {e.mood && <span>{moodEmoji(e.mood)}</span>}
                  <span>{formatSidebarDate(e.entry_date)}</span>
                </button>
              ))
            }
          </div>
        </div>

        <div className="lg:grid lg:grid-cols-[240px_1fr] lg:gap-6">

          {/* ── Desktop sidebar ─────────────────────────────────────────────── */}
          <aside className="hidden lg:flex flex-col gap-1 sticky top-24 self-start max-h-[calc(100dvh-7rem)] overflow-y-auto pr-1">
            <p className="mb-2 px-1 text-[10px] font-semibold uppercase tracking-widest text-ink-3">
              Entradas
            </p>

            {/* Always show Today at top */}
            <SidebarItem
              date={todayStr()}
              mood={todayInSidebar?.mood ?? null}
              summary={todayInSidebar?.summary ?? null}
              active={isToday}
              isToday
              onClick={() => switchDate(todayStr())}
            />

            {sidebarList
              .filter(e => e.entry_date !== todayStr())
              .map(e => (
                <SidebarItem
                  key={e.entry_date}
                  date={e.entry_date}
                  mood={e.mood}
                  summary={e.summary}
                  active={activeDate === e.entry_date}
                  onClick={() => switchDate(e.entry_date)}
                />
              ))
            }
          </aside>

          {/* ── Main editor ─────────────────────────────────────────────────── */}
          <div className="min-w-0">

            {/* Header */}
            <div className="mb-5 flex items-start justify-between gap-4">
              <div>
                <h1 className="text-base font-semibold capitalize text-ink-4">
                  {formatHeaderDate(activeDate)}
                </h1>
                {!isToday && (
                  <button
                    onClick={() => switchDate(todayStr())}
                    className="mt-0.5 text-xs text-accent hover:underline"
                  >
                    ← Ir a hoy
                  </button>
                )}
              </div>
              <SaveIndicator state={saveState} />
            </div>

            {/* Mood selector */}
            <div className="mb-4 flex flex-wrap gap-2">
              {MOODS.map(m => (
                <button
                  key={m.value}
                  onClick={() => handleMoodChange(m.value)}
                  className={`flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-medium transition-colors ${
                    mood === m.value
                      ? 'border-accent/25 bg-accent/10 text-accent'
                      : 'border-ink-4/10 text-ink-3 hover:border-ink-4/20 hover:text-ink-4'
                  }`}
                >
                  <span>{m.emoji}</span>
                  <span>{m.label}</span>
                </button>
              ))}
            </div>

            {/* Textarea */}
            {loading ? (
              <div className="min-h-[50vh] animate-pulse rounded-2xl border border-ink-4/10 bg-ink-1/40" />
            ) : (
              <textarea
                ref={textareaRef}
                value={content}
                onChange={e => handleContentChange(e.target.value)}
                placeholder="¿Cómo estuvo tu día? ¿Qué estás pensando o sintiendo?"
                className="w-full resize-none overflow-hidden rounded-2xl border border-ink-4/10 bg-ink-1/40 px-5 py-4 text-sm leading-relaxed text-ink-4 placeholder:text-ink-2 shadow-xl shadow-black/10 backdrop-blur-xl outline-none transition-colors focus:border-accent/20 focus:ring-1 focus:ring-accent/10"
                style={{ minHeight: '50vh' }}
              />
            )}

            {/* AI Summarize button */}
            <div className="mt-4 flex items-center gap-3">
              <button
                onClick={() => void handleSummarize()}
                disabled={!canSummarize || loading}
                className="flex items-center gap-2 rounded-xl border border-ink-4/10 bg-ink-1/40 px-4 py-2 text-sm font-medium text-ink-3 transition-colors hover:border-accent/20 hover:bg-ink-1/60 hover:text-accent disabled:cursor-not-allowed disabled:opacity-40 backdrop-blur-xl"
              >
                <span>{summarizing ? '⏳' : '✨'}</span>
                <span>{summarizing ? 'Generando resumen…' : 'Resumir con IA'}</span>
              </button>
              {summaryError && (
                <p className="text-xs text-danger">⚠ {summaryError}</p>
              )}
            </div>

            {/* Summary & Insights */}
            {(summary || insights.length > 0) && (
              <div className="mt-4 overflow-hidden rounded-2xl border border-ink-4/10 bg-ink-1/40 shadow-xl shadow-black/10 backdrop-blur-xl">
                {summary && (
                  <div className={insights.length > 0 ? 'border-b border-ink-4/5 px-5 py-4' : 'px-5 py-4'}>
                    <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-widest text-ink-3">
                      Resumen
                    </p>
                    <p className="text-sm leading-relaxed text-ink-4">{summary}</p>
                  </div>
                )}
                {insights.length > 0 && (
                  <div className="px-5 py-4">
                    <p className="mb-3 text-[10px] font-semibold uppercase tracking-widest text-ink-3">
                      Insights clave
                    </p>
                    <ul className="space-y-2.5">
                      {insights.map((insight, i) => (
                        <li key={i} className="flex gap-2.5 text-sm text-ink-4">
                          <span className="mt-0.5 shrink-0 text-accent text-xs">◆</span>
                          <span className="leading-relaxed">{insight}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            )}

          </div>
        </div>
      </main>
    </Shell>
  )
}
