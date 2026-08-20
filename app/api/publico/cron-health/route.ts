import { NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase'

export const runtime = 'nodejs'

// GET /api/publico/cron-health — estado por paso del cron diario, para la barra de estado. Traduce las filas
// crudas de publico_cron_health a un ESTADO, cazando los tres modos de falla que la auditoría encontró:
//   · error  — el paso tronó (last_error) → ROJO
//   · stale  — no hay éxito reciente (>36h; el cron es diario, así que perdió ≥1 corrida) → ROJO
//   · empty  — corrió en verde pero lleva demasiado sin traer datos (last_nonempty_at viejo/null) → ÁMBAR.
//              Solo para feeds que DEBEN tener datos con cadencia (clip/propinas/compras). Ventas NO: tiene días
//              cerrados legítimos (0 recibos = cerrado), y el modo error ya distingue "Poster caído" de "cerrado".
//   · ok     — todo bien.
type Row = { step: string; last_run_at: string | null; last_success_at: string | null; last_error: string | null; last_import_count: number | null; last_nonempty_at: string | null }
type State = 'unknown' | 'ok' | 'empty' | 'stale' | 'error'

// Feeds que DEBEN traer datos con cadencia → "verde pero vacío" es alerta. 'clip' NO está: para esta cuenta,
// settlements SIEMPRE vacío es lo NORMAL (Clip es el banco, no dispersa a una cuenta externa). Marcarlo ámbar
// sería una falsa alarma permanente, que entrena a ignorar TODAS las alertas.
const EMPTY_DAYS: Record<string, number> = { propinas: 7, compras: 14 }   // sin entrada = no se alerta por vacío
const STALE_H = 36
const SEV: Record<State, number> = { unknown: 0, ok: 0, empty: 1, stale: 2, error: 3 }
const hoursSince = (iso: string | null, now: number) => iso ? (now - new Date(iso).getTime()) / 3600000 : Infinity

function stateOf(r: Row, now: number): { state: State; detail: string } {
  if (!r.last_run_at) return { state: 'unknown', detail: 'esperando la 1ª corrida del cron con el código nuevo' }
  if (r.last_error) return { state: 'error', detail: r.last_error.slice(0, 120) }   // un error real (red/auth) SÍ se muestra
  if (hoursSince(r.last_success_at, now) > STALE_H) return { state: 'stale', detail: r.last_success_at ? `sin éxito desde hace ${Math.round(hoursSince(r.last_success_at, now))}h` : 'nunca ha corrido con éxito' }
  // 'clip' (settlements): 0 filas NO es falla — es el modelo correcto. Estado OK explicado, nunca ámbar.
  if (r.step === 'clip') return { state: 'ok', detail: 'settlements vacío = normal · Clip es el banco; la comisión es tasa tecleada (no viene por API)' }
  const emptyDays = EMPTY_DAYS[r.step]
  if (emptyDays != null && hoursSince(r.last_nonempty_at, now) > emptyDays * 24) {
    return { state: 'empty', detail: r.last_nonempty_at ? `en verde pero sin importar nada desde hace ${Math.round(hoursSince(r.last_nonempty_at, now) / 24)}d` : 'en verde pero no ha importado NADA nunca' }
  }
  return { state: 'ok', detail: r.last_import_count != null ? `${r.last_import_count} en la última corrida` : 'ok' }
}

export async function GET() {
  const supabase = createServerClient()
  const { data, error } = await supabase.from('publico_cron_health').select('*')
  // Sin tabla (migración no corrida aún) o sin filas → 'unknown', NUNCA 'ok'. No repetir "verde sobre datos que
  // no existen" en la propia alerta: la ausencia de datos de salud no es salud buena.
  if (error || !data?.length) return NextResponse.json({ worst: 'unknown', problemas: [], steps: [], note: error ? 'tabla de salud no disponible' : 'sin datos de salud aún' })
  const rows = data as Row[]
  const now = Date.now()
  const steps = rows.map((r) => ({ step: r.step, ...stateOf(r, now), last_success_at: r.last_success_at, last_nonempty_at: r.last_nonempty_at, last_import_count: r.last_import_count }))
  // worst honesto: la peor gravedad real (empty/stale/error); si no hay ninguna, 'unknown' solo si TODOS están en
  // unknown (esperando 1ª corrida), si no 'ok'.
  const realProblem = steps.reduce<State>((w, s) => (SEV[s.state] > SEV[w] ? s.state : w), 'ok')
  const worst: State = realProblem !== 'ok' ? realProblem : steps.length && steps.every((s) => s.state === 'unknown') ? 'unknown' : 'ok'
  const problemas = steps.filter((s) => s.state !== 'ok' && s.state !== 'unknown').sort((a, b) => SEV[b.state] - SEV[a.state])
  return NextResponse.json({ worst, problemas, steps })
}
