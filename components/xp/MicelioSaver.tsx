'use client'

import { useEffect, useRef } from 'react'
import { useOSSettings } from '@/components/OSSettingsContext'
import { crtDayColor, dayColorFlow } from '@/lib/weekdayColors'

// MICELIO — protector tipo Physarum (moho mucilaginoso). ~2000 agentes con UNA regla; la red emerge,
// se ramifica, encuentra atajos, nunca se repite. Mapa de rastro en BAJA RES (320×160) escalado a
// pantalla con imageSmoothingEnabled=false → píxeles chunky (estética + velocidad). Render POSTERIZADO
// en 6 escalones DUROS (ley de hard-steps del sistema); el escalón 0 es negro, los otros 5 son una
// rampa oscuro→brillante DERIVADA DEL COLOR DEL DÍA (misma fuente que el reloj: dayColorFlow + crt →
// en mono es fósforo). Un lunes tiene un organismo distinto al de un viernes.

const TW = 320, TH = 160           // resolución del mapa de rastro (bajar ESTO antes que los agentes)
const N = 2000                     // agentes
const SENSE_DIST = 9
const SENSE_ANG = 0.42
const TURN = 0.38
const SPEED = 0.95
const DEPOSIT = 1.15
const DECAY = 0.955
const STEPS = [0.06, 0.35, 0.9, 1.9, 3.6] as const   // 5 umbrales → 6 escalones

// Rampa de 5 tonos oscuro→brillante del color base (preserva el hue). El más brillante empuja un poco
// a blanco para un pico de "fósforo caliente".
function ramp(hex: string): [number, number, number][] {
  const n = hex.replace('#', '')
  const r = parseInt(n.slice(0, 2), 16), g = parseInt(n.slice(2, 4), 16), b = parseInt(n.slice(4, 6), 16)
  const f = [0.24, 0.44, 0.66, 0.86, 1.0]
  const white = 0.18
  return f.map((t, i) => {
    const wm = i === 4 ? white : 0
    return [
      Math.min(255, Math.round(r * t + 255 * wm)),
      Math.min(255, Math.round(g * t + 255 * wm)),
      Math.min(255, Math.round(b * t + 255 * wm)),
    ] as [number, number, number]
  })
}

export default function MicelioSaver() {
  const { crt } = useOSSettings()
  const ref = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const canvas = ref.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    // Buffer low-res offscreen (donde se dibuja el organismo antes de escalar chunky).
    const buf = document.createElement('canvas')
    buf.width = TW; buf.height = TH
    const bctx = buf.getContext('2d')!
    const img = bctx.createImageData(TW, TH)
    const pix = img.data

    // Color base = color del día, remapeado por CRT (mono → fósforo), igual que el reloj.
    const RAMP = ramp(crtDayColor(dayColorFlow(new Date()), crt))

    let trail = new Float32Array(TW * TH)
    let next = new Float32Array(TW * TH)

    // Sembrado UNIFORME: agentes repartidos por todo el campo → la red emerge y se ramifica (el disco
    // central colapsaba en una sola vena; uniforme teje la red Physarum de verdad). Cada arranque es
    // aleatorio → nunca se repite.
    const ax = new Float32Array(N), ay = new Float32Array(N), aa = new Float32Array(N)
    for (let i = 0; i < N; i++) {
      ax[i] = Math.random() * TW
      ay[i] = Math.random() * TH
      aa[i] = Math.random() * Math.PI * 2
    }

    const sample = (x: number, y: number): number => {
      const ix = x < 0 ? 0 : x >= TW ? TW - 1 : x | 0
      const iy = y < 0 ? 0 : y >= TH ? TH - 1 : y | 0
      return trail[iy * TW + ix]
    }

    let w = 1, h = 1
    function resize() {
      w = canvas!.clientWidth || window.innerWidth
      h = canvas!.clientHeight || window.innerHeight
      canvas!.width = w; canvas!.height = h
      ctx!.imageSmoothingEnabled = false   // píxeles chunky al escalar
    }
    resize()
    window.addEventListener('resize', resize)

    let raf = 0
    const step = () => {
      // 1) Agentes: olfatean 3, deciden, avanzan, depositan.
      for (let i = 0; i < N; i++) {
        const a = aa[i], x = ax[i], y = ay[i]
        const c = sample(x + Math.cos(a) * SENSE_DIST, y + Math.sin(a) * SENSE_DIST)
        const l = sample(x + Math.cos(a - SENSE_ANG) * SENSE_DIST, y + Math.sin(a - SENSE_ANG) * SENSE_DIST)
        const r = sample(x + Math.cos(a + SENSE_ANG) * SENSE_DIST, y + Math.sin(a + SENSE_ANG) * SENSE_DIST)
        let na = a
        if (c > l && c > r) { /* centro más fuerte → derecho */ }
        else if (c < l && c < r) { na = a + (Math.random() * 2 - 1) * TURN }   // centro más débil → giro al azar
        else if (l > r) na = a - TURN
        else na = a + TURN
        let nx = x + Math.cos(na) * SPEED
        let ny = y + Math.sin(na) * SPEED
        if (nx < 0 || nx >= TW || ny < 0 || ny >= TH) {   // rebote con ángulo aleatorio
          nx = nx < 0 ? 0 : nx >= TW ? TW - 1 : nx
          ny = ny < 0 ? 0 : ny >= TH ? TH - 1 : ny
          na = Math.random() * Math.PI * 2
        }
        ax[i] = nx; ay[i] = ny; aa[i] = na
        trail[(ny | 0) * TW + (nx | 0)] += DEPOSIT
      }

      // 2) Difusión (promedio 3×3) + decaimiento ×0.955.
      for (let y = 0; y < TH; y++) {
        for (let x = 0; x < TW; x++) {
          let s = 0
          for (let dy = -1; dy <= 1; dy++) {
            const yy = y + dy; if (yy < 0 || yy >= TH) continue
            for (let dx = -1; dx <= 1; dx++) {
              const xx = x + dx; if (xx < 0 || xx >= TW) continue
              s += trail[yy * TW + xx]
            }
          }
          next[y * TW + x] = (s / 9) * DECAY
        }
      }
      const tmp = trail; trail = next; next = tmp

      // 3) Render posterizado (6 escalones duros) al buffer low-res.
      for (let p = 0; p < TW * TH; p++) {
        const v = trail[p]
        const o = p * 4
        if (v < STEPS[0]) { pix[o] = 0; pix[o + 1] = 0; pix[o + 2] = 0; pix[o + 3] = 255; continue }
        const k = v < STEPS[1] ? 0 : v < STEPS[2] ? 1 : v < STEPS[3] ? 2 : v < STEPS[4] ? 3 : 4
        const c = RAMP[k]
        pix[o] = c[0]; pix[o + 1] = c[1]; pix[o + 2] = c[2]; pix[o + 3] = 255
      }
      bctx.putImageData(img, 0, 0)

      // 4) Escalar chunky a pantalla completa + scanlines sutiles (2px cada 4px, negro ~22%).
      ctx!.drawImage(buf, 0, 0, w, h)
      ctx!.fillStyle = 'rgba(0,0,0,0.22)'
      for (let y = 0; y < h; y += 4) ctx!.fillRect(0, y, w, 2)

      raf = requestAnimationFrame(step)
    }
    step()

    return () => { cancelAnimationFrame(raf); window.removeEventListener('resize', resize) }
  }, [crt])

  return <canvas ref={ref} style={{ display: 'block', width: '100%', height: '100%', background: '#000' }} />
}
