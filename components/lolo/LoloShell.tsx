'use client'

import { useState } from 'react'
import LoloChat from './LoloChat'
import LoloConfig from './LoloConfig'
import { S, DEVICE_W, DEVICE_H, STYLE, IDLE_POOL } from './LoloConstants'
import type { Mode, Bubble, ChatMessage, TemperamentState, SettingsRow } from './LoloTypes'

interface LoloShellProps {
  pos: { x: number; y: number }
  cssVars: React.CSSProperties
  distressVal: number
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
  onInputKey: (e: React.KeyboardEvent<HTMLInputElement>) => void
  onSend: () => void
  onA: () => void
  onB: () => void
  onC: () => void
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

function ovalBtn(which: 'SEL' | 'BCK', pressed: boolean): React.CSSProperties {
  return {
    ...btnBase, width: 58, height: 36, borderRadius: 18, fontSize: 8, color: 'var(--ink)',
    background: pressed
      ? 'linear-gradient(170deg, color-mix(in srgb, var(--btn) 68%, #000) 0%, var(--btn) 100%)'
      : 'linear-gradient(170deg, color-mix(in srgb, var(--btn) 92%, #fff) 0%, var(--btn) 52%, color-mix(in srgb, var(--btn) 78%, #000) 100%)',
    boxShadow: pressed
      ? 'inset 0 2px 5px rgba(0,0,0,.5),inset 0 1px 2px rgba(0,0,0,.25)'
      : 'inset 0 6px 0 rgba(255,255,255,.68),inset 0 -2px 0 rgba(0,0,0,.22),0 5px 0 color-mix(in srgb, var(--btn) 22%, #000),0 6px 4px rgba(0,0,0,.35)',
    transform: pressed ? 'translateY(1px)' : undefined,
  }
}

function roundBtn(pressed: boolean): React.CSSProperties {
  return {
    ...btnBase, width: 60, height: 60, borderRadius: '50%', fontSize: 8, color: 'var(--ink)',
    background: pressed
      ? 'radial-gradient(circle at 40% 40%, color-mix(in srgb, var(--btn) 72%, #000) 0%, color-mix(in srgb, var(--btn) 52%, #000) 100%)'
      : 'radial-gradient(circle at 32% 26%, color-mix(in srgb, var(--btn) 96%, #fff) 0%, var(--btn) 42%, color-mix(in srgb, var(--btn) 72%, #000) 100%)',
    boxShadow: pressed
      ? 'inset 0 3px 6px rgba(0,0,0,.5),inset 0 1px 2px rgba(0,0,0,.28)'
      : 'inset 0 7px 0 rgba(255,255,255,.68),inset 0 -2px 0 rgba(0,0,0,.22),0 6px 0 color-mix(in srgb, var(--btn) 22%, #000),0 8px 5px rgba(0,0,0,.38)',
    transform: pressed ? 'translateY(2px)' : undefined,
  }
}

export default function LoloShell({
  pos, cssVars, distressVal, scanlinesOn, netOk,
  time, temperament, mode, busy, bubble, chatMessages, showFloorShadow, bgImage,
  containerRef, frameRef, imgRef, dialogueRef, messagesRef, inputRef, dragging,
  onPointerDown, onPointerMove, onPointerUp, onFaceClick, onScrollDown,
  onInputKey, onSend, onA, onB, onC,
  settingsRowData, settingsSel, setSettingsSel, cycleSetting,
}: LoloShellProps) {
  const [pressedBtn, setPressedBtn] = useState<'SEL' | 'ENT' | 'BCK' | null>(null)

  return (
    <>
      <style dangerouslySetInnerHTML={{ __html: STYLE }} />

      <div
        ref={containerRef}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        style={{ position: 'fixed', left: pos.x, top: pos.y, zIndex: 9999, width: DEVICE_W * S, height: DEVICE_H * S, cursor: dragging.current ? 'grabbing' : 'grab', userSelect: 'none', touchAction: 'none' }}
      >
        {/* Scale wrapper — holds all CSS vars */}
        <div style={{ transform: `scale(${S})`, transformOrigin: 'top left', width: DEVICE_W, ...cssVars }}>

          {/* Scroll dial — side-mounted, sits behind the bezel */}
          <div style={{ position: 'absolute', left: -8, top: '22%' }}>
            <div style={{ width: 14, height: 100, borderRadius: '6px 0 0 6px', background: 'repeating-linear-gradient(180deg, rgba(0,0,0,.42) 0 1.5px, rgba(255,255,255,.16) 1.5px 3px, transparent 3px 5.5px), linear-gradient(180deg, #36302b 0%, #8a7f77 22%, #d6cbc3 50%, #8a7f77 78%, #36302b 100%)', boxShadow: '-3px 2px 7px rgba(0,0,0,.55),inset 2px 0 3px rgba(255,255,255,.28)' }} />
          </div>

          {/* Power switch — right side */}
          <div style={{ position: 'absolute', right: -13, top: '28%', zIndex: 1 }}>
            <div style={{ width: 13, height: 52, borderRadius: '0 4px 4px 0', background: 'linear-gradient(180deg,#2a2620 0%,#3e3830 50%,#1e1a16 100%)', boxShadow: '3px 2px 6px rgba(0,0,0,.5),inset 0 1px 0 rgba(255,255,255,.1),inset 2px 0 3px rgba(0,0,0,.3)', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
              <div style={{ flex: 1, background: 'linear-gradient(180deg,#4a4540 0%,#5a5248 100%)', borderBottom: '1px solid #1a1612', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <div style={{ width: 3, height: 3, borderRadius: '50%', background: 'rgba(255,255,255,.18)' }} />
              </div>
              <div style={{ flex: 1, background: 'linear-gradient(180deg,#2a2520 0%,#1e1a16 100%)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <div style={{ width: 4, height: 1, borderRadius: 1, background: 'rgba(255,255,255,.1)' }} />
              </div>
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
          <div style={{ position: 'relative', width: 483, isolation: 'isolate', background: 'linear-gradient(135deg, var(--shellLight,#c8bdb5) 0%, var(--shellMid,#b8aea5) 50%, var(--shellDark,#a89a92) 100%)', border: '6px solid var(--shellBorder,#8a7f77)', boxShadow: '0 8px 24px rgba(0,0,0,.35),inset 0 1px 0 rgba(255,255,255,.15),inset 0 -2px 4px rgba(0,0,0,.2)', borderRadius: '24px 24px 62px 62px', padding: '26px 28px 60px', animation: 'deviceSway 4s ease-in-out infinite', imageRendering: 'pixelated' }}>

            {/* Tunable drop shadow */}
            <div style={{ position: 'absolute', inset: 0, borderRadius: '24px 24px 62px 62px', pointerEvents: 'none', zIndex: -1, boxShadow: `0 calc(8px + var(--shadowDepth,0.55) * 26px) calc(18px + var(--shadowDepth,0.55) * 44px) calc(var(--shadowDepth,0.55) * 6px) rgba(0,0,0,calc(0.16 + var(--shadowDepth,0.55) * 0.4))` }} />

            {/* Shell glare */}
            <div style={{ position: 'absolute', inset: 0, borderRadius: '18px 18px 56px 56px', pointerEvents: 'none', zIndex: -1, overflow: 'hidden' }}>
              <div style={{ position: 'absolute', top: '-20%', left: 0, width: 200, height: '140%', background: 'linear-gradient(90deg,rgba(255,255,255,0) 0%,rgba(255,255,255,.02) 18%,rgba(255,255,255,.06) 42%,rgba(255,255,255,.07) 50%,rgba(255,255,255,.06) 58%,rgba(255,255,255,.02) 82%,rgba(255,255,255,0) 100%)', animation: 'plasticShimmer 22s ease-in-out 2s infinite' }} />
              <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(138deg,rgba(255,255,255,.02) 0%,rgba(255,255,255,.005) 35%,transparent 60%)', animation: 'plasticPulse 12s ease-in-out infinite' }} />
            </div>

            {/* Highlight sheen */}
            <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 58, borderRadius: '20px 20px 4px 4px', pointerEvents: 'none', zIndex: 2, background: 'linear-gradient(150deg, rgba(255,255,255,.95) 0%, rgba(255,255,255,.3) 30%, rgba(255,255,255,0) 100%)', opacity: 'var(--highlight,0.45)' as unknown as number }} />

            {/* Inner depth */}
            <div style={{ position: 'absolute', inset: 0, borderRadius: '20px 20px 58px 58px', pointerEvents: 'none', zIndex: 2, boxShadow: 'inset 0 calc(2px + var(--shadowDepth,0.55) * 3px) calc(3px + var(--highlight,0.45) * 8px) rgba(255,255,255,calc(var(--highlight,0.45) * 0.55)),inset 0 calc(-4px - var(--shadowDepth,0.55) * 9px) calc(8px + var(--shadowDepth,0.55) * 18px) rgba(0,0,0,calc(0.12 + var(--shadowDepth,0.55) * 0.4)),inset calc(3px + var(--highlight,0.45) * 3px) 0 calc(4px + var(--highlight,0.45) * 6px) rgba(255,255,255,calc(var(--highlight,0.45) * 0.25))' }} />

            {/* Shell discoloration */}
            {distressVal >= 0.36 && (
              <div style={{ position: 'absolute', inset: 0, borderRadius: '24px 24px 62px 62px', pointerEvents: 'none', zIndex: 4, background: `linear-gradient(145deg, rgba(180,140,60,${((distressVal - 0.36) / 0.64 * 0.28).toFixed(2)}) 0%, rgba(120,90,40,${((distressVal - 0.36) / 0.64 * 0.22).toFixed(2)}) 60%, rgba(80,60,30,${((distressVal - 0.36) / 0.64 * 0.35).toFixed(2)}) 100%)` }} />
            )}

            {/* Case scratches — MINT+ */}
            {distressVal >= 0.1 && (
              <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none', zIndex: 5, imageRendering: 'pixelated', opacity: Math.min(1, distressVal * 1.15) }}>
                <svg style={{ position: 'absolute', top: '28%', left: 22 }} width="42" height="42" viewBox="0 0 42 42">
                  <rect x="0"  y="0"  width="2" height="2" fill="rgba(255,255,255,.55)"/><rect x="4"  y="4"  width="2" height="2" fill="rgba(255,255,255,.5)"/>
                  <rect x="8"  y="8"  width="2" height="2" fill="rgba(255,255,255,.45)"/><rect x="12" y="12" width="2" height="2" fill="rgba(255,255,255,.42)"/>
                  <rect x="16" y="16" width="2" height="2" fill="rgba(255,255,255,.38)"/><rect x="20" y="20" width="2" height="2" fill="rgba(255,255,255,.35)"/>
                  <rect x="2"  y="2"  width="2" height="2" fill="rgba(0,0,0,.68)"/><rect x="6"  y="6"  width="2" height="2" fill="rgba(0,0,0,.62)"/>
                  <rect x="10" y="10" width="2" height="2" fill="rgba(0,0,0,.58)"/><rect x="14" y="14" width="2" height="2" fill="rgba(0,0,0,.54)"/>
                  <rect x="18" y="18" width="2" height="2" fill="rgba(0,0,0,.5)"/><rect x="22" y="22" width="2" height="2" fill="rgba(0,0,0,.45)"/>
                </svg>
                <svg style={{ position: 'absolute', bottom: 58, left: 14 }} width="18" height="18" viewBox="0 0 18 18">
                  <rect x="0" y="0" width="2" height="2" fill="rgba(255,255,255,.5)"/><rect x="4" y="4" width="2" height="2" fill="rgba(255,255,255,.42)"/>
                  <rect x="8" y="8" width="2" height="2" fill="rgba(255,255,255,.35)"/>
                  <rect x="2" y="2" width="2" height="2" fill="rgba(0,0,0,.65)"/><rect x="6" y="6" width="2" height="2" fill="rgba(0,0,0,.55)"/>
                  <rect x="10" y="10" width="2" height="2" fill="rgba(0,0,0,.45)"/>
                </svg>
              </div>
            )}

            {/* Corner dents — GOOD and above */}
            {distressVal >= 0.2 && (<>
              <svg style={{ position: 'absolute', top: 5, left: 5, opacity: Math.min(1, distressVal * 1.3), imageRendering: 'pixelated' }} width="22" height="22" viewBox="0 0 22 22">
                <rect x="2" y="2" width="4" height="2" fill="rgba(255,255,255,.6)"/><rect x="2" y="4" width="2" height="4" fill="rgba(255,255,255,.45)"/>
                <rect x="4" y="4" width="4" height="4" fill="rgba(0,0,0,.7)"/><rect x="6" y="2" width="2" height="2" fill="rgba(0,0,0,.55)"/>
                <rect x="2" y="8" width="2" height="2" fill="rgba(0,0,0,.5)"/>
              </svg>
              <svg style={{ position: 'absolute', top: 5, right: 5, opacity: Math.min(1, distressVal * 1.15), imageRendering: 'pixelated' }} width="22" height="22" viewBox="0 0 22 22">
                <rect x="16" y="2" width="4" height="2" fill="rgba(255,255,255,.55)"/><rect x="18" y="4" width="2" height="4" fill="rgba(255,255,255,.4)"/>
                <rect x="12" y="4" width="4" height="4" fill="rgba(0,0,0,.65)"/><rect x="14" y="2" width="2" height="2" fill="rgba(0,0,0,.5)"/>
                <rect x="18" y="8" width="2" height="2" fill="rgba(0,0,0,.45)"/>
              </svg>
            </>)}

            {/* Side scratches — WORN and above */}
            {distressVal >= 0.36 && (<>
              <svg style={{ position: 'absolute', top: '36%', left: 6, opacity: Math.min(1, (distressVal - 0.36) / 0.64 * 1.1), imageRendering: 'pixelated' }} width="8" height="36" viewBox="0 0 8 36">
                <rect x="0" y="0" width="2" height="2" fill="rgba(255,255,255,.6)"/><rect x="0" y="4" width="2" height="2" fill="rgba(255,255,255,.55)"/>
                <rect x="0" y="8" width="2" height="2" fill="rgba(255,255,255,.5)"/><rect x="0" y="12" width="2" height="2" fill="rgba(255,255,255,.45)"/>
                <rect x="0" y="18" width="2" height="2" fill="rgba(255,255,255,.4)"/><rect x="0" y="24" width="2" height="2" fill="rgba(255,255,255,.35)"/>
                <rect x="0" y="30" width="2" height="2" fill="rgba(255,255,255,.3)"/>
                <rect x="2" y="2" width="2" height="2" fill="rgba(0,0,0,.7)"/><rect x="2" y="6" width="2" height="2" fill="rgba(0,0,0,.65)"/>
                <rect x="2" y="10" width="2" height="2" fill="rgba(0,0,0,.6)"/><rect x="2" y="14" width="2" height="2" fill="rgba(0,0,0,.55)"/>
                <rect x="2" y="20" width="2" height="2" fill="rgba(0,0,0,.5)"/><rect x="2" y="26" width="2" height="2" fill="rgba(0,0,0,.45)"/>
                <rect x="2" y="32" width="2" height="2" fill="rgba(0,0,0,.4)"/>
              </svg>
              <svg style={{ position: 'absolute', top: '58%', right: 7, opacity: Math.min(1, (distressVal - 0.36) / 0.64 * 0.9), imageRendering: 'pixelated' }} width="8" height="22" viewBox="0 0 8 22">
                <rect x="0" y="0" width="2" height="2" fill="rgba(255,255,255,.55)"/><rect x="0" y="4" width="2" height="2" fill="rgba(255,255,255,.48)"/>
                <rect x="0" y="8" width="2" height="2" fill="rgba(255,255,255,.4)"/><rect x="0" y="14" width="2" height="2" fill="rgba(255,255,255,.35)"/>
                <rect x="2" y="2" width="2" height="2" fill="rgba(0,0,0,.65)"/><rect x="2" y="6" width="2" height="2" fill="rgba(0,0,0,.58)"/>
                <rect x="2" y="10" width="2" height="2" fill="rgba(0,0,0,.5)"/><rect x="2" y="16" width="2" height="2" fill="rgba(0,0,0,.42)"/>
              </svg>
              <svg style={{ position: 'absolute', top: '20%', left: 18, opacity: Math.min(1, (distressVal - 0.36) / 0.64 * 0.8), imageRendering: 'pixelated' }} width="28" height="6" viewBox="0 0 28 6">
                <rect x="0" y="0" width="2" height="2" fill="rgba(255,255,255,.5)"/><rect x="4" y="0" width="2" height="2" fill="rgba(255,255,255,.45)"/>
                <rect x="8" y="0" width="2" height="2" fill="rgba(255,255,255,.4)"/><rect x="12" y="0" width="2" height="2" fill="rgba(255,255,255,.35)"/>
                <rect x="16" y="0" width="2" height="2" fill="rgba(255,255,255,.3)"/>
                <rect x="2" y="2" width="2" height="2" fill="rgba(0,0,0,.65)"/><rect x="6" y="2" width="2" height="2" fill="rgba(0,0,0,.6)"/>
                <rect x="10" y="2" width="2" height="2" fill="rgba(0,0,0,.55)"/><rect x="14" y="2" width="2" height="2" fill="rgba(0,0,0,.5)"/>
                <rect x="18" y="2" width="2" height="2" fill="rgba(0,0,0,.42)"/>
              </svg>
            </>)}

            {/* Heavy dents + deep gouges — BATTERED and above */}
            {distressVal >= 0.54 && (
              <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none', zIndex: 6, imageRendering: 'pixelated', opacity: Math.min(1, (distressVal - 0.54) / 0.46 * 1.15) }}>
                <svg style={{ position: 'absolute', bottom: 6, left: 6 }} width="24" height="20" viewBox="0 0 24 20">
                  <rect x="0" y="4" width="6" height="6" fill="rgba(0,0,0,.78)"/><rect x="6" y="2" width="6" height="2" fill="rgba(0,0,0,.65)"/>
                  <rect x="0" y="2" width="6" height="2" fill="rgba(255,255,255,.4)"/><rect x="0" y="10" width="6" height="2" fill="rgba(255,255,255,.32)"/>
                  <rect x="6" y="4" width="2" height="4" fill="rgba(255,255,255,.28)"/>
                </svg>
                <svg style={{ position: 'absolute', bottom: 6, right: 6 }} width="24" height="20" viewBox="0 0 24 20">
                  <rect x="18" y="4" width="6" height="6" fill="rgba(0,0,0,.75)"/><rect x="12" y="2" width="6" height="2" fill="rgba(0,0,0,.62)"/>
                  <rect x="18" y="2" width="6" height="2" fill="rgba(255,255,255,.38)"/><rect x="18" y="10" width="6" height="2" fill="rgba(255,255,255,.3)"/>
                  <rect x="16" y="4" width="2" height="4" fill="rgba(255,255,255,.25)"/>
                </svg>
                <svg style={{ position: 'absolute', top: '25%', right: 12 }} width="16" height="50" viewBox="0 0 16 50">
                  <rect x="8" y="0" width="2" height="2" fill="rgba(255,255,255,.6)"/><rect x="6" y="4" width="2" height="2" fill="rgba(255,255,255,.55)"/>
                  <rect x="4" y="8" width="2" height="2" fill="rgba(255,255,255,.5)"/><rect x="2" y="12" width="2" height="2" fill="rgba(255,255,255,.45)"/>
                  <rect x="0" y="16" width="2" height="2" fill="rgba(255,255,255,.4)"/><rect x="0" y="20" width="2" height="2" fill="rgba(255,255,255,.35)"/>
                  <rect x="2" y="24" width="2" height="2" fill="rgba(255,255,255,.3)"/>
                  <rect x="10" y="2" width="2" height="2" fill="rgba(0,0,0,.72)"/><rect x="8" y="6" width="2" height="2" fill="rgba(0,0,0,.66)"/>
                  <rect x="6" y="10" width="2" height="2" fill="rgba(0,0,0,.62)"/><rect x="4" y="14" width="2" height="2" fill="rgba(0,0,0,.58)"/>
                  <rect x="2" y="18" width="2" height="2" fill="rgba(0,0,0,.52)"/><rect x="2" y="22" width="2" height="2" fill="rgba(0,0,0,.46)"/>
                  <rect x="4" y="26" width="2" height="2" fill="rgba(0,0,0,.4)"/>
                </svg>
              </div>
            )}

            {/* Button wear glow */}
            <div style={{ position: 'absolute', bottom: 52, left: '50%', transform: 'translateX(-50%)', width: 180, height: 36, borderRadius: '50%', background: 'radial-gradient(ellipse, rgba(255,255,255,.06), transparent 70%)', pointerEvents: 'none' }} />

            {/* Mic punch holes */}
            <div style={{ position: 'absolute', top: 9, left: '50%', transform: 'translateX(-50%)', background: '#090705', borderRadius: 3, padding: '3px 10px', boxShadow: 'inset 0 1px 3px rgba(0,0,0,.98),0 1px 0 rgba(255,255,220,.08)', display: 'flex', gap: 3, alignItems: 'center', pointerEvents: 'none', zIndex: 5 }}>
              {Array.from({ length: 7 }).map((_, i) => (
                <div key={i} style={{ width: 2, height: 2, borderRadius: '50%', background: '#020100', boxShadow: 'inset 0 1px 1px rgba(0,0,0,.95)' }} />
              ))}
            </div>

            {/* Power LED */}
            <div style={{ position: 'absolute', top: '22%', right: -18, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4, pointerEvents: 'none', zIndex: 10 }}>
              <div style={{ width: 13, height: 32, borderRadius: '0 5px 5px 0', background: '#0d0a08', boxShadow: '-2px 2px 7px rgba(0,0,0,.6),inset 2px 0 3px rgba(255,255,255,.10)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <div style={{ width: 5, height: 20, borderRadius: 2, animation: `${netOk ? 'adanLedGreen 2.8s ease-in-out' : 'adanLedRed 0.9s steps(1)'} infinite` }} />
              </div>
              <div style={{ fontFamily: "'Press Start 2P',monospace", fontSize: 4, color: 'rgba(80,68,56,.38)', letterSpacing: .4, writingMode: 'vertical-rl', transform: 'rotate(180deg)' }}>PWR</div>
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
            <div style={{ background: '#0e0b09', borderRadius: 10, padding: 9, boxShadow: 'inset 0 8px 22px rgba(0,0,0,.98),inset 8px 0 14px rgba(0,0,0,.85),inset -8px 0 14px rgba(0,0,0,.85),inset 0 -4px 10px rgba(0,0,0,.7),0 0 0 1px rgba(255,255,255,.07),0 1px 0 rgba(255,255,255,.04)' }}>
              {/* LCD */}
              <div style={{ position: 'relative', height: 610, border: '2px solid rgba(0,0,0,.95)', borderBottomColor: 'rgba(0,0,0,.5)', borderRadius: '6px 6px 0 0', overflow: 'hidden', background: `linear-gradient(180deg, color-mix(in srgb, var(--lcd) 86%, #fff) 0%, var(--lcd) 52%, color-mix(in srgb, var(--lcd) 88%, #000) 100%)`, imageRendering: 'pixelated', display: 'flex', flexDirection: 'column' }}>

                {/* Background */}
                <div style={{ position: 'absolute', inset: -60, zIndex: 0, pointerEvents: 'none', backgroundImage: `url(${bgImage})`, backgroundSize: 'cover', backgroundPosition: 'top center', opacity: .65, animation: 'gardenDrift 28s ease-in-out infinite' }} />

                {/* Light shaft */}
                <div style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, zIndex: 0, pointerEvents: 'none', overflow: 'hidden' }}>
                  <div style={{ position: 'absolute', top: '-20%', left: '20%', width: 60, height: '140%', background: 'linear-gradient(180deg,rgba(255,248,200,0),rgba(255,248,200,.18) 30%,rgba(255,248,200,.18) 70%,rgba(255,248,200,0))', transform: 'skewX(-12deg)', animation: 'gardenLight 18s ease-in-out infinite' }} />
                </div>

                {/* Ground gradient */}
                <div style={{ position: 'absolute', left: 0, right: 0, bottom: 0, height: 74, zIndex: 1, background: 'linear-gradient(180deg, transparent, rgba(170,185,140,.5))', pointerEvents: 'none' }} />

                {/* HUD: top strip */}
                <div style={{ position: 'absolute', top: 0, left: 0, right: 0, zIndex: 36, background: 'color-mix(in srgb, var(--lcd) 92%, #000)', borderBottom: '3px solid var(--ink)', borderRadius: '6px 6px 0 0' }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '4px 11px 3px', pointerEvents: 'none' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                      <span style={{ color: '#c05a52', fontSize: 13, lineHeight: 1, animation: 'adanHeart 2.6s ease-in-out infinite', display: 'inline-block' }}>♥︎</span>
                      <span style={{ fontFamily: "'Press Start 2P',monospace", fontSize: 10, letterSpacing: 1, color: 'var(--ink)' }}>LOLO</span>
                      <span style={{ fontFamily: "'Press Start 2P',monospace", fontSize: 10, letterSpacing: 1, color: 'var(--ink)', opacity: .35 }}>·</span>
                      <span style={{ fontFamily: "'Press Start 2P',monospace", fontSize: 8, letterSpacing: .5, color: 'var(--ink)', opacity: .85 }}>{temperament.current}</span>
                      {mode === 'chat' && <span style={{ fontFamily: "'Press Start 2P',monospace", fontSize: 7, letterSpacing: .5, color: 'var(--ink)', opacity: .5, marginLeft: 4 }}>CHAT</span>}
                    </div>
                    <div style={{ fontFamily: "'Press Start 2P',monospace", fontSize: 9, lineHeight: 1, color: 'var(--ink)', opacity: .9, letterSpacing: 1 }}>{time}</div>
                  </div>
                </div>

                {/* Flex column: character + chat, fills LCD below HUD */}
                <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', padding: 0, margin: 0, zIndex: 3, minHeight: 0 }}>
                  <div style={{ height: 26, flexShrink: 0, pointerEvents: 'none' }} />

                  {/* Character area */}
                  <div style={{ flex: 1, position: 'relative', overflow: 'hidden', minHeight: 0 }}>
                    {showFloorShadow && (
                      <div style={{ position: 'absolute', bottom: 8, left: '50%', transform: 'translateX(-50%)', zIndex: 4, animation: 'adanShadow 7.5s ease-in-out infinite' }}>
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
                      <div style={{ position: 'absolute', inset: 0, transformOrigin: '50% 28%', animation: 'adanBreathe 5.5s ease-in-out infinite' }}>
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          ref={imgRef}
                          src={IDLE_POOL[0]}
                          alt="Lolo"
                          draggable={false}
                          onClick={onFaceClick}
                          onError={e => { const el = e.target as HTMLImageElement; if (!el.src.endsWith('lolo_idle_2.png')) el.src = IDLE_POOL[0] }}
                          style={{ width: '100%', height: '100%', objectFit: 'cover', objectPosition: 'center top', transform: 'translateY(8%) scale(1.23)', transformOrigin: 'top center', display: 'block', cursor: 'pointer', imageRendering: 'pixelated', userSelect: 'none', filter: 'drop-shadow(0 7px 7px rgba(40,30,10,.22))' }}
                        />
                      </div>
                    </div>
                  </div>
                </div>

                {/* Chat overlay + dialogue bubble */}
                <LoloChat
                  mode={mode} busy={busy} chatMessages={chatMessages} bubble={bubble}
                  messagesRef={messagesRef} inputRef={inputRef} dialogueRef={dialogueRef}
                  onInputKey={onInputKey} onSend={onSend} onScrollDown={onScrollDown}
                />

                {/* Settings overlay */}
                {mode === 'cfg' && (
                  <LoloConfig
                    settingsRowData={settingsRowData} settingsSel={settingsSel}
                    setSettingsSel={setSettingsSel} cycleSetting={cycleSetting}
                  />
                )}

                {/* Dither */}
                <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none', zIndex: 24, backgroundImage: 'repeating-conic-gradient(rgba(0,0,0,.6) 0% 25%, transparent 0% 50%)', backgroundSize: '3px 3px', opacity: .05 }} />

                {/* Screen dimming */}
                {distressVal > 0.1 && <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none', zIndex: 24, background: `rgba(0,0,0,${Math.min(0.32, (distressVal - 0.1) / 0.9 * 0.32).toFixed(3)})` }} />}

                {/* Scanlines */}
                {scanlinesOn && <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none', zIndex: 25, background: 'repeating-linear-gradient(0deg, rgba(0,0,0,.12) 0px, rgba(0,0,0,.12) 1px, transparent 1px, transparent 3px)', mixBlendMode: 'multiply', opacity: .7 }} />}

                {/* LCD shadow */}
                <div style={{ position: 'absolute', inset: 0, borderRadius: 'inherit', pointerEvents: 'none', zIndex: 30, boxShadow: 'inset 0 5px 16px rgba(0,0,0,.62),inset 4px 0 8px rgba(0,0,0,.28),inset -4px 0 8px rgba(0,0,0,.28),inset 0 -3px 6px rgba(0,0,0,.18)' }} />

                {/* Screen scratches — BATTERED and above */}
                {distressVal >= 0.54 && (
                  <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none', zIndex: 31, imageRendering: 'pixelated', opacity: Math.min(1, (distressVal - 0.54) / 0.46 * 1.4) }}>
                    <svg style={{ position: 'absolute', top: '18%', left: '15%' }} width="70" height="4" viewBox="0 0 70 4">
                      <rect x="0"  y="1" width="24" height="1" fill="rgba(255,255,255,.65)"/>
                      <rect x="24" y="2" width="18" height="1" fill="rgba(255,255,255,.4)"/>
                      <rect x="42" y="1" width="28" height="1" fill="rgba(255,255,255,.55)"/>
                    </svg>
                    <svg style={{ position: 'absolute', top: '40%', right: '10%' }} width="4" height="60" viewBox="0 0 4 60">
                      <rect x="1" y="0"  width="1" height="20" fill="rgba(255,255,255,.55)"/>
                      <rect x="2" y="18" width="1" height="18" fill="rgba(255,255,255,.35)"/>
                      <rect x="1" y="34" width="1" height="26" fill="rgba(255,255,255,.5)"/>
                    </svg>
                    <svg style={{ position: 'absolute', top: '60%', left: '25%' }} width="50" height="4" viewBox="0 0 50 4">
                      <rect x="0"  y="1" width="18" height="1" fill="rgba(255,255,255,.5)"/>
                      <rect x="20" y="2" width="12" height="1" fill="rgba(255,255,255,.35)"/>
                      <rect x="34" y="1" width="16" height="1" fill="rgba(255,255,255,.45)"/>
                    </svg>
                  </div>
                )}

                {/* Deep screen cracks — RELIC only */}
                {distressVal >= 0.85 && (
                  <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none', zIndex: 32, imageRendering: 'pixelated', opacity: (distressVal - 0.85) / 0.15 }}>
                    <svg style={{ position: 'absolute', top: '8%', left: '30%' }} width="90" height="90" viewBox="0 0 90 90">
                      <polyline points="0,0 8,12 4,28 14,44 10,60 20,80 24,90" fill="none" stroke="rgba(255,255,255,.7)" strokeWidth="1"/>
                      <polyline points="8,12 22,16 38,12" fill="none" stroke="rgba(255,255,255,.5)" strokeWidth="1"/>
                      <polyline points="14,44 30,48 44,44 56,50" fill="none" stroke="rgba(255,255,255,.45)" strokeWidth="1"/>
                    </svg>
                    <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(135deg, rgba(180,160,120,.08) 0%, transparent 50%, rgba(100,80,50,.12) 100%)' }} />
                  </div>
                )}

                {/* Glass panel */}
                <div style={{ position: 'absolute', inset: 0, borderRadius: 'inherit', pointerEvents: 'none', zIndex: 37, overflow: 'hidden' }}>
                  <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(168deg, rgba(210,230,255,.03) 0%, rgba(190,215,255,.01) 50%, rgba(150,190,255,.005) 100%)' }} />
                  <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: '48%', background: 'linear-gradient(180deg, rgba(255,255,255,.07) 0%, rgba(255,255,255,.02) 55%, transparent 100%)', animation: 'glassBreath 7s ease-in-out infinite' }} />
                  <div style={{ position: 'absolute', top: '-10%', bottom: '-10%', width: 55, background: 'linear-gradient(90deg, transparent 0%, rgba(255,255,255,.08) 50%, transparent 100%)', animation: 'glassShimmer 16s ease-in-out 5s infinite' }} />
                  <div style={{ position: 'absolute', top: '-10%', bottom: '-10%', width: 30, background: 'linear-gradient(90deg, transparent, rgba(255,255,255,.04) 50%, transparent)', animation: 'glassShimmer 16s ease-in-out 11s infinite' }} />
                  <div style={{ position: 'absolute', inset: 0, boxShadow: 'inset 0 2px 5px rgba(0,0,0,.28),inset 2px 0 4px rgba(0,0,0,.14),inset -2px 0 4px rgba(0,0,0,.14),inset 0 -2px 4px rgba(0,0,0,.18),inset 0 0 0 1px rgba(255,255,255,.08)', borderRadius: 'inherit' }} />
                  <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: '28%', background: 'linear-gradient(0deg, rgba(255,248,200,.02) 0%, transparent 100%)', animation: 'glassGlow 9s ease-in-out infinite' }} />
                </div>

              </div>{/* end LCD */}
            </div>{/* end mount bay */}

            {/* Model badge */}
            <div style={{ margin: '8px 0 10px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <span style={{ fontFamily: "'Press Start 2P',monospace", fontSize: 7, color: 'color-mix(in srgb, var(--ink) 52%, transparent)', letterSpacing: .8, whiteSpace: 'nowrap' }}>PPL-001 · S/N 8472</span>
            </div>

            {/* Button pad */}
            <div style={{ position: 'relative', background: 'color-mix(in srgb, var(--shellDark) 75%, #000)', borderRadius: 10, padding: '12px 20px 12px', border: '2px solid var(--shellBorder)', boxShadow: 'inset 0 4px 10px rgba(0,0,0,.28),inset 0 2px 4px rgba(0,0,0,.16),inset 0 -2px 0 rgba(255,255,255,.14)' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 20 }}>
                <div style={{ width: 70, height: 52, borderRadius: 26, background: 'color-mix(in srgb, var(--shellDark) 62%, #000)', boxShadow: 'inset 0 -4px 8px rgba(0,0,0,.75),inset 0 -1px 0 rgba(0,0,0,.55)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <button onClick={onA} onPointerDown={() => setPressedBtn('SEL')} onPointerUp={() => setPressedBtn(null)} onPointerLeave={() => setPressedBtn(null)} style={ovalBtn('SEL', pressedBtn === 'SEL')}>CFG</button>
                </div>
                <div style={{ width: 74, height: 74, borderRadius: '50%', background: 'color-mix(in srgb, var(--shellDark) 62%, #000)', boxShadow: 'inset 0 -4px 8px rgba(0,0,0,.75),inset 0 -1px 0 rgba(0,0,0,.55)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <button onClick={onB} onPointerDown={() => setPressedBtn('ENT')} onPointerUp={() => setPressedBtn(null)} onPointerLeave={() => setPressedBtn(null)} style={roundBtn(pressedBtn === 'ENT')}>ENT</button>
                </div>
                <div style={{ width: 70, height: 52, borderRadius: 26, background: 'color-mix(in srgb, var(--shellDark) 62%, #000)', boxShadow: 'inset 0 -4px 8px rgba(0,0,0,.75),inset 0 -1px 0 rgba(0,0,0,.55)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <button onClick={onC} onPointerDown={() => setPressedBtn('BCK')} onPointerUp={() => setPressedBtn(null)} onPointerLeave={() => setPressedBtn(null)} style={ovalBtn('BCK', pressedBtn === 'BCK')}>BCK</button>
                </div>
              </div>
            </div>

          </div>{/* end bezel */}
        </div>{/* end scale wrapper */}
      </div>
    </>
  )
}
