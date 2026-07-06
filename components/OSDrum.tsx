'use client'

import { useEffect, useRef, useState, type ReactNode } from 'react'
import { useRouter } from 'next/navigation'

export type OSSection = { label: string; color: string; href: string; content?: ReactNode }

/* ─────────── PERILLAS DE FEEL (idénticas al prototipo afinado) ─────────── */
const RADIUS_MULT      = 4.5   // tamaño del tambor (× alto de pantalla). MÁS = más aire entre secciones
const PITCH_DEG        = 16    // grados entre secciones
const PERSP_MULT       = 1.4   // perspectiva (× alto)
const DRAG_SENS        = 0.11  // seguimiento del arrastre
const STIFFNESS        = 0.009 // resorte del glide. Menos = más lento y suave
const DAMP             = 0.78  // amortiguación. Menos = frena más (sin rebote)
const STEP_COOLDOWN    = 150   // ms entre clics de la rueda (1 notch = 1 sub-paso)
const STEPS_PER_SCREEN = 4     // clics para cruzar una sección. Más = menos sensible
const WHEEL_THRESHOLD   = 40    // cuánto hay que rodar para que "haga clic" un paso. MÁS = menos sensible
/* ─────────────────────────────────────────────────────────────────────── */

const SLOTS = [-2, -1, 0, 1, 2]
const mod = (a: number, n: number) => ((a % n) + n) % n

function darken(hex: string, f: number) {
  const n = parseInt(hex.slice(1), 16)
  return `rgb(${Math.round(((n >> 16) & 255) * f)},${Math.round(((n >> 8) & 255) * f)},${Math.round((n & 255) * f)})`
}

function Ship({ color, px = 78 }: { color: string; px?: number }) {
  const dark = darken(color, 0.55), win = '#8fd7ff', light = '#ffffff'
  const R = (x: number, y: number, w: number, h: number, f: string) => <rect x={x} y={y} width={w} height={h} fill={f} />
  return (
    <svg width={px} height={px * 1.17} viewBox="0 0 12 14" style={{ imageRendering: 'pixelated', shapeRendering: 'crispEdges', display: 'block' }}>
      {R(5, 0, 2, 2, light)}{R(4, 2, 4, 2, color)}{R(3, 4, 6, 5, color)}{R(5, 4, 2, 2, win)}
      {R(2, 6, 1, 3, dark)}{R(9, 6, 1, 3, dark)}{R(1, 7, 1, 3, dark)}{R(10, 7, 1, 3, dark)}
      {R(3, 9, 6, 1, dark)}{R(4, 10, 4, 1, dark)}
      <g style={{ animation: 'os-flame .5s steps(2) infinite' }}>{R(5, 11, 2, 1, '#ffd24a')}{R(5, 12, 2, 1, '#ff8a3a')}{R(5, 13, 1, 1, '#ff5a2a')}</g>
    </svg>
  )
}

