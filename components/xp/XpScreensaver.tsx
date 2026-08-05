'use client'

import { useEffect, useRef } from 'react'
import { WEEKDAY_RAINBOW } from '@/lib/weekdayColors'
import type { XpScreensaverKind } from '@/components/OSSettingsContext'

// Protectores de pantalla XP en canvas 2D. Reemplazan al tambor-screensaver bajo XP (regla
// "screensavers POR TEMA"). La paleta es el WEEKDAY_RAINBOW del OS (sin el off-white del domingo) →
// la firma cromática viaja al protector. rAF con cleanup; DPR-aware. El despertar lo maneja el
// detector de idle del contexto (cualquier actividad → screensaverActive=false → desmonta esto).
const PALETTE = WEEKDAY_RAINBOW.filter((c) => c.toLowerCase() !== '#e8ecff')

export default function XpScreensaver({ variant }: { variant: XpScreensaverKind }) {
  const ref = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const canvas = ref.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    let raf = 0
    let w = 1, h = 1
    function resize() {
      const dpr = Math.min(window.devicePixelRatio || 1, 2)
      w = canvas!.clientWidth || window.innerWidth
      h = canvas!.clientHeight || window.innerHeight
      canvas!.width = Math.round(w * dpr)
      canvas!.height = Math.round(h * dpr)
      ctx!.setTransform(dpr, 0, 0, dpr, 0, 0)
    }
    resize()
    window.addEventListener('resize', resize)

    const step = makeStep(variant, ctx, () => w, () => h)
    const loop = () => { step(); raf = requestAnimationFrame(loop) }
    loop()

    return () => { cancelAnimationFrame(raf); window.removeEventListener('resize', resize) }
  }, [variant])

  return <canvas ref={ref} style={{ display: 'block', width: '100%', height: '100%', background: '#000' }} />
}

type Ctx = CanvasRenderingContext2D
type Dim = () => number

function makeStep(variant: XpScreensaverKind, ctx: Ctx, W: Dim, H: Dim): () => void {
  if (variant === 'logo') return logo(ctx, W, H)
  return mystify(ctx, W, H)
}

// ── Mystify — polígono rebotando con estela que cicla el rainbow ────────────────
function mystify(ctx: Ctx, W: Dim, H: Dim): () => void {
  const VERTS = 5
  const SPEED = 2.4
  const TRAIL = 20
  let w = W(), h = H()
  const pts = Array.from({ length: VERTS }, () => ({
    x: Math.random() * w, y: Math.random() * h,
    vx: (Math.random() * 2 - 1) * SPEED, vy: (Math.random() * 2 - 1) * SPEED,
  }))
  const history: { x: number; y: number }[][] = []
  let tick = 0

  return () => {
    w = W(); h = H()
    for (const p of pts) {
      p.x += p.vx; p.y += p.vy
      if (p.x < 0) { p.x = 0; p.vx = Math.abs(p.vx) } else if (p.x > w) { p.x = w; p.vx = -Math.abs(p.vx) }
      if (p.y < 0) { p.y = 0; p.vy = Math.abs(p.vy) } else if (p.y > h) { p.y = h; p.vy = -Math.abs(p.vy) }
    }
    history.push(pts.map((p) => ({ x: p.x, y: p.y })))
    if (history.length > TRAIL) history.shift()

    ctx.fillStyle = '#000'
    ctx.fillRect(0, 0, w, h)
    ctx.lineWidth = 2
    ctx.lineJoin = 'round'
    const off = Math.floor(tick / 10)
    history.forEach((shape, i) => {
      ctx.globalAlpha = ((i + 1) / history.length) * 0.85
      ctx.strokeStyle = PALETTE[(i + off) % PALETTE.length]
      ctx.beginPath()
      shape.forEach((p, j) => (j === 0 ? ctx.moveTo(p.x, p.y) : ctx.lineTo(p.x, p.y)))
      ctx.closePath()
      ctx.stroke()
    })
    ctx.globalAlpha = 1
    tick++
  }
}

// ── Logo flotante — la bandera arcoíris del OS rebotando estilo "DVD" ───────────
function logo(ctx: Ctx, W: Dim, H: Dim): () => void {
  const LW = 300, LH = 190
  let w = W(), h = H()
  let x = Math.random() * Math.max(1, w - LW)
  let y = Math.random() * Math.max(1, h - LH)
  let vx = 1.7, vy = 1.35

  return () => {
    w = W(); h = H()
    ctx.fillStyle = '#000'
    ctx.fillRect(0, 0, w, h)

    x += vx; y += vy
    if (x < 0) { x = 0; vx = Math.abs(vx) } else if (x + LW > w) { x = w - LW; vx = -Math.abs(vx) }
    if (y < 0) { y = 0; vy = Math.abs(vy) } else if (y + LH > h) { y = h - LH; vy = -Math.abs(vy) }

    // Bandera: franjas horizontales del rainbow en un rect redondeado, con leve glow.
    const n = PALETTE.length
    const sh = LH / n
    ctx.save()
    ctx.shadowColor = 'rgba(0,0,0,0.5)'
    ctx.shadowBlur = 18
    roundRect(ctx, x, y, LW, LH, 10)
    ctx.clip()
    for (let i = 0; i < n; i++) {
      ctx.fillStyle = PALETTE[i]
      ctx.fillRect(x, y + i * sh, LW, Math.ceil(sh) + 1)
    }
    ctx.restore()

    // Wordmark
    ctx.save()
    ctx.font = '600 26px Tahoma, "Segoe UI", sans-serif'
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.fillStyle = '#fff'
    ctx.shadowColor = 'rgba(0,0,0,0.55)'
    ctx.shadowBlur = 6
    ctx.fillText('personal·os', x + LW / 2, y + LH / 2)
    ctx.restore()
  }
}

function roundRect(ctx: Ctx, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath()
  ctx.moveTo(x + r, y)
  ctx.arcTo(x + w, y, x + w, y + h, r)
  ctx.arcTo(x + w, y + h, x, y + h, r)
  ctx.arcTo(x, y + h, x, y, r)
  ctx.arcTo(x, y, x + w, y, r)
  ctx.closePath()
}
