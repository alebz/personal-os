// Central registry of the Claude model IDs Cerebro routes to. Kept out of the global
// ANTHROPIC_MODEL env (which is a single override applied to *every* AI route) so query routing can
// pick a model per request without affecting the rest of the app.
//
// Cerebro's answer synthesis is where the value is, so it routes by query type:
//   • LOOKUP  ("teléfono de X", "cuándo es la junta") → Haiku: fast + cheap, retrieval does the work.
//   • SÍNTESIS ("qué he pensado sobre X", "cómo se relacionan Y y Z") → Sonnet 5: real synthesis.
// A fast Haiku classifier decides which (see lib/router/classifyQuery.ts).

export const CLASSIFIER_MODEL = 'claude-haiku-4-5-20251001'   // route lookup vs synthesis (cheap, low-latency)
export const LOOKUP_MODEL     = 'claude-haiku-4-5-20251001'   // direct-fact answers
export const SYNTHESIS_MODEL  = 'claude-sonnet-5'             // reasoning-heavy synthesis
