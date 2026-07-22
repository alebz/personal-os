'use client'

// ═══ CRT / arcade screen effect ═══════════════════════════════════════════════
// La capa de personalización del tema arcade. Renderiza (siempre montado):
//   · las capas de overlay fijas (bloom, rejilla, scanlines, viñeta) — su
//     visibilidad y fuerza las gobierna CSS vía [data-crt] + variables --crt-*.
//   · las <symbol> de los íconos pixel (currentColor) que consume <PixelIcon>.
//   · el <filter id="crtFx"> (blur + aberración + fisheye + banda de deformación)
//     que CSS aplica al contenido cuando data-crt="on".
// Los parámetros numéricos del filtro son ATRIBUTOS SVG (no variables CSS), así
// que se aplican aquí por ref en un useEffect que reacciona al estado CRT. Los
// mapas de desplazamiento (fisheye radial + banda senoidal) se generan una vez
// con canvas; la banda recorre verticalmente con requestAnimationFrame.

import { useEffect, useRef } from 'react'
import { useOSSettings } from './OSSettingsContext'

function buildMap(id: string, N: number, fn: (nx: number, ny: number, x: number, y: number) => [number, number], setHref: (url: string) => void) {
  const c = document.createElement('canvas'); c.width = c.height = N
  const ctx = c.getContext('2d'); if (!ctx) return
  const im = ctx.createImageData(N, N); const d = im.data
  for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
    const nx = (x / (N - 1)) * 2 - 1, ny = (y / (N - 1)) * 2 - 1, i = (y * N + x) * 4
    const v = fn(nx, ny, x, y)
    d[i]     = Math.max(0, Math.min(255, 128 + v[0]))
    d[i + 1] = Math.max(0, Math.min(255, 128 + v[1]))
    d[i + 2] = 128; d[i + 3] = 255
  }
  ctx.putImageData(im, 0, 0)
  setHref(c.toDataURL())
}

