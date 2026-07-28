'use client'

import { useEffect, useRef, useState } from 'react'
import { useOSSettings } from '@/components/OSSettingsContext'

// SUPRACONSCIENTE — la línea viva de Cerebro. Se escribe sola (typewriter, cursor de bloque), vive un
// rato, se BORRA sola (backspace carácter por carácter), y escribe la siguiente. Mensajes generados
// por IA con el contexto del usuario (/api/supraconsciente). Estrategia de costo: LOTE de N por
// llamada, rotación client-side, cache por DÍA en localStorage (fresco al abrir sin re-generar; solo
// llama al agotarse). No repite en el mismo día (historial `shown` → exclude). Vive en /brain.

type Msg = { text: string; topic: string }
const CACHE_KEY = 'supra-cache'
const MONO = "'Share Tech Mono', ui-monospace, monospace"

// Ritmo de escritura — "alguien pensando", no una notificación. Ajustable.
const TYPE_MS  = 52    // base por carácter
const TYPE_JIT = 34    // jitter aleatorio ±
const PUNCT_MS = 260   // pausa extra tras , . ; : — (respiro)
const ERASE_MS = 26    // backspace (más rápido que escribir)

function todayKey() {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

export default function Supraconsciente() {
  const { supraconsciente: cfg } = useOSSettings()
  const [text, setText]     = useState('')
  const [active, setActive] = useState(false)   // la cara de Cerebro está visible
  const rootRef = useRef<HTMLDivElement>(null)

  // Detecta visibilidad de la cara (el tambor rota las caras fuera del viewport cuando no están al
  // centro) → fresco al abrir, rota mientras está abierta, pausa cuando no se ve.
  useEffect(() => {
    const el = rootRef.current; if (!el) return
    const io = new IntersectionObserver(([e]) => setActive(e.isIntersecting), { threshold: 0.55 })
    io.observe(el)
    return () => io.disconnect()
  }, [])

  const enabled = cfg.enabled && cfg.topics.supra

  useEffect(() => {
    if (!enabled || !active) { setText(''); return }

    let cancelled = false
    let wakeSleep: (() => void) | null = null
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches

    const sleep = (ms: number) => new Promise<void>(resolve => {
      const t = setTimeout(resolve, ms)
      wakeSleep = () => { clearTimeout(t); resolve() }
    })

    // ── cache por día ──
    type Cache = { date: string; queue: Msg[]; shown: string[] }
    const readCache = (): Cache => {
      try {
        const c = JSON.parse(localStorage.getItem(CACHE_KEY) || 'null')
        if (c && c.date === todayKey()) return c
      } catch { /* ignore */ }
      return { date: todayKey(), queue: [], shown: [] }
    }
    let cache = readCache()
    const writeCache = () => { try { localStorage.setItem(CACHE_KEY, JSON.stringify(cache)) } catch { /* ignore */ } }

    const fetchBatch = async (): Promise<Msg[]> => {
      try {
        const r = await fetch('/api/supraconsciente', {
          method: 'POST', headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ count: 8, exclude: cache.shown.slice(-40), topics: ['supra'] }),
        })
        if (!r.ok) return []
        const d = await r.json()
        return Array.isArray(d.messages) ? d.messages : []
      } catch { return [] }
    }

    const nextMsg = async (): Promise<Msg | null> => {
      // salta los ya mostrados hoy
      while (cache.queue.length && cache.shown.includes(cache.queue[0].text)) cache.queue.shift()
      if (cache.queue.length === 0) {
        const batch = await fetchBatch()
        if (cancelled) return null
        cache.queue = batch.filter(m => !cache.shown.includes(m.text))
        writeCache()
      }
      const m = cache.queue.shift() || null
      if (m) { cache.shown.push(m.text); cache.shown = cache.shown.slice(-60); writeCache() }
      // prefetch en background cuando la cola queda baja
      if (cache.queue.length <= 1) fetchBatch().then(b => { cache.queue.push(...b.filter(m => !cache.shown.includes(m.text))); writeCache() })
      return m
    }

    const typeIn = async (msg: string) => {
      for (let i = 1; i <= msg.length; i++) {
        if (cancelled) return
        setText(msg.slice(0, i))
        const ch = msg[i - 1]
        const extra = ',.;:—…'.includes(ch) ? PUNCT_MS : 0
        await sleep(TYPE_MS + Math.random() * TYPE_JIT + extra)
      }
    }
    const eraseOut = async (len: number) => {
      for (let n = len; n > 0; n--) {
        if (cancelled) return
        setText(prev => prev.slice(0, -1))
        await sleep(ERASE_MS)
      }
      setText('')
    }

    const holdMs = Math.max(6000, cfg.rotateMinutes * 60_000)

    async function loop() {
      while (!cancelled) {
        const m = await nextMsg()
        if (cancelled) return
        if (!m) { await sleep(30_000); continue }   // sin contexto / fallo → reintenta luego
        if (reduced) { setText(m.text); await sleep(holdMs); setText(''); continue }
        await typeIn(m.text)
        if (cancelled) return
        await sleep(holdMs)
        if (cancelled) return
        await eraseOut(m.text.length)
      }
    }
    loop()

    return () => { cancelled = true; wakeSleep?.() }
  }, [enabled, active, cfg.rotateMinutes]) // eslint-disable-line react-hooks/exhaustive-deps

  if (!enabled) return <div ref={rootRef} aria-hidden style={{ height: 1 }} />

  return (
    <div
      ref={rootRef}
      aria-live="polite"
      style={{
        minHeight: '1.6em', display: 'flex', alignItems: 'center', justifyContent: 'center',
        textAlign: 'center', padding: '0 1rem',
        fontFamily: MONO, fontSize: 17, letterSpacing: '0.02em', lineHeight: 1.5,
        color: 'var(--color-fg)',
        // Sombra fuerte: despega la línea del sim (naves/estrellas) y la hace legible por encima.
        textShadow: '0 2px 12px rgba(0,0,0,0.92), 0 0 4px rgba(0,0,0,0.85), 0 1px 2px rgba(0,0,0,0.9)',
      }}
    >
      <style>{`@keyframes supra-blink { 0%,50% { opacity: 1 } 50.01%,100% { opacity: 0 } }`}</style>
      <span>
        {text}
        {text && <span style={{ color: 'var(--color-accent)', marginLeft: 1, animation: 'supra-blink 1.06s steps(1) infinite' }}>▊</span>}
      </span>
    </div>
  )
}
