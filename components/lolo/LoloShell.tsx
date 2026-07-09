'use client'

import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import LoloChat from './LoloChat'
import LoloConfig from './LoloConfig'
import { S, DEVICE_W, DEVICE_H, ALL_LOLO_IMAGES } from './LoloConstants'
import type { Mode, Bubble, ChatMessage, TemperamentState, SettingsRow } from './LoloTypes'

interface LoloShellProps {
  pos: { x: number; y: number }
  cssVars: React.CSSProperties
  scanlinesOn: boolean
  netOk: boolean
  time: string
  temperament: TemperamentState
  mode: Mode
  busy: boolean
  bubble: Bubble
  chatMessages: ChatMessage[]
  showFloorShadow: boolean
  bgImage: string
  containerRef: React.RefObject<HTMLDivElement | null>
  frameRef: React.RefObject<HTMLDivElement | null>
  imgRef: React.RefObject<HTMLImageElement | null>
  dialogueRef: React.RefObject<HTMLDivElement | null>
  messagesRef: React.RefObject<HTMLDivElement | null>
  inputRef: React.RefObject<HTMLInputElement | null>
  dragging: React.MutableRefObject<boolean>
  onPointerDown: (e: React.PointerEvent) => void
  onPointerMove: (e: React.PointerEvent) => void
  onPointerUp: () => void
  onFaceClick: () => void
  onScrollDown: () => void
  onBubblePause?: () => void
  onBubbleResume?: () => void
  onInputKey: (e: React.KeyboardEvent<HTMLInputElement>) => void
  onSend: () => void
  onA: () => void
  onB: () => void
  onC: () => void
  shellStyle?: React.CSSProperties
  shellOverlay?: React.ReactNode
  btnColors?: { cfg: string; ent: string; bck: string }
  settingsRowData: SettingsRow[]
  settingsSel: number
  setSettingsSel: (i: number) => void
  cycleSetting: (key: string) => void
}

const btnBase: React.CSSProperties = {
  border: 'none', fontFamily: "'Press Start 2P',monospace", letterSpacing: .5,
  cursor: 'pointer', display: 'grid', placeItems: 'center' as const,
  transition: 'transform .06s,box-shadow .06s,background .06s',
}

function ovalBtn(which: 'SEL' | 'BCK', pressed: boolean, color = 'var(--btn)'): React.CSSProperties {
  return {
    ...btnBase, width: 58, height: 36, borderRadius: 18, fontSize: 8, color: 'var(--ink)',
    background: pressed
      ? `linear-gradient(170deg, color-mix(in srgb, ${color} 68%, #000) 0%, ${color} 100%)`
      : `linear-gradient(170deg, color-mix(in srgb, ${color} 92%, #fff) 0%, ${color} 52%, color-mix(in srgb, ${color} 78%, #000) 100%)`,
    boxShadow: pressed
      ? 'inset 0 2px 5px rgba(0,0,0,.5),inset 0 1px 2px rgba(0,0,0,.25)'
      : `inset 0 6px 0 rgba(255,255,255,.68),inset 0 -2px 0 rgba(0,0,0,.22),0 5px 0 color-mix(in srgb, ${color} 22%, #000),0 6px 4px rgba(0,0,0,.35)`,
    transform: pressed ? 'translateY(1px)' : undefined,
  }
}

function roundBtn(pressed: boolean, color = 'var(--btn)'): React.CSSProperties {
  return {
    ...btnBase, width: 60, height: 60, borderRadius: '50%', fontSize: 8, color: 'var(--ink)',
    background: pressed
      ? `radial-gradient(circle at 40% 40%, color-mix(in srgb, ${color} 72%, #000) 0%, color-mix(in srgb, ${color} 52%, #000) 100%)`
      : `radial-gradient(circle at 32% 26%, color-mix(in srgb, ${color} 96%, #fff) 0%, ${color} 42%, color-mix(in srgb, ${color} 72%, #000) 100%)`,
    boxShadow: pressed
      ? 'inset 0 3px 6px rgba(0,0,0,.5),inset 0 1px 2px rgba(0,0,0,.28)'
      : `inset 0 7px 0 rgba(255,255,255,.68),inset 0 -2px 0 rgba(0,0,0,.22),0 6px 0 color-mix(in srgb, ${color} 22%, #000),0 8px 5px rgba(0,0,0,.38)`,
    transform: pressed ? 'translateY(2px)' : undefined,
  }
}

