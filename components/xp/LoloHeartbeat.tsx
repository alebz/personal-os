'use client'

import { useEffect, useRef } from 'react'
import { pushNotification } from '@/lib/notifications'

// LOLO PROACTIVO — Lolo te escribe SOLO, sin que le hables primero (como un cuate que te manda un mensaje
// de la nada). Cada ping: genera una línea (spontaneous), la muestra como TOAST (target 'lolo' → abre su
// chat) y la PERSISTE en su buffer (para que al abrir el chat esté ahí). Throttle duro (90 min entre pings)
// + horario despierto (8–23h) + probabilidad en los chequeos periódicos. Primer ping ~poco después de abrir.

const KEY = 'lolo-last-ping'
const MIN_GAP = 90 * 60_000      // mínimo entre pings proactivos
const INTERVAL = 10 * 60_000     // cada cuánto se evalúa
const PROB = 0.3                 // probabilidad en chequeos periódicos (el primero es seguro)

const LOLO_PING_SYSTEM = [
  'Eres Lolo, el compañero de Alex — su amigo, no un asistente. Le escribes por Messenger.',
  'Le llegas TÚ sin que te escriba primero, como un cuate que manda un mensaje de la nada.',
  'MUY corto (1 línea), natural, cálido, con humor seco: una ocurrencia, un cariño, o retomar algo de antes.',
  'NADA de "¿en qué te ayudo?" ni preguntas de asistente; puedes no preguntar nada.',
  'Español, minúsculas ok, sin markdown ni comillas.',
].join(' ')

type Msg = { role: 'user' | 'assistant'; content: string }
// Colapsa roles iguales adyacentes (por si el buffer trae dos assistant seguidos tras un ping proactivo).
function collapse(msgs: Msg[]): Msg[] {
  const out: Msg[] = []
  for (const m of msgs) { const last = out[out.length - 1]; if (last && last.role === m.role) last.content += '\n' + m.content; else out.push({ ...m }) }
  return out
}

export default function LoloHeartbeat() {
  const busy = useRef(false)

  useEffect(() => {
    let alive = true

    async function ping() {
      if (busy.current) return
      const h = new Date().getHours()
      if (h < 8 || h >= 24) return                                   // horario despierto
      let last = 0; try { last = +(localStorage.getItem(KEY) || 0) } catch { /* ignore */ }
      if (Date.now() - last < MIN_GAP) return                        // throttle duro
      busy.current = true
      try {
        const mem = await fetch('/api/companion/memory').then((r) => r.json()).catch(() => ({}))
        let ctx: Msg[] = (Array.isArray(mem?.buffer) ? mem.buffer : []).map((m: Msg) => ({ role: m.role === 'user' ? 'user' : 'assistant', content: m.content }))
        while (ctx.length && ctx[0].role === 'assistant') ctx = ctx.slice(1)
        ctx = collapse(ctx).slice(-6)
        const messages = [...ctx, { role: 'user' as const, content: '[Alex está en su OS. Escríbele tú, sin que te escriba primero.]' }]
        const d = await fetch('/api/companion/chat', {
          method: 'POST', headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ spontaneous: true, system: LOLO_PING_SYSTEM, messages: collapse(messages) }),
        }).then((r) => r.json()).catch(() => ({}))
        const reply = (d?.text as string)?.trim()
        if (!alive || !reply) return
        try { localStorage.setItem(KEY, String(Date.now())) } catch { /* ignore */ }
        pushNotification({ id: `lolo:${Date.now()}`, icon: '/Lolo/Idle/lolo_idle_2.png', title: 'Lolo', body: reply, target: 'lolo' })
        // persiste al buffer para que al abrir el chat esté el mensaje
        const buffer = Array.isArray(mem?.buffer) ? mem.buffer : []
        fetch('/api/companion/memory', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ buffer: [...buffer, { role: 'assistant', content: reply }] }) }).catch(() => {})
      } finally { busy.current = false }
    }

    // primer ping poco después de abrir (se siente "Lolo notó que te conectaste"); luego chequeos periódicos.
    const first = setTimeout(() => { if (alive) ping() }, 22_000 + Math.random() * 15_000)
    const iv = setInterval(() => { if (alive && Math.random() < PROB) ping() }, INTERVAL)
    return () => { alive = false; clearTimeout(first); clearInterval(iv) }
  }, [])

  return null
}
