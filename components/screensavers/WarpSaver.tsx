'use client'

/**
 * WarpSaver — protector de pantalla "vuelo espacial".
 *
 * Port EXACTO del prototipo aprobado. No re-implementar: montar tal cual.
 *
 * Qué hace:
 *  - Campo estelar en perspectiva real (x/z) con punto de fuga que se desplaza
 *    con el timón → el centro se ve de frente, las orillas de costado.
 *  - Fondo profundo fijo (no se mueve con la velocidad, solo al girar).
 *  - Polvo cercano con estela permanente (vende la velocidad).
 *  - Asteroides poligonales angulares (11–16 caras, con púas y hendiduras),
 *    con dos niveles de detalle: sprite lejos, píxeles nativos de cerca.
 *  - Planetas texturizados proyectados sobre la esfera, con rotación axial,
 *    gigantes gaseosos con bandas + tormenta, y anillos con sombra del planeta.
 *  - Estrella local por sector: a veces fuera de cuadro, siempre manda sobre
 *    la iluminación de todo lo demás.
 *  - Sectores generados al azar (gigante / anillos / cinturón / vacío /
 *    binario / gigante gaseoso) y galaxia espiral en ~45% de ellos.
 *  - Hiperviaje cada 5–9 min: solo las estrellas se encienden, y al salir
 *    estás en un sector nuevo (el destello esconde el cambio de galaxia).
 *  - HUD pegado al borde: fecha, hora, velocidad, oxígeno, mira en el punto
 *    de fuga y carga del hiperimpulsor.
 *  - Easter egg raro: una nave que cruza con estela (o, 1 de cada 3, otra cosa).
 *
 * MONOCOLOR: toda la escena usa una rampa de 8 niveles derivada de `color`.
 * Cambiar `color` tiñe el protector completo, igual que el selector del CRT.
 */

import { useEffect, useRef } from 'react'

export interface WarpSaverProps {
  /** Color base del monocolor (nivel 5 de la rampa). Default: ámbar de fósforo. */
  color?: string
  /** Escala de píxel. Entero. Más alto = píxeles más gordos. Default 3. */
  pixelScale?: number
  /** Intensidad de las scanlines, 0 = ninguna. Default 0.24. */
  scanlines?: number
  className?: string
}

/** Construye la rampa de 8 niveles a partir del color base (nivel 5). */
function buildRamp(base: string): string[] {
  const hex = base.replace('#', '')
  const r = parseInt(hex.slice(0, 2), 16)
  const g = parseInt(hex.slice(2, 4), 16)
  const b = parseInt(hex.slice(4, 6), 16)
  const dark = [0, 0.125, 0.26, 0.47, 0.71, 1.0]
  const out = dark.map((t) => {
    const c = (v: number) => Math.round(v * t)
    return `rgb(${c(r)},${c(g)},${c(b)})`
  })
  const lift = (t: number) => {
    const c = (v: number) => Math.round(v + (255 - v) * t)
    return `rgb(${c(r)},${c(g)},${c(b)})`
  }
  out.push(lift(0.34)) // 6 — brillo alto
  out.push(lift(0.82)) // 7 — la estrella local (más brillante que cualquier planeta)
  return out
}