export default function OSDrum({ sections }: { sections: OSSection[] }) {
  const N = sections.length
  const router = useRouter()

  const sceneRef = useRef<HTMLDivElement>(null)
  const deckRef = useRef<HTMLDivElement>(null)
  const faceRefs = useRef<(HTMLDivElement | null)[]>([])
  const dotRefs = useRef<(HTMLDivElement | null)[]>([])
  const dotRefsR = useRef<(HTMLDivElement | null)[]>([])
  const contentRefs = useRef<(HTMLDivElement | null)[]>([])
  const [center, setCenter] = useState(0)

  const rot = useRef(0)
  const vel = useRef(0)
  const target = useRef(0)
  const dragging = useRef(false)
  const moved = useRef(false)
  const lastY = useRef(0)
  const lastStep = useRef(0)
  const accum = useRef(0)
  const centerRef = useRef(0)

  useEffect(() => {
    const scene = sceneRef.current!
    let H = window.innerHeight
    let R = H * RADIUS_MULT
    let raf = 0
    const SUBSTEP = PITCH_DEG / STEPS_PER_SCREEN
    scene.style.perspective = (H * PERSP_MULT) + 'px'

    const onResize = () => { H = window.innerHeight; R = H * RADIUS_MULT; scene.style.perspective = (H * PERSP_MULT) + 'px' }

    const render = () => {
      const c = Math.round(rot.current / PITCH_DEG)
      if (c !== centerRef.current) { centerRef.current = c; setCenter(c) }
      if (deckRef.current) deckRef.current.style.transform = `translateZ(${-R}px)`
      SLOTS.forEach((slot, k) => {
        const el = faceRefs.current[k]; if (!el) return
        const absIdx = c + slot
        const sec = sections[mod(absIdx, N)]
        const net = absIdx * PITCH_DEG - rot.current
        el.style.transform = `rotateX(${net}deg) translateZ(${R}px)`
        const a = Math.abs(net)
        el.style.opacity = String(a > PITCH_DEG * 2.6 ? 0 : Math.max(0.06, 1 - (a / (PITCH_DEG * 2)) * 0.92))
        el.style.zIndex = String(100 - Math.round(a))
        el.style.pointerEvents = (!sec.content && a < PITCH_DEG * 0.5) ? 'auto' : 'none'

        const near = Math.max(0, 1 - a / (PITCH_DEG * 2.5))
        const dTransform = `rotateX(${net}deg) translateZ(120px) scale(${0.9 + near * 0.3})`
        const dOpacity = String(a > PITCH_DEG * 2.6 ? 0 : 0.22 + near * 0.78)
        const dShadow = near > 0.45 ? `0 0 ${5 + near * 12}px ${sec.color}, 0 0 3px ${sec.color}` : 'none'
        for (const dot of [dotRefs.current[k], dotRefsR.current[k]]) {
          if (!dot) continue
          dot.style.background = sec.color
          dot.style.transform = dTransform
          dot.style.opacity = dOpacity
          dot.style.boxShadow = dShadow
        }
      })

      sections.forEach((sec, i) => {
        if (!sec.content) return
        const el = contentRefs.current[i]; if (!el) return
        const X = i + N * Math.round((rot.current / PITCH_DEG - i) / N)
        const net = X * PITCH_DEG - rot.current
        const a = Math.abs(net)
        el.style.transform = `rotateX(${net}deg) translateZ(${R}px)`
        el.style.opacity = String(a >= PITCH_DEG * 0.75 ? 0 : a <= PITCH_DEG * 0.5 ? 1 : 1 - (a - PITCH_DEG * 0.5) / (PITCH_DEG * 0.25))
        el.style.zIndex = String(200 - Math.round(a))
        el.style.pointerEvents = a < PITCH_DEG * 0.6 ? 'auto' : 'none'
      })
    }

    const tick = () => {
      if (!dragging.current) {
        vel.current += (target.current - rot.current) * STIFFNESS
        vel.current *= DAMP
        rot.current += vel.current
      }
      render()
      raf = requestAnimationFrame(tick)
    }

    const onWheel = (e: WheelEvent) => {
      const face = (e.target as HTMLElement)?.closest?.('.os-cface') as HTMLElement | null
      if (face) {
        let node: HTMLElement | null = e.target as HTMLElement
        while (node && node !== face.parentElement) {
          const oy = getComputedStyle(node).overflowY
          if ((oy === 'auto' || oy === 'scroll') && node.scrollHeight > node.clientHeight) return
          node = node.parentElement
        }
      }
      e.preventDefault()
      const now = performance.now()
      accum.current += e.deltaY
      if (Math.abs(accum.current) < WHEEL_THRESHOLD) return   // detente: ignora micro-movimientos
      if (now - lastStep.current < STEP_COOLDOWN) { accum.current = 0; return }
      const dir = accum.current > 0 ? -1 : 1
      accum.current = 0
      lastStep.current = now
      if (dir * vel.current < 0) vel.current = 0   // reverso: mata el látigo del momentum
      target.current += dir * SUBSTEP
    }
    const onDown = (e: PointerEvent) => {
      if ((e.target as HTMLElement)?.closest?.('.os-cface')) return   // no secuestres el puntero sobre contenido interactivo
      dragging.current = true; moved.current = false; lastY.current = e.clientY; vel.current = 0; scene.setPointerCapture(e.pointerId)
    }
    const onMove = (e: PointerEvent) => {
      if (!dragging.current) return
      const dy = e.clientY - lastY.current
      if (Math.abs(dy) > 2) moved.current = true
      rot.current -= dy * DRAG_SENS; lastY.current = e.clientY
    }
    const onUp = () => { if (!dragging.current) return; dragging.current = false; target.current = Math.round(rot.current / SUBSTEP) * SUBSTEP }
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'ArrowDown') target.current = (Math.round(rot.current / PITCH_DEG) - 1) * PITCH_DEG
      if (e.key === 'ArrowUp')   target.current = (Math.round(rot.current / PITCH_DEG) + 1) * PITCH_DEG
    }

    window.addEventListener('resize', onResize)
    scene.addEventListener('wheel', onWheel, { passive: false })
    scene.addEventListener('pointerdown', onDown)
    scene.addEventListener('pointermove', onMove)
    scene.addEventListener('pointerup', onUp)
    scene.addEventListener('pointercancel', onUp)
    window.addEventListener('keydown', onKey)
    tick()

    return () => {
      cancelAnimationFrame(raf)
      window.removeEventListener('resize', onResize)
      scene.removeEventListener('wheel', onWheel)
      scene.removeEventListener('pointerdown', onDown)
      scene.removeEventListener('pointermove', onMove)
      scene.removeEventListener('pointerup', onUp)
      scene.removeEventListener('pointercancel', onUp)
      window.removeEventListener('keydown', onKey)
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div ref={sceneRef} className="os-scene">
      <style>{`
        .os-scene { position: fixed; inset: 0; overflow: hidden; z-index: 1; }
        .os-deck { position: absolute; inset: 0; transform-style: preserve-3d; will-change: transform; transition: opacity .3s ease; }
        .os-face { position: absolute; inset: 0; transform-style: preserve-3d; -webkit-backface-visibility: hidden; backface-visibility: hidden;
          display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 24px; text-align: center; cursor: pointer; will-change: transform, opacity; }
        .os-face--live { cursor: default; }
        .os-cface { position: absolute; inset: 0; transform-style: preserve-3d; -webkit-backface-visibility: hidden; backface-visibility: hidden; overflow-y: auto; overflow-x: hidden; will-change: transform, opacity; }
        .os-cface, .os-cface * { backdrop-filter: none !important; -webkit-backdrop-filter: none !important; }
        .os-sub { font-size: 12px; letter-spacing: .28em; text-transform: uppercase; color: var(--color-ink-3); }
        .os-name { font-size: 44px; font-weight: 700; }
        .os-body { width: min(560px, 80vw); margin-top: 4px; text-align: left; display: flex; flex-direction: column; gap: 14px; }
        .os-lead { font-size: 16px; line-height: 1.5; color: var(--color-ink-4); }
        .os-para { font-size: 13px; line-height: 1.7; color: var(--color-ink-3); }
        .os-enter { margin-top: 6px; font-size: 12px; letter-spacing: .12em; text-transform: uppercase; color: var(--color-ink-3); }
        .os-dots { position: fixed; top: 50%; transform: translateY(-50%); z-index: 3; width: 18px; height: 300px; perspective: 420px; pointer-events: none; }
        .os-dots.left { left: 26px; }
        .os-dots.right { right: 26px; }
        .os-dots-deck { position: absolute; inset: 0; transform-style: preserve-3d; transform: translateZ(-120px); }
        .os-dots i { position: absolute; left: 50%; top: 50%; width: 7px; height: 7px; margin: -3.5px 0 0 -3.5px; image-rendering: pixelated; will-change: transform, opacity; }
        .os-kicker { position: fixed; top: 24px; left: 0; right: 0; text-align: center; z-index: 3; font-size: 11px; letter-spacing: .3em; text-transform: uppercase; color: var(--color-ink-3); pointer-events: none; }
        .os-vig { position: fixed; left: 0; right: 0; height: 30vh; z-index: 2; pointer-events: none; }
        .os-vig.top { top: 0; background: linear-gradient(var(--color-ink-0), transparent); }
        .os-vig.bot { bottom: 0; background: linear-gradient(0deg, var(--color-ink-0), transparent); }
        .os-flat { position: fixed; inset: 0; z-index: 2; overflow: hidden; display: flex; align-items: center; justify-content: center; animation: os-fadein .3s ease; }
        @keyframes os-fadein { from { opacity: 0 } to { opacity: 1 } }
        @keyframes os-flame { 0%,100%{ opacity:.5 } 50%{ opacity:1 } }
      `}</style>

      <div ref={deckRef} className="os-deck">
        {SLOTS.map((slot, k) => {
          const sec = sections[mod(center + slot, N)]
          return (
            <div
              key={k}
              ref={el => { faceRefs.current[k] = el }}
              className="os-face"
              onClick={sec.content ? undefined : () => { if (!moved.current) router.push(sec.href) }}
            >
              {!sec.content && (
                <>
                  <div style={{ filter: `drop-shadow(0 0 16px ${sec.color}) drop-shadow(0 0 4px ${sec.color})` }}>
                    <Ship color={sec.color} />
                  </div>
                  <div className="os-name" style={{ color: sec.color, textShadow: `0 0 28px ${sec.color}44` }}>{sec.label}</div>
                </>
              )}
            </div>
          )
        })}
        {sections.map((sec, i) => sec.content ? (
          <div key={`c${i}`} ref={el => { contentRefs.current[i] = el }} className="os-cface">
            {sec.content}
          </div>
        ) : null)}
      </div>

      <div className="os-dots left">
        <div className="os-dots-deck">
          {SLOTS.map((_, k) => (
            <i key={k} ref={el => { dotRefs.current[k] = el }} />
          ))}
        </div>
      </div>
      <div className="os-dots right">
        <div className="os-dots-deck">
          {SLOTS.map((_, k) => (
            <i key={`r${k}`} ref={el => { dotRefsR.current[k] = el }} />
          ))}
        </div>
      </div>

      <div className="os-kicker">Personal OS · rueda / arrastra / ↑ ↓</div>
      <div className="os-vig top" />
      <div className="os-vig bot" />
    </div>
  )
}