export default function LoloShell({
  pos, cssVars, scanlinesOn, netOk,
  mode, busy, bubble, chatMessages, showFloorShadow, bgImage,
  containerRef, frameRef, imgRef, dialogueRef, messagesRef, inputRef, dragging,
  onPointerDown, onPointerMove, onPointerUp, onFaceClick, onScrollDown,
  onBubblePause, onBubbleResume,
  onInputKey, onSend, onA, onB, onC,
  shellStyle, shellOverlay, btnColors,
  settingsRowData, settingsSel, setSettingsSel, cycleSetting,
}: LoloShellProps) {
  const [pressedBtn, setPressedBtn] = useState<'SEL' | 'ENT' | 'BCK' | null>(null)
  const [widgetDragging, setWidgetDragging] = useState(false)

  // ── Scroll dial ───────────────────────────────────────────────────────────────
  const MAX_DIAL_OFFSET = 120
  const [dialOffset, setDialOffset] = useState(() => {
    if (typeof window === 'undefined') return 0
    const saved = parseFloat(localStorage.getItem('lolo-dial-zoom') ?? '')
    return isNaN(saved) ? 0 : Math.min(MAX_DIAL_OFFSET, Math.max(0, saved))
  })
  const [isDragging, setIsDragging] = useState(false)
  const dialDragStart = useRef<{ y: number; offset: number } | null>(null)

  const dialT    = Math.min(1, Math.max(0, dialOffset / MAX_DIAL_OFFSET))
  const dialZoom = 1.0 + dialT * 1.2              // 1.0 → 2.2
  const dialTilt = isDragging ? dialT * 3 : 0     // resets to 0deg on release
  const dialogueVisible = bubble.visible || busy
  const activeZoom  = dialZoom - (dialogueVisible ? 0.15 : 0)
  const activeShift = dialogueVisible ? -8 : 0
  // TODO: connect dialValue to selector mode
  const dialValue = Math.round(dialT * 100) // eslint-disable-line @typescript-eslint/no-unused-vars

  function onDialWheel(e: React.WheelEvent) {
    e.stopPropagation()
    setDialOffset(o => Math.min(MAX_DIAL_OFFSET, Math.max(0, o + e.deltaY * 0.5)))
  }
  function onDialPointerDown(e: React.PointerEvent) {
    e.stopPropagation()
    e.currentTarget.setPointerCapture(e.pointerId)
    dialDragStart.current = { y: e.clientY, offset: dialOffset }
    setIsDragging(true)
  }
  function onDialPointerMove(e: React.PointerEvent) {
    if (!dialDragStart.current) return
    const dy = e.clientY - dialDragStart.current.y
    setDialOffset(Math.min(MAX_DIAL_OFFSET, Math.max(0, dialDragStart.current.offset + dy)))
  }
  function onDialPointerUp(e: React.PointerEvent) {
    e.currentTarget.releasePointerCapture(e.pointerId)
    dialDragStart.current = null
    setIsDragging(false)
    // zoom persists — no spring-back
  }

  useEffect(() => {
    try { localStorage.setItem('lolo-dial-zoom', String(dialOffset)) } catch {}
  }, [dialOffset])

  // ── Responsive scale ──────────────────────────────────────────────────────────
  const [containerWidth, setContainerWidth] = useState(DEVICE_W * S)
  useEffect(() => {
    const el = containerRef.current; if (!el) return
    setContainerWidth(el.offsetWidth)
    const ro = new ResizeObserver(entries => {
      const w = entries[0]?.contentRect.width
      if (w) setContainerWidth(w)
    })
    ro.observe(el)
    return () => ro.disconnect()
  }, [containerRef])
  const dynS = containerWidth / DEVICE_W
  const innerW = DEVICE_W - 12  // bezel content width (6px border each side)
  const clipD  = `M24,0 H${innerW - 24} A24,24 0 0 1 ${innerW},24 V938 A62,62 0 0 1 ${innerW - 62},1000 H62 A62,62 0 0 1 0,938 V24 A24,24 0 0 1 24,0 Z M12,10 H${innerW - 12} V654 H12 Z`

  return createPortal(
    <div
      ref={containerRef}
        onPointerDown={onPointerDown}
        onPointerMove={(e) => { onPointerMove(e); setWidgetDragging(dragging.current) }}
        onPointerUp={() => { onPointerUp(); setWidgetDragging(false) }}
        style={{ position: 'fixed', left: pos.x, top: pos.y, zIndex: 10000, width: DEVICE_W * S, height: DEVICE_H * dynS, userSelect: 'none', touchAction: 'none', overflow: 'visible' }}
      >
        {/* Scale wrapper — holds all CSS vars. pointerEvents:none prevents layout-box overflow from blocking clicks outside the visual gadget. Interactive children (bezel, dial) restore auto. */}
        <div style={{ transform: `scale(${dynS})`, transformOrigin: 'top left', width: DEVICE_W, pointerEvents: 'none', ...cssVars }}>

          {/* Scroll dial — side-mounted, interactive (wheel / drag up-down) */}
          <div
            style={{ position: 'absolute', left: -8, top: '22%', cursor: 'ns-resize', touchAction: 'none', pointerEvents: 'auto' }}
            onWheel={onDialWheel}
            onPointerDown={onDialPointerDown}
            onPointerMove={onDialPointerMove}
            onPointerUp={onDialPointerUp}
            onPointerCancel={onDialPointerUp}
          >
            {/* Static dial body — shape, base gradient, clip, edge fade */}
            <div style={{
              width: 14, height: 100, borderRadius: '6px 0 0 6px',
              background: 'linear-gradient(180deg, #36302b 0%, #8a7f77 22%, #d6cbc3 50%, #8a7f77 78%, #36302b 100%)',
              boxShadow: '-3px 2px 7px rgba(0,0,0,.55),inset 2px 0 3px rgba(255,255,255,.28)',
              position: 'relative', overflow: 'hidden',
              maskImage: 'linear-gradient(to bottom, transparent 0%, black 20%, black 80%, transparent 100%)',
              WebkitMaskImage: 'linear-gradient(to bottom, transparent 0%, black 20%, black 80%, transparent 100%)',
            }}>
              {/* Tick marks — translateY scrolls them like a drum crown */}
              <div style={{
                position: 'absolute', inset: 0,
                background: 'repeating-linear-gradient(180deg, rgba(0,0,0,.42) 0 1.5px, rgba(255,255,255,.22) 1.5px 3px, transparent 3px 5.5px)',
                transform: `translateY(${dialOffset * 0.5 % 5.5}px)`,
                transition: isDragging ? 'none' : 'transform 800ms ease-out',
              }} />
            </div>
          </div>

{/* Side grip ridges — left */}
          <svg style={{ position: 'absolute', left: -6, top: '64%', transform: 'translateY(-50%)', imageRendering: 'pixelated' }} width="6" height="60" viewBox="0 0 6 60">
            {([4, 18, 32, 46] as number[]).flatMap((y, i) => [
              <rect key={`la${i}`} x="0" y={y} width="6" height="4" fill="#1e1a16" />,
              <rect key={`lb${i}`} x="0" y={y + 6} width="6" height="4" fill="rgba(255,255,255,.06)" />,
            ])}
          </svg>

          {/* Side grip ridges — right */}
          <svg style={{ position: 'absolute', right: -6, top: '50%', transform: 'translateY(-50%)', imageRendering: 'pixelated' }} width="6" height="60" viewBox="0 0 6 60">
            {([4, 18, 32, 46] as number[]).flatMap((y, i) => [
              <rect key={`ra${i}`} x="0" y={y} width="6" height="4" fill="#1e1a16" />,
              <rect key={`rb${i}`} x="0" y={y + 6} width="6" height="4" fill="rgba(255,255,255,.06)" />,
            ])}
          </svg>

          {/* Unified bezel */}
          <div style={{ position: 'relative', width: DEVICE_W, isolation: 'isolate', pointerEvents: 'auto', background: 'linear-gradient(135deg, var(--shellLight,#c8bdb5) 0%, var(--shellMid,#b8aea5) 50%, var(--shellDark,#a89a92) 100%)', border: '6px solid var(--shellBorder,#8a7f77)', boxShadow: '0 8px 24px rgba(0,0,0,.35),inset 0 1px 0 rgba(255,255,255,.15),inset 0 -2px 4px rgba(0,0,0,.2)', borderRadius: '24px 24px 62px 62px', padding: '36px 20px 36px', animation: 'deviceSway 4s ease-in-out infinite', imageRendering: 'pixelated', ...shellStyle }}>

            {/* Shared clipPath: plastic frame only, with rounded corners matching the shell.
                evenodd: outer rounded boundary minus screen bay (x12-459,y10-654, +8px inset on all sides).
                Button area below screen is open plastic — no exclusion hole.
                No viewBox → 1 SVG unit = 1 CSS px. Referenced by glitter overlay (SVG). */}
            <svg width={0} height={0} style={{ position: 'absolute', overflow: 'hidden', pointerEvents: 'none' }} aria-hidden>
              <defs>
                <clipPath id="shell-frame-clip">
                  <path clipRule="evenodd" d={clipD} />
                </clipPath>
              </defs>
            </svg>


            {shellOverlay}

            {/* Button wear glow */}
            <div style={{ position: 'absolute', bottom: 52, left: '50%', transform: 'translateX(-50%)', width: 180, height: 36, borderRadius: '50%', background: 'radial-gradient(ellipse, rgba(255,255,255,.06), transparent 70%)', pointerEvents: 'none' }} />

            {/* Mic punch holes */}
            <div style={{ position: 'absolute', top: 9, left: '50%', transform: 'translateX(-50%)', background: '#090705', borderRadius: 3, padding: '3px 10px', boxShadow: 'inset 0 1px 3px rgba(0,0,0,.98),0 1px 0 rgba(255,255,220,.08)', display: 'flex', gap: 3, alignItems: 'center', pointerEvents: 'none', zIndex: 5 }}>
              {Array.from({ length: 7 }).map((_, i) => (
                <div key={i} style={{ width: 2, height: 2, borderRadius: '50%', background: '#020100', boxShadow: 'inset 0 1px 1px rgba(0,0,0,.95)' }} />
              ))}
            </div>

            {/* Power LED — top-right corner of plastic shell */}
            <div style={{ position: 'absolute', top: 4, right: 10, display: 'flex', alignItems: 'center', gap: 3, pointerEvents: 'none', zIndex: 10 }}>
              <div style={{ fontFamily: "'Press Start 2P',monospace", fontSize: 4, color: 'rgba(80,68,56,.38)', letterSpacing: .4 }}>PWR</div>
              <div style={{ width: 10, height: 18, borderRadius: 4, background: '#0d0a08', boxShadow: '0 2px 6px rgba(0,0,0,.6),inset 0 1px 3px rgba(255,255,255,.10)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <div style={{ width: 5, height: 12, borderRadius: 2, animation: `${netOk ? 'adanLedGreen 2.8s ease-in-out' : 'adanLedRed 0.9s steps(1)'} infinite` }} />
              </div>
            </div>

            {/* RST pinhole */}
            <div style={{ position: 'absolute', bottom: 8, left: 18, display: 'flex', alignItems: 'center', gap: 4 }}>
              <div style={{ width: 5, height: 5, background: '#0e0b09', imageRendering: 'pixelated', boxShadow: '0 1px 0 rgba(255,255,220,.08)' }} />
              <div style={{ fontFamily: "'Press Start 2P',monospace", fontSize: 4, color: 'rgba(90,86,64,.28)' }}>RST</div>
            </div>

            {/* Speaker grille */}
            <svg style={{ position: 'absolute', bottom: 14, left: '50%', transform: 'translateX(-50%)' }} width="76" height="22" viewBox="0 0 76 22">
              {[0, 1, 2].flatMap(row => [0, 1, 2, 3, 4, 5, 6, 7].map(col => (
                <circle key={`sp${row}-${col}`} cx={4 + col * 10} cy={4 + row * 7} r={2.5} fill="#1e1a16" opacity=".85" />
              )))}
            </svg>

            {/* Screen mount bay */}
            <div style={{ background: '#0e0b09', borderRadius: '0 10px 10px 10px', padding: 9, boxShadow: 'inset 0 8px 22px rgba(0,0,0,.98),inset 8px 0 14px rgba(0,0,0,.85),inset -8px 0 14px rgba(0,0,0,.85),inset 0 -4px 10px rgba(0,0,0,.7),0 0 0 1px rgba(255,255,255,.07),0 1px 0 rgba(255,255,255,.04)' }}>
              {/* LCD */}
              <div style={{ position: 'relative', height: 610, border: '2px solid rgba(0,0,0,.95)', borderBottomColor: 'rgba(0,0,0,.5)', borderRadius: '0 6px 0 0', overflow: 'hidden', background: `linear-gradient(180deg, color-mix(in srgb, var(--lcd) 86%, #fff) 0%, var(--lcd) 52%, color-mix(in srgb, var(--lcd) 88%, #000) 100%)`, imageRendering: 'pixelated', display: 'flex', flexDirection: 'column' }}>

                {/* Background */}
                <div style={{ position: 'absolute', inset: -60, zIndex: 0, pointerEvents: 'none', backgroundImage: `url(${bgImage})`, backgroundSize: 'cover', backgroundPosition: 'top center', opacity: .90 }} />


{/* Ground gradient */}
                <div style={{ position: 'absolute', left: 0, right: 0, bottom: 0, height: 74, zIndex: 1, background: 'linear-gradient(180deg, transparent, rgba(170,185,140,.5))', pointerEvents: 'none' }} />

                {/* Flex column: character area + always-visible input bar */}
                <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', padding: 0, margin: 0, zIndex: 3, minHeight: 0 }}>

                  {/* Character area — chat/config overlays are children so bottom:0 is relative here */}
                  <div style={{ flex: 1, position: 'relative', overflow: 'hidden', minHeight: 0 }}>
                    {showFloorShadow && (
                      <div style={{ position: 'absolute', bottom: 8, left: '50%', transform: 'translateX(-50%)', zIndex: 4 }}>
                        <svg width="72" height="20" viewBox="0 0 72 20" style={{ imageRendering: 'pixelated', display: 'block' }}>
                          <rect x="16" y="0"  width="40" height="4" fill="rgba(30,22,14,.32)"/>
                          <rect x="6"  y="4"  width="60" height="4" fill="rgba(30,22,14,.26)"/>
                          <rect x="0"  y="8"  width="72" height="4" fill="rgba(30,22,14,.18)"/>
                          <rect x="6"  y="12" width="60" height="4" fill="rgba(30,22,14,.10)"/>
                          <rect x="16" y="16" width="40" height="4" fill="rgba(30,22,14,.05)"/>
                        </svg>
                      </div>
                    )}
                    <div ref={frameRef} style={{ position: 'absolute', inset: 0, transition: 'transform .55s cubic-bezier(.4,0,.2,1)', transformOrigin: '50% 8%' }}>
                      <div style={{ position: 'absolute', inset: 0, transformOrigin: '50% 28%', animation: 'adanBreathe 5.5s ease-in-out infinite', perspective: '800px' }}>
                        <div style={{ position: 'absolute', inset: 0, overflow: 'hidden' }}>
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img
                            ref={imgRef}
                            src={ALL_LOLO_IMAGES[0]}
                            alt="Lolo"
                            draggable={false}
                            onClick={onFaceClick}
                            onError={e => { const el = e.target as HTMLImageElement; if (!el.src.endsWith('lolo_idle_2.png')) el.src = ALL_LOLO_IMAGES[0] }}
                            style={{ position: 'absolute', bottom: 0, left: '50%', width: '70%', height: 'auto', transform: `translateX(-50%) translateY(calc(${(dialZoom - 1.0) * 80}% + ${activeShift}% - 10%)) scale(${activeZoom}) rotateX(${dialTilt}deg)`, transformOrigin: 'bottom center', display: 'block', cursor: 'pointer', imageRendering: 'pixelated', userSelect: 'none', filter: 'drop-shadow(0 7px 7px rgba(40,30,10,.22))', transition: isDragging ? 'transform 0.1s ease' : 'transform 0.4s ease-out' }}
                          />
                        </div>
                      </div>
                    </div>

                    {/* Scanlines — inside the character area only: above Lolo, below chat/bubble/input, so text stays clean */}
                    {scanlinesOn && <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none', zIndex: 5, background: 'repeating-linear-gradient(to bottom, rgba(0,0,0,0.12) 0px, rgba(0,0,0,0.12) 4px, transparent 4px, transparent 8px)' }} />}

                    {/* Chat overlay + dialogue bubble — bottom:0 is flush with input bar top */}
                    <LoloChat
                      mode={mode} busy={busy} chatMessages={chatMessages} bubble={bubble}
                      messagesRef={messagesRef} dialogueRef={dialogueRef} onScrollDown={onScrollDown}
                      onBubblePause={onBubblePause} onBubbleResume={onBubbleResume}
                    />

                    {/* Settings overlay */}
                    {mode === 'cfg' && (
                      <LoloConfig
                        settingsRowData={settingsRowData} settingsSel={settingsSel}
                        setSettingsSel={setSettingsSel} cycleSetting={cycleSetting}
                      />
                    )}
                  </div>

                  {/* Always-visible input bar */}
                  <div style={{ height: 52, flexShrink: 0, position: 'relative', display: 'flex', alignItems: 'center', borderTop: '2px solid var(--ink)', background: 'color-mix(in srgb, var(--lcd) 96%, #000)', padding: '0 10px', gap: 6, zIndex: 25 }}>
                    <style>{`.lolo-input{font-family:'VT323',monospace!important;font-size:36px!important;letter-spacing:.5px!important;}.lolo-input::placeholder{font-family:'VT323',monospace!important;font-size:36px!important;color:#1a1a1a!important;opacity:.5!important;}`}</style>
                    <input
                      ref={inputRef}
                      onKeyDown={onInputKey}
                      className="lolo-input"
                      placeholder="habla con lolo…"
                      maxLength={160}
                      style={{ flex: 1, width: '100%', border: 'none', background: 'rgba(0,0,0,0.08)', padding: '6px 10px', fontFamily: "'VT323',monospace", fontSize: 36, color: '#1a1a1a', outline: 'none', letterSpacing: .5 }}
                    />
                    <button onClick={onSend} style={{ flexShrink: 0, border: 'none', background: 'transparent', cursor: 'pointer', display: 'grid', placeItems: 'center' as const, padding: 0 }}>
                      <svg width="13" height="13" viewBox="0 0 14 14" style={{ imageRendering: 'pixelated', display: 'block' }}>
                        <rect x="0"  y="4"  width="2" height="6"  fill="var(--ink)"/>
                        <rect x="2"  y="2"  width="2" height="10" fill="var(--ink)"/>
                        <rect x="4"  y="0"  width="2" height="14" fill="var(--ink)"/>
                        <rect x="6"  y="2"  width="2" height="10" fill="var(--ink)"/>
                        <rect x="8"  y="4"  width="2" height="6"  fill="var(--ink)"/>
                        <rect x="10" y="6"  width="2" height="2"  fill="var(--ink)"/>
                      </svg>
                    </button>
                  </div>
                </div>

                {/* Dither */}
                <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none', zIndex: 24, backgroundImage: 'repeating-conic-gradient(rgba(0,0,0,.6) 0% 25%, transparent 0% 50%)', backgroundSize: '3px 3px', opacity: .05 }} />

                {/* LCD shadow */}
                <div style={{ position: 'absolute', inset: 0, borderRadius: 'inherit', pointerEvents: 'none', zIndex: 30, boxShadow: 'inset 0 5px 16px rgba(0,0,0,.62),inset 4px 0 8px rgba(0,0,0,.28),inset -4px 0 8px rgba(0,0,0,.28),inset 0 -3px 6px rgba(0,0,0,.18)' }} />

                {/* Glass panel */}
                <div style={{ position: 'absolute', inset: 0, borderRadius: 'inherit', pointerEvents: 'none', zIndex: 37, overflow: 'hidden' }}>
                  <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(168deg, rgba(210,230,255,.03) 0%, rgba(190,215,255,.01) 50%, rgba(150,190,255,.005) 100%)' }} />
                  <div style={{ position: 'absolute', inset: 0, boxShadow: 'inset 0 2px 5px rgba(0,0,0,.28),inset 2px 0 4px rgba(0,0,0,.14),inset -2px 0 4px rgba(0,0,0,.14),inset 0 -2px 4px rgba(0,0,0,.18),inset 0 0 0 1px rgba(255,255,255,.08)', borderRadius: 'inherit' }} />
                </div>

              </div>{/* end LCD */}
            </div>{/* end mount bay */}

            {/* Model badge */}
            <div style={{ margin: '5px 0 6px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <span style={{ fontFamily: "'Press Start 2P',monospace", fontSize: 7, color: 'color-mix(in srgb, var(--ink) 52%, transparent)', letterSpacing: .8, whiteSpace: 'nowrap' }}>PPL-001 · S/N 8472</span>
            </div>

            {/* Button pad */}
            <div style={{ padding: '7px 20px 21px', position: 'relative', zIndex: 2 }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 20 }}>
                <div style={{ width: 70, height: 52, borderRadius: 26, background: 'color-mix(in srgb, var(--shellDark) 62%, #000)', boxShadow: 'inset 0 -4px 8px rgba(0,0,0,.75),inset 0 -1px 0 rgba(0,0,0,.55)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <button onClick={onC} onPointerDown={() => setPressedBtn('BCK')} onPointerUp={() => setPressedBtn(null)} onPointerLeave={() => setPressedBtn(null)} style={ovalBtn('BCK', pressedBtn === 'BCK', btnColors?.bck)}>BCK</button>
                </div>
                <div style={{ width: 74, height: 74, borderRadius: '50%', background: 'color-mix(in srgb, var(--shellDark) 62%, #000)', boxShadow: 'inset 0 -4px 8px rgba(0,0,0,.75),inset 0 -1px 0 rgba(0,0,0,.55)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <button onClick={onB} onPointerDown={() => setPressedBtn('ENT')} onPointerUp={() => setPressedBtn(null)} onPointerLeave={() => setPressedBtn(null)} style={roundBtn(pressedBtn === 'ENT', btnColors?.ent)}>ENT</button>
                </div>
                <div style={{ width: 70, height: 52, borderRadius: 26, background: 'color-mix(in srgb, var(--shellDark) 62%, #000)', boxShadow: 'inset 0 -4px 8px rgba(0,0,0,.75),inset 0 -1px 0 rgba(0,0,0,.55)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <button onClick={onA} onPointerDown={() => setPressedBtn('SEL')} onPointerUp={() => setPressedBtn(null)} onPointerLeave={() => setPressedBtn(null)} style={ovalBtn('SEL', pressedBtn === 'SEL', btnColors?.cfg)}>CFG</button>
                </div>
              </div>
            </div>

          </div>{/* end bezel */}
        </div>{/* end scale wrapper */}
    </div>,
    document.body
  )
}