export default function WarpSaver({
  color = '#e8951c',
  pixelScale = 3,
  scanlines = 0.24,
  className,
}: WarpSaverProps) {
  const ref = useRef<HTMLCanvasElement | null>(null)

  useEffect(() => {
    const cv = ref.current
    if (!cv) return
    const ctx = cv.getContext('2d')
    if (!ctx) return

    const L = buildRamp(color)
    const SC = Math.max(1, Math.floor(pixelScale))

    // Resolución interna: el viewport dividido por la escala de píxel.
    let W = Math.max(160, Math.floor(window.innerWidth / SC))
    let H = Math.max(90, Math.floor(window.innerHeight / SC))

    const off = document.createElement('canvas')
    let o = off.getContext('2d')!

    const sizeUp = () => {
      W = Math.max(160, Math.floor(window.innerWidth / SC))
      H = Math.max(90, Math.floor(window.innerHeight / SC))
      off.width = W
      off.height = H
      o = off.getContext('2d')!
      o.imageSmoothingEnabled = false
      cv.width = W * SC
      cv.height = H * SC
      ctx.imageSmoothingEnabled = false
    }
    sizeUp()

    const F = (x: number, y: number, w: number, h: number, l: number) => {
      if (w <= 0 || h <= 0) return
      o.fillStyle = L[l]
      o.fillRect(x | 0, y | 0, w | 0, h | 0)
    }
    const P = (x: number, y: number, l: number) => {
      x |= 0
      y |= 0
      if (x < 0 || y < 0 || x >= W || y >= H) return
      o.fillStyle = L[l]
      o.fillRect(x, y, 1, 1)
    }
    const hsh = (a: number, b: number, s: number) => {
      const n = Math.sin(a * 12.9898 + b * 78.233 + s * 43.11) * 43758.5453
      return n - Math.floor(n)
    }
    const ih = (x: number, y: number, s: number) => {
      let n = (x * 374761393 + y * 668265263 + s * 1442695040) | 0
      n = ((n ^ (n >> 13)) * 1274126177) | 0
      return ((n ^ (n >> 16)) >>> 0) / 4294967296
    }

    // Fuente de 3×5 px dibujada a mano (dígitos + separadores del HUD).
    const FN: Record<string, number[]> = {
      '0': [7, 5, 5, 5, 7], '1': [2, 6, 2, 2, 7], '2': [7, 1, 7, 4, 7],
      '3': [7, 1, 3, 1, 7], '4': [5, 5, 7, 1, 1], '5': [7, 4, 7, 1, 7],
      '6': [7, 4, 7, 5, 7], '7': [7, 1, 1, 1, 1], '8': [7, 5, 7, 5, 7],
      '9': [7, 5, 7, 1, 7], '.': [0, 0, 0, 0, 2], ':': [0, 2, 0, 2, 0],
      '%': [5, 1, 2, 4, 5], ' ': [0, 0, 0, 0, 0],
    }
    const TXT = (x: number, y: number, s: string, l: number) => {
      for (let i = 0; i < s.length; i++) {
        const g = FN[s[i]] || FN[' ']
        for (let r = 0; r < 5; r++) {
          const b = g[r]
          if (b & 4) P(x + i * 4, y + r, l)
          if (b & 2) P(x + i * 4 + 1, y + r, l)
          if (b & 1) P(x + i * 4 + 2, y + r, l)
        }
      }
    }

    const FOV = 78, SPREAD = 1.65, FR = 12

    // ── Asteroide: polígono de 11–16 caras, cada cara con su propia normal ──
    interface RockModel {
      fr: HTMLCanvasElement[]; N: number
      nx: number[]; ny: number[]; dd: number[]
      lvOf: (k: number, lx: number, ly: number) => number
      sd: number
    }
    const makeRock = (sd: number): RockModel => {
      const N = 11 + ((Math.random() * 6) | 0)
      const ang: number[] = [], rad: number[] = []
      for (let i = 0; i < N; i++) {
        ang.push((i / N) * 6.2832 + (Math.random() - 0.5) * (5.0 / N))
        rad.push(0.34 + Math.random() * 0.52)
      }
      const sk = 1 + ((Math.random() * 3) | 0)
      for (let s = 0; s < sk; s++) rad[(Math.random() * N) | 0] = 0.9 + Math.random() * 0.1
      for (let s = 0; s < sk; s++) rad[(Math.random() * N) | 0] = 0.3 + Math.random() * 0.1
      const nx: number[] = [], ny: number[] = [], dd: number[] = []
      for (let e = 0; e < N; e++) {
        const a0 = ang[e], a1 = ang[(e + 1) % N], r0 = rad[e], r1 = rad[(e + 1) % N]
        const x0 = Math.cos(a0) * r0, y0 = Math.sin(a0) * r0
        const x1 = Math.cos(a1) * r1, y1 = Math.sin(a1) * r1
        const ex = x1 - x0, ey = y1 - y0
        const ln = Math.sqrt(ex * ex + ey * ey) || 1
        let vx = ey / ln, vy = -ex / ln
        if (vx * (x0 + x1) + vy * (y0 + y1) < 0) { vx = -vx; vy = -vy }
        nx.push(vx); ny.push(vy); dd.push(vx * x0 + vy * y0)
      }
      const lvOf = (k: number, lx: number, ly: number) => {
        const dp = nx[k] * lx + ny[k] * ly
        return dp < -0.74 ? 5 : dp < -0.4 ? 4 : dp < -0.02 ? 3 : dp < 0.44 ? 2 : 1
      }
      const fr: HTMLCanvasElement[] = []
      for (let f = 0; f < FR; f++) {
        const S = 40, C = S / 2
        const c = document.createElement('canvas'); c.width = S; c.height = S
        const g = c.getContext('2d')!
        const rot = (f * 6.2832) / FR, cs = Math.cos(-rot), sn = Math.sin(-rot)
        for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) {
          const px = (x - C + 0.5) / (C - 1), py = (y - C + 0.5) / (C - 1)
          const lx = px * cs - py * sn, ly = px * sn + py * cs
          let out = false, best = -9, bi = 0
          for (let k = 0; k < N; k++) {
            const s2 = nx[k] * lx + ny[k] * ly - dd[k]
            if (s2 > 0) { out = true; break }
            if (s2 > best) { best = s2; bi = k }
          }
          if (out) continue
          let lv = lvOf(bi, 0.72, 0.55)
          const nz = hsh(Math.floor(lx * 9), Math.floor(ly * 9), sd + bi)
          if (nz > 0.86) lv = Math.min(6, lv + 1)
          else if (nz < 0.13) lv = Math.max(1, lv - 1)
          if (best > -0.07) lv = Math.max(1, lv - 1)
          g.fillStyle = L[lv]; g.fillRect(x, y, 1, 1)
        }
        fr.push(c)
      }
      return { fr, N, nx, ny, dd, lvOf, sd }
    }

    /** Dibujo de cerca: píxeles nativos, recortado a pantalla, sin trigonometría. */
    const drawRockHi = (m: RockModel, kx: number, ky: number, kr: number, rot: number, lx: number, ly: number) => {
      const cs = Math.cos(-rot), sn = Math.sin(-rot)
      const rlx = lx * cs - ly * sn, rly = lx * sn + ly * cs
      const xA = Math.max(-kr, -kx - 1), xB = Math.min(kr, W - kx + 1)
      const yA = Math.max(-kr, -ky - 1), yB = Math.min(kr, H - ky + 1)
      for (let qy = yA; qy <= yB; qy++) for (let qx = xA; qx <= xB; qx++) {
        const px = qx / kr, py = qy / kr
        if (px * px + py * py > 1.08) continue
        const ax = px * cs - py * sn, ay = px * sn + py * cs
        let out = false, best = -9, bi = 0
        for (let k = 0; k < m.N; k++) {
          const s2 = m.nx[k] * ax + m.ny[k] * ay - m.dd[k]
          if (s2 > 0) { out = true; break }
          if (s2 > best) { best = s2; bi = k }
        }
        if (out) continue
        let lv = m.lvOf(bi, rlx, rly)
        const n1 = ih(Math.floor(ax * 46), Math.floor(ay * 46), m.sd | 0)
        const n2 = ih(Math.floor(ax * 150), Math.floor(ay * 150), (m.sd * 3) | 0)
        const n3 = ih(Math.floor(ax * 420), Math.floor(ay * 420), (m.sd * 7) | 0)
        if (n1 > 0.83) lv = Math.min(6, lv + 1); else if (n1 < 0.15) lv = Math.max(1, lv - 1)
        if (n2 > 0.9) lv = Math.min(6, lv + 1); else if (n2 < 0.08) lv = Math.max(1, lv - 1)
        if (kr > 60) { if (n3 > 0.93) lv = Math.min(6, lv + 1); else if (n3 < 0.06) lv = Math.max(1, lv - 1) }
        if (best > -0.035) lv = Math.max(1, lv - 1)
        if (best > -0.012) lv = Math.max(1, lv - 1)
        P(kx + qx, ky + qy, lv)
      }
    }

    // ── Sprites del easter egg ──
    const ship = (() => {
      const c = document.createElement('canvas'); c.width = 26; c.height = 14
      const g = c.getContext('2d')!
      const pp = (x: number, y: number, l: number) => { g.fillStyle = L[l]; g.fillRect(x, y, 1, 1) }
      for (let x = 4; x < 22; x++) {
        const t = (x - 4) / 17, hg = Math.round(1 + 3.2 * Math.sin(t * 3.14159))
        for (let y = 7 - hg; y <= 7 + hg; y++) pp(x, y, y < 7 ? 4 : y > 7 + hg - 1 ? 2 : 3)
      }
      for (let x = 22; x < 25; x++) pp(x, 7, 5)
      pp(25, 7, 4)
      for (let w = 8; w < 17; w++) {
        const s = Math.round((w - 8) * 0.55)
        pp(w, 7 - 3 - s, 3); pp(w, 7 - 4 - s, 2); pp(w, 7 + 3 + s, 3); pp(w, 7 + 4 + s, 2)
      }
      pp(18, 6, 6); pp(19, 6, 6); pp(18, 7, 5); pp(19, 7, 5)
      for (let e = 0; e < 3; e++) { pp(3 - e, 6, e === 0 ? 6 : 4); pp(3 - e, 8, e === 0 ? 6 : 4); pp(3 - e, 7, e === 0 ? 6 : 5) }
      return c
    })()

    const cat = (() => {
      const c = document.createElement('canvas'); c.width = 15; c.height = 15
      const g = c.getContext('2d')!
      const pp = (x: number, y: number, l: number) => { g.fillStyle = L[l]; g.fillRect(x, y, 1, 1) }
      for (let a = 0; a < 6.2832; a += 0.09) pp((7 + Math.cos(a) * 5.6) | 0, (6 + Math.sin(a) * 5.6) | 0, 5)
      for (let y = 1; y < 12; y++) for (let x = 1; x < 13; x++) {
        const dx = x - 7, dy = y - 6
        if (dx * dx + dy * dy < 26) pp(x, y, 1)
      }
      pp(4, 3, 4); pp(5, 2, 4); pp(6, 3, 4); pp(8, 3, 4); pp(9, 2, 4); pp(10, 3, 4)
      pp(5, 6, 6); pp(9, 6, 6); pp(7, 8, 4); pp(6, 9, 3); pp(8, 9, 3)
      for (let x = 5; x < 10; x++) pp(x, 12, 3)
      pp(4, 13, 3); pp(10, 13, 3); pp(7, 14, 2)
      return c
    })()

    // ── Fondo profundo: estrellas que NO se mueven con la velocidad ──
    let deep = document.createElement('canvas')
    const buildDeep = () => {
      deep = document.createElement('canvas')
      deep.width = W + 80; deep.height = H + 60
      const d = deep.getContext('2d')!
      const n = Math.round(((W * H) / (400 * 173)) * 640)
      for (let i = 0; i < n; i++) {
        const x = Math.random() * deep.width, y = Math.random() * deep.height, q = Math.random()
        d.fillStyle = L[q > 0.94 ? 3 : q > 0.72 ? 2 : 1]
        d.fillRect(x | 0, y | 0, 1, 1)
      }
    }
    buildDeep()

    interface Star { x: number; y: number; z: number; mag: number }
    const st: Star[] = []
    const seed = (s: Star, near: boolean) => {
      const z = near ? 0.12 + Math.random() * 4.2 : 3.6 + Math.random() * 0.8
      s.z = z
      s.x = (Math.random() - 0.5) * 2 * SPREAD * z
      s.y = (Math.random() - 0.5) * 2 * SPREAD * 0.62 * z
      s.mag = Math.pow(Math.random(), 3.2)
      return s
    }
    for (let i = 0; i < 300; i++) st.push(seed({} as Star, true))

    interface Dust { x: number; y: number; z: number }
    const dust: Dust[] = []
    const dseed = (d: Dust) => {
      d.z = 0.08 + Math.random() * 0.9
      d.x = (Math.random() - 0.5) * 2 * SPREAD * d.z
      d.y = (Math.random() - 0.5) * 2 * SPREAD * 0.62 * d.z
      return d
    }
    for (let i = 0; i < 130; i++) dust.push(dseed({} as Dust))

    const makeGal = (sd: number) => {
      const gw = 110, gh = 64
      const gc = document.createElement('canvas'); gc.width = gw; gc.height = gh
      const g = gc.getContext('2d')!
      const mr = gw * 0.46, tilt = 0.34 + Math.random() * 0.2
      const arms = Math.random() < 0.5 ? 2 : 3
      for (let y = 0; y < gh; y++) for (let x = 0; x < gw; x++) {
        const dx = x - gw / 2, dy = (y - gh / 2) / tilt
        const r = Math.sqrt(dx * dx + dy * dy)
        if (r > mr) continue
        const th = Math.atan2(dy, dx)
        const arm = Math.cos(arms * (th - Math.log(Math.max(1.6, r)) * 2.4))
        let dn = Math.exp(-r / (mr * 0.62)) * (0.34 + 0.66 * Math.max(0, arm))
        dn += Math.exp(-r / (mr * 0.1)) * 1.25
        dn *= 0.55 + 0.75 * hsh(x * 0.7, y * 0.9, sd)
        const lv = dn > 1.15 ? 4 : dn > 0.62 ? 3 : dn > 0.3 ? 2 : dn > 0.14 ? 1 : 0
        if (lv) { g.fillStyle = L[lv]; g.fillRect(x, y, 1, 1) }
      }
      return gc
    }

    let yaw = 0, yawV = 0, pit = 0, pitV = 0, roll = 0
    let gal: { c: HTMLCanvasElement; x: number; y: number } | null = null
    let galA = 1, galSwap = false
    let sun = { x: 0, y: 0, r: 3 }

    interface Planet {
      x: number; y: number; z: number; r0: number
      ring: boolean; bands: boolean; sd: number; nb: number; tilt: number
      spin: number; stx: number; sty: number; sts: number
    }
    interface Rock { x: number; y: number; z: number; r0: number; m: RockModel; sp: number }
    let pls: Planet[] = []
    let rocks: Rock[] = []
    let mode = 'belt', rockRate = 0.6, rockBig = 1
    let egg: { x: number; y: number; z: number; vx: number; vy: number; vz: number; cat: boolean } | null = null
    let eggTrail: number[][] = []
    let hyp = 0, hypStart = Date.now(), nextHyp = Date.now() + 150000

    const offAxis = (r0: number, f: number) => {
      const need = (r0 / FOV) * (f + Math.random() * 1.6), a = Math.random() * 6.2832
      return { x: Math.cos(a) * need, y: Math.sin(a) * need * 0.72 }
    }
    const newPlanet = (r0: number, zz: number, ring: boolean, bands: boolean): Planet => {
      const p = offAxis(r0, bands ? 1.02 : 1.35)
      return {
        x: p.x, y: p.y, z: zz, r0, ring, bands,
        sd: Math.random() * 99, nb: 5 + ((Math.random() * 7) | 0),
        tilt: (Math.random() - 0.5) * 0.9,
        spin: (Math.random() < 0.5 ? -1 : 1) * (0.004 + Math.random() * 0.01),
        stx: (Math.random() - 0.5) * 1.2, sty: (Math.random() - 0.5) * 0.7,
        sts: 0.1 + Math.random() * 0.14,
      }
    }
    const newRock = (): Rock => {
      let r0 = (3 + Math.pow(1 / Math.max(0.01, Math.random()), 0.66) * 3.6) * rockBig
      if (r0 > 620) r0 = 620
      const p = offAxis(r0, 1.35)
      return {
        x: p.x, y: p.y, z: Math.max(3.6, r0 / 5.0) + Math.random() * 1.4, r0,
        m: makeRock(Math.random() * 99),
        sp: (0.012 - Math.min(0.0105, r0 / 40000)) * (Math.random() < 0.5 ? -1 : 1),
      }
    }
    const newSector = () => {
      const q = Math.random()
      gal = Math.random() < 0.45
        ? { c: makeGal(Math.random() * 99), x: Math.random() * (W - 90), y: 14 + Math.random() * Math.max(10, H - 84) }
        : null
      sun = { x: -300 + Math.random() * (W + 600), y: -160 + Math.random() * (H + 320), r: 2 + Math.random() * 3.5 }
      if (q < 0.12) { mode = 'jupiter'; rockRate = 0.1; rockBig = 0.7; pls = [newPlanet(2600 + Math.random() * 2200, 34 + Math.random() * 14, Math.random() < 0.35, true)] }
      else if (q < 0.3) { mode = 'giant'; rockRate = 0.15; rockBig = 0.9; pls = [newPlanet(420 + Math.random() * 520, 50 + Math.random() * 28, Math.random() < 0.3, Math.random() < 0.5)] }
      else if (q < 0.46) { mode = 'rings'; rockRate = 0.25; rockBig = 0.9; pls = [newPlanet(150 + Math.random() * 140, 30 + Math.random() * 16, true, Math.random() < 0.6)] }
      else if (q < 0.7) { mode = 'belt'; rockRate = 2.6; rockBig = 2.4; pls = Math.random() < 0.4 ? [newPlanet(40 + Math.random() * 70, 16 + Math.random() * 10, false, false)] : [] }
      else if (q < 0.87) { mode = 'void'; rockRate = 0.05; rockBig = 0.8; pls = [] }
      else { mode = 'binary'; rockRate = 0.4; rockBig = 1; pls = [newPlanet(90 + Math.random() * 90, 22 + Math.random() * 12, Math.random() < 0.4, false), newPlanet(70 + Math.random() * 70, 34 + Math.random() * 14, false, Math.random() < 0.5)] }
    }
    newSector()

    let raf = 0
    const draw = () => {
      const now = Date.now(), T = now * 0.001

      if (now > nextHyp && hyp <= 0) { hyp = 1; galSwap = false; hypStart = now; nextHyp = now + 300000 + Math.random() * 240000 }
      if (hyp > 0) { hyp -= 0.0026; if (hyp < 0) hyp = 0 }
      const bo = hyp > 0 ? Math.sin(Math.min(1, hyp) * 3.14159) : 0
      if (bo > 0.86 && !galSwap) { galSwap = true; rocks = []; newSector() }
      galA = 1 - Math.min(1, bo * 1.25)
      const SB = Math.round(bo * 2.2)

      // Timón: paseo aleatorio con amortiguación + resorte al centro.
      yawV += (Math.random() - 0.5) * 0.00019 - yawV * 0.02 - yaw * 0.0006
      pitV += (Math.random() - 0.5) * 0.00013 - pitV * 0.022 - pit * 0.0008
      yaw += yawV; pit += pitV
      if (yaw > 0.34) yaw = 0.34; if (yaw < -0.34) yaw = -0.34
      if (pit > 0.24) pit = 0.24; if (pit < -0.24) pit = -0.24
      roll += (-yawV * 42 - roll) * 0.022 // banca hacia la vuelta

      const CX = W / 2 + yaw * 34, CY = H / 2 + pit * 24
      const cr = Math.cos(roll + T * 0.0035), sr = Math.sin(roll + T * 0.0035)
      const VZ = 0.0018 + bo * 0.12
      const sunX = sun.x + yaw * 34, sunY = sun.y + pit * 24

      F(0, 0, W, H, 0)
      o.drawImage(deep, (-40 + yaw * 34) | 0, (-30 + pit * 24) | 0)
      if (gal && galA > 0.02) {
        o.globalAlpha = galA
        o.drawImage(gal.c, (gal.x + yaw * 34) | 0, (gal.y + pit * 24) | 0)
        o.globalAlpha = 1
      }

      const halo = (x: number, y: number) => {
        const dx = (x - CX) / W, dy = (y - CY) / H
        return Math.sqrt(dx * dx + dy * dy * 0.6) < 0.16 ? 1 : 0
      }

      // Estrellas primero → los cuerpos las ocultan.
      for (let k = 0; k < st.length; k++) {
        const s = st[k], pz = s.z
        s.z -= VZ
        if (s.z < 0.06) { seed(s, false); continue }
        const rx = s.x * cr - s.y * sr, ry = s.x * sr + s.y * cr
        const x1 = CX + (rx / s.z) * FOV, y1 = CY + (ry / s.z) * FOV
        if (x1 < -70 || x1 > W + 70 || y1 < -70 || y1 > H + 70) { seed(s, false); continue }
        let lv = 1
        if (s.z < 0.45) lv = 5; else if (s.z < 0.95) lv = 4; else if (s.z < 2.0) lv = 3; else if (s.z < 3.0) lv = 2
        lv += s.mag > 0.86 ? 2 : s.mag > 0.55 ? 1 : 0
        let bv = lv + SB + halo(x1, y1); if (bv > 6) bv = 6
        const x0 = CX + (rx / pz) * FOV, y0 = CY + (ry / pz) * FOV
        const dx = x1 - x0, dy = y1 - y0, dl = Math.sqrt(dx * dx + dy * dy)
        if (bo > 0.18 || dl > 1.0) {
          const reps = Math.min(56, Math.max(2, Math.floor(dl * (1 + bo * 30))))
          for (let q = 0; q < reps; q++) {
            const tq = q / reps
            P(x1 + dx * tq * (1 + bo * 9), y1 + dy * tq * (1 + bo * 9),
              q < 2 ? bv : q < reps * 0.45 ? Math.max(2, bv - 1) : Math.max(2, bv - 3))
          }
        }
        P(x1, y1, bv)
        if (s.z < 0.3 && s.mag > 0.5) { P(x1 + 1, y1, bv); P(x1, y1 + 1, bv) }
      }

      // Estrella local: núcleo más brillante que cualquier planeta + corona difuminada.
      const SR = sun.r, BR = SR * 7
      if (sunX + BR > 0 && sunX - BR < W && sunY + BR > 0 && sunY - BR < H) {
        for (let gy = -BR; gy <= BR; gy++) for (let gx = -BR; gx <= BR; gx++) {
          const dq = Math.sqrt(gx * gx + gy * gy)
          if (dq > BR) continue
          let lv: number
          if (dq <= SR) lv = 7
          else if (dq <= SR * 1.5) lv = 6
          else if (dq <= SR * 2.3) lv = 5
          else if (dq <= SR * 3.4) lv = 4
          else {
            const fall = 1 - (dq - SR * 3.4) / (BR - SR * 3.4)
            if (ih(gx, gy, 3) > fall * 0.85) continue
            lv = fall > 0.45 ? 3 : 2
          }
          P(sunX + gx, sunY + gy, lv)
        }
      }

      // Planetas: proyección sobre la esfera, rotación axial, anillos con sombra.
      for (let pi = pls.length - 1; pi >= 0; pi--) {
        const p = pls[pi]
        p.z -= VZ * (1 + bo * 3)
        const prx = p.x * cr - p.y * sr, pry = p.x * sr + p.y * cr
        const px2 = CX + (prx / p.z) * FOV, py2 = CY + (pry / p.z) * FOV
        const pr = p.r0 / p.z
        const eX = pr * (p.ring ? 1.85 : 1.06) + 3, eY = pr * 1.06 + 3
        if (p.z < 0.02 || px2 + eX < 0 || px2 - eX > W || py2 + eY < 0 || py2 - eY > H) { pls.splice(pi, 1); continue }

        const ldx = sunX - px2, ldy = sunY - py2
        const lln = Math.sqrt(ldx * ldx + ldy * ldy) || 1
        const Lx = ldx / lln, Ly = ldy / lln

        const ringPix = (ra: number, rr: number, ry: number, lv: number) => {
          const rxp = Math.cos(ra) * pr * rr, ryp = Math.sin(ra) * pr * ry
          const dp = rxp * Lx + ryp * Ly, cp = Math.abs(rxp * Ly - ryp * Lx)
          if (dp < 0 && cp < pr) lv = Math.max(1, lv - 2) // sombra del planeta sobre el anillo
          P(px2 + rxp, py2 + ryp, lv)
        }
        if (p.ring) for (let ra = 3.1416; ra < 6.2832; ra += 0.004) { ringPix(ra, 1.78, 0.33, 2); ringPix(ra, 1.46, 0.27, 3) }

        const xA = Math.max(-pr, -px2 - 2), xB = Math.min(pr, W - px2 + 2)
        const yA = Math.max(-pr, -py2 - 2), yB = Math.min(pr, H - py2 + 2)
        const ct = Math.cos(p.tilt), stl = Math.sin(p.tilt)
        const spn = T * p.spin, cS = Math.cos(spn), sS = Math.sin(spn)
        const hi = pr > 22
        for (let qy = yA; qy <= yB; qy++) for (let qx = xA; qx <= xB; qx++) {
          const u = qx / pr, v = qy / pr, w2 = 1 - u * u - v * v
          if (w2 < 0) continue
          const w = Math.sqrt(w2)
          const su = u * cS + w * sS // longitud → el planeta rota
          const lit = -(u * Lx + v * Ly)
          let lv: number
          if (p.bands) {
            const lat = u * stl + v * ct
            const turb = hi ? (ih(Math.floor(su * 70), Math.floor(lat * 70), p.sd | 0) - 0.5) * 0.55 : 0
            const bnd = Math.sin((lat + turb * 0.08) * p.nb * 3.14159 + p.sd)
              + 0.45 * Math.sin(lat * p.nb * 7.3 + p.sd * 2)
              + 0.3 * Math.sin(su * 3.2 + lat * 9 + T * 0.03 + p.sd)
            lv = bnd > 0.85 ? 3 : bnd > 0.1 ? 2 : 1
            if (bnd > 1.35) lv = 4
            const sdx = su - p.stx, sdy = (lat - p.sty) * 2.1
            if (sdx * sdx + sdy * sdy < p.sts * p.sts) lv = Math.min(6, lv + 2) // tormenta
            if (lit < -0.42) lv = Math.min(5, lv + 2); else if (lit < -0.05) lv = Math.min(5, lv + 1)
            if (lit > 0.42) lv = Math.max(0, lv - 1)
            if (w < 0.22) lv = Math.min(5, lv + 1) // limbo brillante
          } else {
            const t1 = ih(Math.floor(su * 14), Math.floor(v * 14), p.sd | 0)
            const t2 = hi ? ih(Math.floor(su * 52), Math.floor(v * 52), (p.sd * 3) | 0) : 0.5
            const t3 = hi && pr > 70 ? ih(Math.floor(su * 160), Math.floor(v * 160), (p.sd * 7) | 0) : 0.5
            const terr = t1 * 0.6 + t2 * 0.28 + t3 * 0.12
            lv = lit < -0.4 ? 3 : lit < 0.1 ? 2 : 1
            if (terr > 0.62) lv = Math.min(5, lv + 1); else if (terr < 0.34) lv = Math.max(0, lv - 1)
            if (hi && t2 > 0.93) lv = Math.max(0, lv - 1)
            if (w < 0.16) lv = Math.max(0, lv - 1)
          }
          P(px2 + qx, py2 + qy, lv)
        }
        if (p.ring) for (let rb = 0; rb < 3.1416; rb += 0.004) { ringPix(rb, 1.78, 0.33, 3); ringPix(rb, 1.46, 0.27, 4) }
      }

      if (pls.length === 0 && Math.random() < 0.002) {
        if (mode === 'jupiter') pls.push(newPlanet(2600 + Math.random() * 2200, 42 + Math.random() * 10, Math.random() < 0.35, true))
        else if (mode === 'giant') pls.push(newPlanet(420 + Math.random() * 520, 62 + Math.random() * 22, false, Math.random() < 0.5))
        else if (mode === 'rings') pls.push(newPlanet(150 + Math.random() * 140, 38 + Math.random() * 12, true, true))
        else if (mode !== 'void') pls.push(newPlanet(60 + Math.random() * 90, 24 + Math.random() * 14, Math.random() < 0.35, false))
      }

      if (Math.random() < 0.005 * rockRate && rocks.length < 16) rocks.push(newRock())
      for (let r = rocks.length - 1; r >= 0; r--) {
        const rk = rocks[r]
        rk.z -= VZ * (1 + bo * 2.5)
        if (rk.z < 0.02) { rocks.splice(r, 1); continue }
        const krx = rk.x * cr - rk.y * sr, kry = rk.x * sr + rk.y * cr
        const kx = CX + (krx / rk.z) * FOV, ky = CY + (kry / rk.z) * FOV
        const kr = rk.r0 / rk.z
        const hf = kr * 1.12 + 3
        if (kx + hf < 0 || kx - hf > W || ky + hf < 0 || ky - hf > H) { rocks.splice(r, 1); continue }
        const rot = T * rk.sp * 6.2832
        if (kr > 16) {
          const l2x = sunX - kx, l2y = sunY - ky, l2n = Math.sqrt(l2x * l2x + l2y * l2y) || 1
          drawRockHi(rk.m, kx, ky, kr, rot, -l2x / l2n, -l2y / l2n)
        } else {
          const an = ((T * rk.sp) % 1 + 1) % 1
          let fi = (an * FR) | 0; if (fi >= FR) fi = FR - 1
          const sz = Math.max(2, kr * 2.1)
          o.drawImage(rk.m.fr[fi], (kx - sz / 2) | 0, (ky - sz / 2) | 0, sz | 0, sz | 0)
        }
      }

      for (let k = 0; k < dust.length; k++) {
        const d = dust[k], dpz = d.z
        d.z -= VZ * 1.5
        if (d.z < 0.05) { dseed(d); continue }
        const drx = d.x * cr - d.y * sr, dry = d.x * sr + d.y * cr
        const dx1 = CX + (drx / d.z) * FOV, dy1 = CY + (dry / d.z) * FOV
        if (dx1 < -40 || dx1 > W + 40 || dy1 < -40 || dy1 > H + 40) { dseed(d); continue }
        const dx0 = CX + (drx / dpz) * FOV, dy0 = CY + (dry / dpz) * FOV
        const ddx = dx1 - dx0, ddy = dy1 - dy0
        const ddl = Math.sqrt(ddx * ddx + ddy * ddy)
        let dv = 2 + SB; if (dv > 5) dv = 5
        const dr = Math.min(30, Math.max(1, Math.floor(ddl * (1 + bo * 24))))
        for (let q = 0; q < dr; q++) {
          const t2 = q / dr
          P(dx1 + ddx * t2 * (1 + bo * 8), dy1 + ddy * t2 * (1 + bo * 8), q < 1 ? dv : 2)
        }
      }

      // Easter egg
      if (!egg && Math.random() < 0.00009) {
        const side = Math.random() < 0.5 ? -1 : 1
        egg = {
          x: side * 1.5, y: (Math.random() - 0.5) * 0.7, z: 2.4 + Math.random() * 0.8,
          vx: -side * 0.008, vy: (Math.random() - 0.5) * 0.003, vz: -0.0011,
          cat: Math.random() < 0.35,
        }
        eggTrail = []
      }
      if (egg) {
        egg.x += egg.vx; egg.y += egg.vy; egg.z += egg.vz
        const erx = egg.x * cr - egg.y * sr, ery = egg.x * sr + egg.y * cr
        const ex = CX + (erx / egg.z) * FOV, ey = CY + (ery / egg.z) * FOV
        const es = Math.max(6, ((egg.cat ? 11 : 26) / egg.z) * 1.5)
        eggTrail.push([ex, ey]); if (eggTrail.length > 16) eggTrail.shift()
        if (egg.z < 0.25 || ex + es < -10 || ex - es > W + 10 || ey + es < -10 || ey - es > H + 10) { egg = null; eggTrail = [] }
        else {
          for (let t = 0; t < eggTrail.length - 1; t++) {
            const al = t / eggTrail.length
            P(eggTrail[t][0], eggTrail[t][1], al > 0.7 ? 4 : al > 0.4 ? 2 : 1)
          }
          const pv = eggTrail[Math.max(0, eggTrail.length - 6)]
          const ang = eggTrail.length > 3 ? Math.atan2(ey - pv[1], ex - pv[0]) : 0
          o.save(); o.translate(ex, ey)
          if (egg.cat) { o.rotate(T * 0.07); o.drawImage(cat, -es / 2, -es / 2, es, es) }
          else { o.rotate(ang); o.drawImage(ship, -es * 0.7, -es * 0.38, es * 1.4, es * 0.76) }
          o.restore()
        }
      }

      if (scanlines > 0) {
        o.fillStyle = `rgba(0,0,0,${scanlines})`
        for (let sl = 1; sl < H; sl += 3) o.fillRect(0, sl, W, 1)
      }

      // HUD
      const dt = new Date()
      const pad = (n: number) => (n < 10 ? '0' : '') + n
      TXT(5, 5, `${pad(dt.getDate())}.${pad(dt.getMonth() + 1)}.${String(dt.getFullYear()).slice(2)}`, 4)
      TXT(W - 25, 5, `${pad(dt.getHours())}:${pad(dt.getMinutes())}`, 4)

      const chg = bo > 0 ? 1 : Math.min(1, (now - hypStart) / (nextHyp - hypStart))
      F(W - 70, 6, 38, 3, 1)
      F(W - 70, 6, 38 * chg, 3, bo > 0 ? 6 : chg > 0.9 ? 5 : 4)

      const spd = Math.round(140 + bo * 9800 + Math.sin(T * 0.3) * 8)
      TXT(5, H - 11, String(spd), bo > 0.3 ? 6 : 5)
      F(5, H - 5, 58, 3, 1)
      F(5, H - 5, Math.min(58, (spd / 9950) * 58 + 6), 3, bo > 0.3 ? 6 : 4)

      const ox = Math.round(88 + Math.sin(T * 0.09) * 7)
      TXT(W - 30, H - 11, `${ox}%`, 5)
      F(W - 35, H - 5, 30, 3, 1)
      F(W - 35, H - 5, ox * 0.3, 3, 4)

      F(2, 2, 7, 1, 4); F(2, 2, 1, 7, 4); F(W - 9, 2, 7, 1, 4); F(W - 3, 2, 1, 7, 4)
      F(2, H - 3, 7, 1, 4); F(2, H - 9, 1, 7, 4); F(W - 9, H - 3, 7, 1, 4); F(W - 3, H - 9, 1, 7, 4)

      ctx.imageSmoothingEnabled = false
      ctx.drawImage(off, 0, 0, W, H, 0, 0, W * SC, H * SC)
      raf = requestAnimationFrame(draw)
    }
    raf = requestAnimationFrame(draw)

    let rt = 0
    const onResize = () => {
      clearTimeout(rt)
      rt = window.setTimeout(() => { sizeUp(); buildDeep() }, 150)
    }
    window.addEventListener('resize', onResize)

    return () => {
      cancelAnimationFrame(raf)
      clearTimeout(rt)
      window.removeEventListener('resize', onResize)
    }
  }, [color, pixelScale, scanlines])

  return (
    <canvas
      ref={ref}
      className={className}
      style={{ display: 'block', width: '100%', height: '100%', background: '#000' }}
      aria-hidden="true"
    />
  )
}
