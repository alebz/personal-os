'use client'

import { useCallback, useEffect, useState } from 'react'

// QUÉ TOCA (Fase 5) — la presentación del motor quetoca.ts. Top 3 acciones + "y N más", con posponer/bloquear
// (algo que no depende de mí sale del camino sin desaparecer → "en espera"). Abajo, la línea dinámica (Tier 3)
// con la piel typewriter de Supraconsciente. La línea y las acciones son disjuntas por construcción del motor.

type Cand = { clave: string; tier: 0 | 1 | 2 | 3; texto: string; monto?: number; vence?: string; atorada?: boolean; motivoEspera?: string }
type Data = { acciones: Cand[]; enEspera: Cand[]; linea: string }

const manana = () => new Date(Date.now() + 86_400_000).toLocaleDateString('en-CA')

// Typewriter con la piel de Supraconsciente: mono, cursor de bloque parpadeante.
function Typewriter({ text, dc }: { text: string; dc: string }) {
  const [shown, setShown] = useState('')
  useEffect(() => {
    setShown('')
    let i = 0
    const id = setInterval(() => { i++; setShown(text.slice(0, i)); if (i >= text.length) clearInterval(id) }, 22)
    return () => clearInterval(id)
  }, [text])
  return (
    <div className="text-fg" style={{ fontFamily: "'SF Mono', ui-monospace, Menlo, monospace", fontSize: 13, lineHeight: 1.5 }}>
      <style>{`@keyframes qt-blink{0%,50%{opacity:1}50.01%,100%{opacity:0}}`}</style>
      {shown}<span style={{ color: dc, marginLeft: 1, animation: 'qt-blink 1.06s steps(1) infinite' }}>▊</span>
    </div>
  )
}

export function QueToca({ tone }: { tone?: string }) {
  const dc = tone ?? 'var(--color-accent)'
  const [data, setData] = useState<Data | null>(null)
  const [busy, setBusy] = useState<string | null>(null)
  const [expand, setExpand] = useState(false)

  const load = useCallback(() => { fetch('/api/publico/quetoca').then((r) => r.json()).then((j) => { if (!j.error) setData(j) }).catch(() => {}) }, [])
  useEffect(() => { load() }, [load])

  async function setEstado(clave: string, estado: 'pospuesto' | 'bloqueado' | null, hasta?: string) {
    setBusy(clave)
    await fetch('/api/publico/quetoca', { method: 'PATCH', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ clave, estado, hasta }) }).catch(() => {})
    await load(); setBusy(null)
  }

  if (!data) return <div className="text-secondary italic text-fg-muted">cargando…</div>

  const top = data.acciones.slice(0, 3)
  const resto = data.acciones.slice(3)
  const tierColor = (t: number) => t === 0 ? 'var(--color-danger)' : t === 1 ? 'var(--color-warn, #b45309)' : 'var(--color-fg-muted)'

  const Accion = ({ c }: { c: Cand }) => (
    <div className="group flex items-start gap-2 text-secondary">
      <span className="mt-[6px] h-1.5 w-1.5 shrink-0 rounded-full" style={{ background: tierColor(c.tier) }} />
      <span className="min-w-0 flex-1 text-fg">{c.texto}{c.atorada && <span className="ml-1 text-label text-warn">· atorada</span>}</span>
      <span className="shrink-0 whitespace-nowrap text-label opacity-0 transition-opacity group-hover:opacity-100">
        <button disabled={busy === c.clave} onClick={() => void setEstado(c.clave, 'pospuesto', manana())} className="text-fg-muted hover:text-accent" title="posponer a mañana">posponer</button>
        <button disabled={busy === c.clave} onClick={() => void setEstado(c.clave, 'bloqueado')} className="ml-2 text-fg-muted hover:text-danger" title="bloquear (no aplica ahora)">bloquear</button>
      </span>
    </div>
  )

  return (
    <div className="space-y-2">
      {top.length === 0
        ? <div className="text-secondary text-ok">Nada urgente — todo al día.</div>
        : <div className="space-y-1.5">{top.map((c) => <Accion key={c.clave} c={c} />)}</div>}

      {(resto.length > 0 || data.enEspera.length > 0) && (
        <button onClick={() => setExpand((e) => !e)} className="text-label text-fg-muted hover:text-accent">
          {expand ? '▲ menos' : `▾ ${resto.length > 0 ? `y ${resto.length} más` : ''}${resto.length > 0 && data.enEspera.length > 0 ? ' · ' : ''}${data.enEspera.length > 0 ? `${data.enEspera.length} en espera` : ''}`}
        </button>
      )}

      {expand && (
        <div className="space-y-1.5 border-t border-border pt-2">
          {resto.map((c) => <Accion key={c.clave} c={c} />)}
          {data.enEspera.map((c) => (
            <div key={c.clave} className="flex items-start gap-2 text-secondary text-fg-muted">
              <span className="mt-[6px] h-1.5 w-1.5 shrink-0 rounded-full bg-fg-muted/30" />
              <span className="min-w-0 flex-1"><span className="opacity-60 line-through">{c.texto}</span> <span className="text-label italic">· {c.motivoEspera}</span></span>
              <button disabled={busy === c.clave} onClick={() => void setEstado(c.clave, null)} className="shrink-0 text-label text-fg-muted hover:text-accent" title="reactivar">reactivar</button>
            </div>
          ))}
        </div>
      )}

      {/* La línea dinámica (Tier 3), con la piel typewriter. Nunca dice lo mismo que las acciones (disjuntas por el motor). */}
      <div className="border-t border-border pt-2">
        <Typewriter text={data.linea} dc={dc} />
      </div>
    </div>
  )
}
