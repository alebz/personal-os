'use client'

// ── Types ─────────────────────────────────────────────────────────────────────

export interface JournalEntry {
  id:         string
  entry_date: string
  content:    string | null
  mood:       string | null
  summary:    string | null
  insights:   string[]
  archived:   boolean
  created_at: string
  updated_at: string
}

// ── Constants ─────────────────────────────────────────────────────────────────

export const MOODS = [
  { value: 'excelente', emoji: '🌟', label: 'Excelente' },
  { value: 'bien',      emoji: '😊', label: 'Bien'      },
  { value: 'regular',   emoji: '😐', label: 'Regular'   },
  { value: 'bajo',      emoji: '😔', label: 'Bajo'      },
  { value: 'caotico',   emoji: '🌪️', label: 'Caótico'  },
] as const

// ── Shared helpers (consumed by Cerebro's Diario tab + UniversalCapture) ────────

export function formatTime(isoStr: string): string {
  return new Date(isoStr).toLocaleTimeString('es-MX', {
    hour: '2-digit', minute: '2-digit', hour12: false,
  })
}

export function moodEmoji(mood: string | null): string {
  return MOODS.find(m => m.value === mood)?.emoji ?? ''
}

// ── Page ──────────────────────────────────────────────────────────────────────
// BLANK SLATE — the Diario section is being remodeled from scratch (habit tracker + new
// layout go here). Writing moved to Cerebro's UniversalCapture; history lives in Cerebro's
// 📓 Diario tab. This component intentionally renders nothing yet.

export default function DiarioContent() {
  return <main className="mx-auto flex h-full max-w-3xl flex-col px-6 pt-6" />
}
