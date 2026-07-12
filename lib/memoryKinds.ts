// Canonical vocabulary for memory_chunks `kind` (stored raw at metadata->>'kind').
//
// The raw kind is written by THREE paths with divergent vocabularies:
//   • lib/contextIndex.ts        → 'perfil'
//   • lib/memoryIndex.ts         → 'nota', 'diario'   (notes / journal APIs, Spanish)
//   • lib/router/classifyCapture → 'task','reminder','event','log','note','idea','contact' (English enum)
// So a note captured by the classifier lands as 'note' while one from /api/notes lands as 'nota';
// likewise 'log' (capture) vs 'diario' (journal). This is the source of the duplicate chips.
//
// This module is the single PRESENTATION-LAYER source of truth: it collapses the two synonym pairs
// to a canonical key and maps each to a Spanish label. Raw kinds are intentionally left untouched at
// rest — they carry routing meaning (e.g. isTaskKind compares the literal 'task'/'reminder'/'event').
// Normalize on read; never rewrite the classifier enum.

export type CanonicalKind =
  | 'nota' | 'diario' | 'perfil' | 'task' | 'reminder' | 'event' | 'contact' | 'idea'

// The only two true synonyms (English classifier variant → Spanish canonical).
const COLLAPSE: Record<string, CanonicalKind> = {
  note: 'nota',
  log:  'diario',
}

// Map any raw kind to its canonical key. Null/missing defaults to 'nota' (matches prior behaviour);
// unknown values pass through unchanged so nothing is silently dropped.
export function canonicalKind(raw: string | null | undefined): string {
  if (!raw) return 'nota'
  return COLLAPSE[raw] ?? raw
}

// Canonical key → Spanish display label.
export const KIND_LABEL: Record<string, string> = {
  nota:     'Nota',
  diario:   'Diario',
  perfil:   'Perfil',
  task:     'Tarea',
  reminder: 'Recordatorio',
  event:    'Evento',
  contact:  'Contacto',
  idea:     'Idea',
}

// Label for a raw kind (canonicalizes first). Falls back to the raw value if unknown.
export function kindLabel(raw: string | null | undefined): string {
  const c = canonicalKind(raw)
  return KIND_LABEL[c] ?? c
}

// Display order for filter chips. Consumers show only the canonical kinds actually present in data.
export const CANONICAL_KINDS: CanonicalKind[] = [
  'perfil', 'task', 'diario', 'nota', 'reminder', 'event', 'contact', 'idea',
]