export default function CRTOverlay() {
  const { crt } = useOSSettings()

  const blurRef = useRef<SVGFEGaussianBlurElement>(null)
  const offRRef = useRef<SVGFEOffsetElement>(null)
  const offBRef = useRef<SVGFEOffsetElement>(null)
  const matRRef = useRef<SVGFEColorMatrixElement>(null)
  const matBRef = useRef<SVGFEColorMatrixElement>(null)
  const fishRef = useRef<SVGFEDisplacementMapElement>(null)
  const bandRef = useRef<SVGFEDisplacementMapElement>(null)
  const fishMapRef = useRef<SVGFEImageElement>(null)
  const bandImgRef = useRef<SVGFEImageElement>(null)
  const periodRef = useRef(crt.deformSpeed)

  // Genera los mapas una vez + anima la banda.
  useEffect(() => {
    const setFish = (u: string) => { fishMapRef.current?.setAttribute('href', u); fishMapRef.current?.setAttributeNS('http://www.w3.org/1999/xlink', 'href', u) }
    const setBand = (u: string) => { bandImgRef.current?.setAttribute('href', u); bandImgRef.current?.setAttributeNS('http://www.w3.org/1999/xlink', 'href', u) }
    // fisheye: vector radial que crece con r²
    buildMap('fish', 512, (nx, ny) => { const r2 = nx * nx + ny * ny; return [nx * r2 * 170, ny * r2 * 170] }, setFish)
    // banda: onda senoidal vertical continua (2 ciclos = 1 por pantalla) → barrido sin corte
    buildMap('band', 256, (_nx, _ny, _x, y) => [100 * Math.sin(2 * Math.PI * 2 * (y / 256)), 0], setBand)

    let raf = 0, last: number | null = null, bandY = 0
    const loop = (now: number) => {
      if (last == null) last = now
      const dt = (now - last) / 1000; last = now
      bandY = (bandY + dt / Math.max(1, periodRef.current)) % 1
      bandImgRef.current?.setAttribute('y', (-bandY * 100) + '%')
      raf = requestAnimationFrame(loop)
    }
    raf = requestAnimationFrame(loop)
    return () => cancelAnimationFrame(raf)
  }, [])

  // Aplica los parámetros del filtro cuando cambia el estado CRT.
  useEffect(() => {
    periodRef.current = crt.deformSpeed
    blurRef.current?.setAttribute('stdDeviation', String(crt.blur))
    fishRef.current?.setAttribute('scale', String(crt.fisheye))
    bandRef.current?.setAttribute('scale', String(crt.deform))
    const a = (crt.aberr * 0.4).toFixed(3)
    offRRef.current?.setAttribute('dx', String(crt.aberr))
    offBRef.current?.setAttribute('dx', String(-crt.aberr))
    matRRef.current?.setAttribute('values', `1 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 ${a} 0`)
    matBRef.current?.setAttribute('values', `0 0 0 0 0  0 1 0 0 0  0 0 1 0 0  0 0 0 ${a} 0`)
  }, [crt.blur, crt.aberr, crt.fisheye, crt.deform, crt.deformSpeed])

  return (
    <>
      {/* Capas de overlay — visibilidad/fuerza vía CSS [data-crt] + --crt-* */}
      <div className="crt-bloom" aria-hidden />
      <div className="crt-dots" aria-hidden />
      <div className="crt-scan" aria-hidden />
      <div className="crt-vig" aria-hidden />

      {/* Defs SVG: filtro de warp + símbolos de íconos pixel (currentColor) */}
      <svg width="0" height="0" style={{ position: 'absolute', pointerEvents: 'none' }} aria-hidden>
        <filter id="crtFx" colorInterpolationFilters="sRGB">
          <feGaussianBlur ref={blurRef} in="SourceGraphic" stdDeviation="0.2" result="b" />
          <feOffset ref={offRRef} in="b" dx="0.6" dy="0" result="ro" />
          <feColorMatrix ref={matRRef} in="ro" type="matrix" values="1 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 0.24 0" result="rc" />
          <feOffset ref={offBRef} in="b" dx="-0.6" dy="0" result="bo" />
          <feColorMatrix ref={matBRef} in="bo" type="matrix" values="0 0 0 0 0  0 1 0 0 0  0 0 1 0 0  0 0 0 0.24 0" result="bc" />
          <feMerge result="ca"><feMergeNode in="b" /><feMergeNode in="rc" /><feMergeNode in="bc" /></feMerge>
          <feImage ref={fishMapRef} result="fmap" preserveAspectRatio="none" />
          <feDisplacementMap ref={fishRef} in="ca" in2="fmap" scale="4" xChannelSelector="R" yChannelSelector="G" result="warped" />
          <feImage ref={bandImgRef} result="bmap" preserveAspectRatio="none" x="0%" y="0%" width="100%" height="200%" />
          <feDisplacementMap ref={bandRef} in="warped" in2="bmap" scale="2.5" xChannelSelector="R" yChannelSelector="G" />
        </filter>

        {/* Tarjeta (mono, small) — currentColor */}
        <symbol id="ic-card" viewBox="0 0 16 24"><path d="M1 0h14v1h-14zM0 1h1v1h-1zM15 1h1v1h-1zM0 2h1v1h-1zM15 2h1v1h-1zM0 3h1v1h-1zM15 3h1v1h-1zM0 4h1v1h-1zM15 4h1v1h-1zM0 5h1v1h-1zM15 5h1v1h-1zM0 6h1v1h-1zM15 6h1v1h-1zM0 7h1v1h-1zM15 7h1v1h-1zM0 8h1v1h-1zM15 8h1v1h-1zM0 9h1v1h-1zM15 9h1v1h-1zM0 10h1v1h-1zM15 10h1v1h-1zM0 11h1v1h-1zM15 11h1v1h-1zM0 12h1v1h-1zM15 12h1v1h-1zM0 13h1v1h-1zM15 13h1v1h-1zM0 14h1v1h-1zM15 14h1v1h-1zM0 15h1v1h-1zM15 15h1v1h-1zM0 16h1v1h-1zM15 16h1v1h-1zM0 17h1v1h-1zM15 17h1v1h-1zM0 18h1v1h-1zM15 18h1v1h-1zM0 19h1v1h-1zM15 19h1v1h-1zM0 20h1v1h-1zM15 20h1v1h-1zM0 21h1v1h-1zM15 21h1v1h-1zM0 22h1v1h-1zM15 22h1v1h-1zM1 23h14v1h-14zM4 8h3v1h-3zM9 8h3v1h-3zM3 9h10v1h-10zM3 10h10v1h-10zM3 11h10v1h-10zM4 12h8v1h-8zM5 13h6v1h-6zM6 14h4v1h-4zM7 15h2v1h-2z" /></symbol>
        {/* Ficha (mono) — currentColor */}
        <symbol id="ic-chip" viewBox="0 0 16 16"><path d="M6 0h4v1h-4zM4 1h8v1h-8zM3 2h3v1h-3zM10 2h3v1h-3zM2 3h2v1h-2zM6 3h4v1h-4zM12 3h2v1h-2zM1 4h2v1h-2zM4 4h8v1h-8zM13 4h2v1h-2zM1 5h2v1h-2zM4 5h3v1h-3zM9 5h3v1h-3zM13 5h2v1h-2zM0 6h2v1h-2zM3 6h2v1h-2zM11 6h2v1h-2zM14 6h2v1h-2zM0 7h2v1h-2zM3 7h3v1h-3zM10 7h3v1h-3zM14 7h2v1h-2zM0 8h2v1h-2zM3 8h3v1h-3zM10 8h3v1h-3zM14 8h2v1h-2zM0 9h2v1h-2zM3 9h2v1h-2zM7 9h2v1h-2zM11 9h2v1h-2zM14 9h2v1h-2zM1 10h2v1h-2zM4 10h8v1h-8zM13 10h2v1h-2zM1 11h2v1h-2zM4 11h8v1h-8zM13 11h2v1h-2zM2 12h2v1h-2zM6 12h4v1h-4zM12 12h2v1h-2zM3 13h3v1h-3zM10 13h3v1h-3zM4 14h2v1h-2zM10 14h2v1h-2zM6 15h4v1h-4z" /></symbol>
        {/* Tarjeta color (blanco + corazón currentColor + tinta) */}
        <symbol id="ic-card-color" viewBox="0 0 16 24"><path fill="#ffffff" d="M1 1h14v1h-14zM1 2h14v1h-14zM1 3h14v1h-14zM1 4h14v1h-14zM1 5h14v1h-14zM1 6h14v1h-14zM1 7h14v1h-14zM1 8h3v1h-3zM7 8h2v1h-2zM12 8h3v1h-3zM1 9h2v1h-2zM13 9h2v1h-2zM1 10h2v1h-2zM13 10h2v1h-2zM1 11h2v1h-2zM13 11h2v1h-2zM1 12h3v1h-3zM12 12h3v1h-3zM1 13h4v1h-4zM11 13h4v1h-4zM1 14h5v1h-5zM10 14h5v1h-5zM1 15h6v1h-6zM9 15h6v1h-6zM1 16h14v1h-14zM1 17h14v1h-14zM1 18h14v1h-14zM1 19h14v1h-14zM1 20h14v1h-14zM1 21h14v1h-14zM1 22h14v1h-14z" /><path fill="currentColor" d="M4 8h3v1h-3zM9 8h3v1h-3zM3 9h10v1h-10zM3 10h10v1h-10zM3 11h10v1h-10zM4 12h8v1h-8zM5 13h6v1h-6zM6 14h4v1h-4zM7 15h2v1h-2z" /><path fill="#0d1020" d="M1 0h14v1h-14zM0 1h1v1h-1zM15 1h1v1h-1zM0 2h1v1h-1zM15 2h1v1h-1zM0 3h1v1h-1zM15 3h1v1h-1zM0 4h1v1h-1zM15 4h1v1h-1zM0 5h1v1h-1zM15 5h1v1h-1zM0 6h1v1h-1zM15 6h1v1h-1zM0 7h1v1h-1zM15 7h1v1h-1zM0 8h1v1h-1zM15 8h1v1h-1zM0 9h1v1h-1zM15 9h1v1h-1zM0 10h1v1h-1zM15 10h1v1h-1zM0 11h1v1h-1zM15 11h1v1h-1zM0 12h1v1h-1zM15 12h1v1h-1zM0 13h1v1h-1zM15 13h1v1h-1zM0 14h1v1h-1zM15 14h1v1h-1zM0 15h1v1h-1zM15 15h1v1h-1zM0 16h1v1h-1zM15 16h1v1h-1zM0 17h1v1h-1zM15 17h1v1h-1zM0 18h1v1h-1zM15 18h1v1h-1zM0 19h1v1h-1zM15 19h1v1h-1zM0 20h1v1h-1zM15 20h1v1h-1zM0 21h1v1h-1zM15 21h1v1h-1zM0 22h1v1h-1zM15 22h1v1h-1zM1 23h14v1h-14z" /></symbol>
        {/* Moneda de oro (full-color fijo) */}
        <symbol id="ic-coin" viewBox="0 0 16 16"><path fill="#FBBC05" d="M6 1h4v1h-4zM4 2h2v1h-2zM10 2h2v1h-2zM3 3h1v1h-1zM6 3h4v1h-4zM12 3h1v1h-1zM2 4h1v1h-1zM4 4h8v1h-8zM13 4h1v1h-1zM2 5h1v1h-1zM4 5h3v1h-3zM9 5h3v1h-3zM13 5h1v1h-1zM1 6h1v1h-1zM3 6h2v1h-2zM11 6h2v1h-2zM14 6h1v1h-1zM1 7h1v1h-1zM3 7h3v1h-3zM10 7h3v1h-3zM14 7h1v1h-1zM1 8h1v1h-1zM3 8h3v1h-3zM10 8h3v1h-3zM14 8h1v1h-1zM1 9h1v1h-1zM3 9h2v1h-2zM7 9h2v1h-2zM11 9h2v1h-2zM14 9h1v1h-1zM2 10h1v1h-1zM4 10h8v1h-8zM13 10h1v1h-1zM2 11h1v1h-1zM4 11h8v1h-8zM13 11h1v1h-1zM3 12h1v1h-1zM6 12h4v1h-4zM12 12h1v1h-1zM4 13h2v1h-2zM10 13h2v1h-2zM6 14h4v1h-4z" /><path fill="#C8860A" d="M6 2h4v1h-4zM4 3h2v1h-2zM10 3h2v1h-2zM3 4h1v1h-1zM12 4h1v1h-1zM3 5h1v1h-1zM7 5h2v1h-2zM12 5h1v1h-1zM2 6h1v1h-1zM5 6h6v1h-6zM13 6h1v1h-1zM2 7h1v1h-1zM6 7h4v1h-4zM13 7h1v1h-1zM2 8h1v1h-1zM6 8h4v1h-4zM13 8h1v1h-1zM2 9h1v1h-1zM5 9h2v1h-2zM9 9h2v1h-2zM13 9h1v1h-1zM3 10h1v1h-1zM12 10h1v1h-1zM3 11h1v1h-1zM12 11h1v1h-1zM4 12h2v1h-2zM10 12h2v1h-2zM6 13h4v1h-4z" /><path fill="#6B4708" d="M6 0h4v1h-4zM4 1h2v1h-2zM10 1h2v1h-2zM3 2h1v1h-1zM12 2h1v1h-1zM2 3h1v1h-1zM13 3h1v1h-1zM1 4h1v1h-1zM14 4h1v1h-1zM1 5h1v1h-1zM14 5h1v1h-1zM0 6h1v1h-1zM15 6h1v1h-1zM0 7h1v1h-1zM15 7h1v1h-1zM0 8h1v1h-1zM15 8h1v1h-1zM0 9h1v1h-1zM15 9h1v1h-1zM1 10h1v1h-1zM14 10h1v1h-1zM1 11h1v1h-1zM14 11h1v1h-1zM2 12h1v1h-1zM13 12h1v1h-1zM3 13h1v1h-1zM12 13h1v1h-1zM4 14h2v1h-2zM10 14h2v1h-2zM6 15h4v1h-4z" /></symbol>
      </svg>
    </>
  )
}
