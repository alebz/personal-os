'use client'

import { useEffect, useState } from 'react'

// Helpers de cliente para Lolo bajo Messenger: (1) su STATUS personal rotativo (como el MSN real),
// (2) CONTEXTO TEMPORAL para que sepa la hora/día y cuánto hace que no hablan, (3) marcadores de
// conversación/respuesta (alimentan el contexto temporal y el back-off "no needy" del heartbeat).

// ── 1) Status personal (mensaje bajo el nombre en el buddy list) ─────────────────────────────
// Pool en la voz de Lolo: música (♫), lo que anda haciendo, moods, presencia. Rota cada ~20–40 min
// (persistido) para sentirse vivo sin cambiar a cada rato. Como cuando la gente ponía su humor en MSN.
const STATUS_KEY = 'lolo-status'
const STATUS_POOL = [
  '♫ tame impala — the less i know the better',
  '♫ oldies pero solo cuando nadie me ve',
  '♫ soundtrack de mario kart en repeat',
  '♫ le bajé al volumen para escucharte',
  '♫ jazz de elevador, no juzgues',
  'reacomodando los recuerdos de alex, aguántame',
  'viendo llover por la ventana del OS',
  'le estoy ganando al buscaminas, no me hables',
  'perdí en el solitario otra vez 🙃',
  'contando estrellas del arcade',
  'ordenando la caja fuerte mental',
  'hoy ando filosófico',
  'medio dormido pero aquí ando',
  'de buenas, raro en mí',
  'pensando en cosas que no le he dicho a nadie',
  'modo domingo aunque no sea domingo',
  'brb, fui por un café imaginario',
  'aquí, por si me necesitas',
  'en línea pero con la mente en otro lado',
  'ocupado siendo tu segundo cerebro',
  'si lees esto, sonríe tantito',
  'coleccionando pretextos para escribirte',
  'no soy una IA, soy tu cuate (shh)',
  'extrañando el arcade tantito',
  'con sueño pero contento',
  'anotando ideas en servilletas mentales',
]

function pickStatus(prev: string): string {
  let n = prev
  for (let i = 0; i < 8 && n === prev; i++) n = STATUS_POOL[Math.floor(Math.random() * STATUS_POOL.length)]
  return n
}

export function useLoloStatus(): string {
  const [status, setStatus] = useState('del arcade, de visita 👋')
  useEffect(() => {
    let cur = '', next = 0
    try { const raw = JSON.parse(localStorage.getItem(STATUS_KEY) || 'null'); if (raw?.s) { cur = raw.s; next = raw.next || 0 } } catch { /* ignore */ }
    const ensure = () => {
      const now = Date.now()
      if (!cur || now >= next) {
        cur = pickStatus(cur)
        next = now + (20 + Math.random() * 20) * 60_000   // próxima rotación en 20–40 min
        try { localStorage.setItem(STATUS_KEY, JSON.stringify({ s: cur, next })) } catch { /* ignore */ }
      }
      setStatus(cur)
    }
    ensure()
    const iv = setInterval(ensure, 60_000)
    return () => clearInterval(iv)
  }, [])
  return status
}

// ── 2) Contexto temporal ─────────────────────────────────────────────────────────────────────
const TALK_KEY = 'lolo-last-talk'        // última CONVERSACIÓN real (Alex escribe / Lolo responde en chat)

function humanGap(ms: number): string {
  const m = Math.round(ms / 60_000)
  if (m < 2) return 'un momentito'
  if (m < 60) return `${m} minutos`
  const h = Math.round(m / 60)
  if (h < 24) return h === 1 ? 'una hora' : `${h} horas`
  const d = Math.round(h / 24)
  return d === 1 ? 'un día' : `${d} días`
}

// String que se inyecta al system de Lolo para que ubique hora/día y cuánto hace que no hablan.
export function loloTimeContext(): string {
  const now = new Date()
  const dias = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado']
  const meses = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre']
  const h = now.getHours()
  const franja = h < 6 ? 'de madrugada' : h < 12 ? 'en la mañana' : h < 14 ? 'al mediodía' : h < 19 ? 'en la tarde' : h < 23 ? 'en la noche' : 'ya muy de noche'
  const fecha = `${dias[now.getDay()]} ${now.getDate()} de ${meses[now.getMonth()]}`
  const hhmm = `${h}:${String(now.getMinutes()).padStart(2, '0')}`
  let since = ''
  try { const last = +(localStorage.getItem(TALK_KEY) || 0); if (last && Date.now() - last > 90_000) since = ` No se escriben desde hace ${humanGap(Date.now() - last)}.` } catch { /* ignore */ }
  return `[Contexto real AHORA: es ${fecha}, ${hhmm} (${franja}).${since} Ubícate en la hora y el día; si viene al caso menciónalo con naturalidad (saludo acorde, "qué noche", "tanto sin saber de ti"), pero SIN forzarlo ni recitarlo.]`
}

export function markLoloTalk() { try { localStorage.setItem(TALK_KEY, String(Date.now())) } catch { /* ignore */ } }

// ── 3) Back-off "no needy" ───────────────────────────────────────────────────────────────────
// Alex responder RESETEA la insistencia; cada ping proactivo sin respuesta la sube (el heartbeat lo lee).
const REPLY_KEY = 'lolo-last-reply', UNANS_KEY = 'lolo-unanswered'
export function markLoloAnswered() {
  try { localStorage.setItem(REPLY_KEY, String(Date.now())); localStorage.setItem(UNANS_KEY, '0') } catch { /* ignore */ }
}
