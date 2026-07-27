'use client'

import { useEffect, useRef } from 'react'
import { useOSSettings, CRT_PHOSPHORS } from './OSSettingsContext'
import type { CrtColor } from './OSSettingsContext'

// Panel de Ajustes — piel ARCADE / terminal. Todo por TOKENS del tema (--color-*), así respeta
// MONOCOLOR y la paleta arcade DE RAÍZ (accent = cian, no el azul iOS viejo). Tipografía mono, bordes
// duros, acentos al cian/fósforo, sin blur glassmorphism. Estructura y funcionalidad idénticas.

const MONO = "'SF Mono', ui-monospace, Menlo, monospace"
const ACCENT      = 'var(--color-accent)'
const ACCENT_TINT = 'color-mix(in oklch, var(--color-accent) 14%, transparent)'
const ACCENT_LINE = 'color-mix(in oklch, var(--color-accent) 45%, transparent)'

// ── Sub-components ────────────────────────────────────────────────────────────

function Toggle({ value, onChange }: { value: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      onClick={() => onChange(!value)}
      aria-pressed={value}
      style={{
        display: 'inline-flex', alignItems: 'center', width: 38, height: 18, borderRadius: 3,
        background: value ? ACCENT_TINT : 'var(--color-surface-2)',
        border: '1px solid', borderColor: value ? ACCENT : 'var(--color-border)',
        cursor: 'pointer', transition: 'all 160ms ease', padding: 2, flexShrink: 0,
      }}
    >
      <span style={{
        width: 12, height: 12, borderRadius: 2,
        background: value ? ACCENT : 'var(--color-fg-faint)',
        transform: value ? 'translateX(20px)' : 'translateX(0)', transition: 'all 160ms ease', display: 'block',
      }} />
    </button>
  )
}

function PillSelector<T extends string>({ options, value, onChange }: {
  options: { value: T; label: string }[]; value: T; onChange: (v: T) => void
}) {
  return (
    <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
      {options.map(opt => {
        const on = value === opt.value
        return (
          <button
            key={opt.value}
            onClick={() => onChange(opt.value)}
            style={{
              padding: '3px 10px', borderRadius: 'var(--radius-control)', fontSize: 10, fontFamily: MONO,
              border: '1px solid', borderColor: on ? ACCENT : 'var(--color-border)',
              background: on ? ACCENT_TINT : 'transparent',
              color: on ? ACCENT : 'var(--color-fg-faint)',
              cursor: 'pointer', transition: 'all 140ms ease', letterSpacing: '0.04em', textTransform: 'uppercase',
            }}
          >
            {opt.label}
          </button>
        )
      })}
    </div>
  )
}

function Slider({ label, value, min, max, step, onChange, fmt }: {
  label: string; value: number; min: number; max: number; step: number
  onChange: (v: number) => void; fmt?: (v: number) => string
}) {
  // Relleno two-tone con TOKENS (mono-safe): fósforo/cian hasta el valor, surface-2 después. El
  // gris del navegador (accent-color solo tiñe el relleno, no el groove) se elimina con appearance:
  // none + este gradiente + el thumb estilado en globals.css (.os-slider).
  const pct = max > min ? ((value - min) / (max - min)) * 100 : 0
  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10, color: 'var(--color-fg-muted)', marginBottom: 5, letterSpacing: '0.05em', textTransform: 'uppercase' }}>
        <span>{label}</span>
        <span style={{ color: ACCENT, fontVariantNumeric: 'tabular-nums' }}>{fmt ? fmt(value) : value}</span>
      </div>
      <input
        className="os-slider"
        type="range" min={min} max={max} step={step} value={value}
        onChange={e => onChange(parseFloat(e.target.value))}
        style={{ width: '100%', cursor: 'pointer', background: `linear-gradient(to right, ${ACCENT} ${pct}%, var(--color-surface-2) ${pct}%)` }}
      />
    </div>
  )
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: 16 }}>
      <p style={{ fontSize: 9, fontWeight: 700, letterSpacing: '0.16em', textTransform: 'uppercase', color: 'var(--color-fg-faint)', margin: '0 0 10px' }}>
        <span style={{ color: ACCENT }}>{'// '}</span>{title}
      </p>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 9 }}>{children}</div>
    </div>
  )
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
      <span style={{ fontSize: 12, color: 'var(--color-fg-muted)', flexShrink: 1 }}>{label}</span>
      <div style={{ flexShrink: 0 }}>{children}</div>
    </div>
  )
}

// ── Panel ─────────────────────────────────────────────────────────────────────

export default function OSSettings() {
  const {
    settingsOpen, closeSettings, set, setCrt,
    showStars, showShips, showPlanes, discreto, showLolo, crt, screensaver, startScreensaver, supraconsciente,
  } = useOSSettings()

  const panelRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!settingsOpen) return
    function onKey(e: KeyboardEvent) { if (e.key === 'Escape') closeSettings() }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [settingsOpen, closeSettings])

  if (!settingsOpen) return null

  return (
    <>
      <div aria-hidden="true" onClick={closeSettings} style={{ position: 'fixed', inset: 0, zIndex: 10000, background: 'transparent' }} />

      <div
        ref={panelRef}
        role="dialog"
        aria-label="Ajustes del sistema"
        style={{
          position: 'fixed', top: 'calc(4rem + 12px)', right: 24, width: 300,
          maxHeight: 'calc(100vh - 5rem - 24px)', overflowY: 'auto',
          background: 'var(--color-surface-base)',
          border: '1.5px solid var(--color-border-strong)', borderRadius: 'var(--radius-card)',
          padding: '14px 16px', zIndex: 10001,
          boxShadow: '0 18px 50px rgba(0,0,0,0.7)',
          fontFamily: MONO, color: 'var(--color-fg)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14, paddingBottom: 12, borderBottom: '1px solid var(--color-border)' }}>
          <span style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.18em', color: 'var(--color-fg-muted)' }}>
            <span style={{ color: ACCENT }}>◈</span> AJUSTES
          </span>
          <button onClick={closeSettings} aria-label="Cerrar" style={{ fontSize: 16, lineHeight: 1, color: 'var(--color-fg-faint)', background: 'none', border: 'none', cursor: 'pointer', padding: '0 2px' }}>×</button>
        </div>

        {/* ── CRT · pantalla arcade ── */}
        <Section title="CRT · pantalla arcade">
          <Row label="Efecto CRT"><Toggle value={crt.on} onChange={v => setCrt({ on: v })} /></Row>
          {crt.on && (
            <>
              <Row label="Color">
                <PillSelector<CrtColor>
                  options={[{ value: 'mono', label: 'Monocolor' }, { value: 'multi', label: 'Multicolor' }]}
                  value={crt.color}
                  onChange={v => setCrt({ color: v })}
                />
              </Row>
              {crt.color === 'mono' && (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7,1fr)', gap: 5 }}>
                  {CRT_PHOSPHORS.map(hex => (
                    <button
                      key={hex}
                      onClick={() => setCrt({ phosphor: hex })}
                      aria-label={hex}
                      style={{
                        height: 20, borderRadius: 3, background: hex, cursor: 'pointer', padding: 0,
                        border: crt.phosphor === hex ? '2px solid var(--color-fg)' : '2px solid transparent',
                        boxShadow: crt.phosphor === hex ? '0 0 0 1.5px var(--color-surface-base)' : 'none',
                      }}
                    />
                  ))}
                </div>
              )}
              <Slider label="Glow letra" value={crt.glow} min={0} max={0.3} step={0.005} onChange={v => setCrt({ glow: v })} fmt={v => v.toFixed(3)} />
              <Slider label="Aberración" value={crt.aberr} min={0} max={2} step={0.02} onChange={v => setCrt({ aberr: v })} fmt={v => v.toFixed(2)} />
              <Slider label="Blur" value={crt.blur} min={0} max={0.8} step={0.01} onChange={v => setCrt({ blur: v })} fmt={v => v.toFixed(2)} />
              <Slider label="Fisheye" value={crt.fisheye} min={0} max={30} step={0.25} onChange={v => setCrt({ fisheye: v })} fmt={v => v.toFixed(2)} />
              <Slider label="Scanlines"  value={crt.scan} min={0} max={0.3} step={0.005} onChange={v => setCrt({ scan: v })} fmt={v => v.toFixed(3)} />
              <Slider label="Rejilla"    value={crt.dots} min={0} max={0.6} step={0.01} onChange={v => setCrt({ dots: v })} fmt={v => v.toFixed(2)} />
              <Slider label="Bloom"      value={crt.bloom} min={0} max={0.25} step={0.005} onChange={v => setCrt({ bloom: v })} fmt={v => v.toFixed(3)} />
              <Slider label="Viñeta"     value={crt.vig} min={0} max={0.4} step={0.01} onChange={v => setCrt({ vig: v })} fmt={v => v.toFixed(2)} />
              <Slider label="Barra deform." value={crt.deform} min={0} max={10} step={0.1} onChange={v => setCrt({ deform: v })} fmt={v => v.toFixed(1)} />
              <Slider label="Barra veloc." value={crt.deformSpeed} min={3} max={20} step={0.5} onChange={v => setCrt({ deformSpeed: v })} fmt={v => v + 's'} />
            </>
          )}
        </Section>

        <Section title="Fondo — Cuerpos celestes">
          <Row label="Estrellas"><Toggle value={showStars} onChange={v => set('showStars', v)} /></Row>
        </Section>

        <Section title="Fondo — Naves">
          <Row label="Naves espaciales"><Toggle value={showShips} onChange={v => set('showShips', v)} /></Row>
        </Section>

        <Section title="Fondo — Otros">
          <Row label="Aviones"><Toggle value={showPlanes} onChange={v => set('showPlanes', v)} /></Row>
        </Section>

        <Section title="Privacidad">
          <Row label="Modo discreto"><Toggle value={discreto} onChange={v => set('discreto', v)} /></Row>
        </Section>

        <Section title="Screensaver">
          <Row label="Modo screensaver"><Toggle value={screensaver.enabled} onChange={v => set('screensaver', { ...screensaver, enabled: v })} /></Row>
          {screensaver.enabled && (
            <>
              <Slider label="Vuelta completa" value={screensaver.speed} min={45} max={240} step={5} onChange={v => set('screensaver', { ...screensaver, speed: v })} fmt={v => v + 's'} />
              <button
                onClick={() => { startScreensaver(); closeSettings() }}
                style={{
                  width: '100%', marginTop: 2, padding: '7px 0', borderRadius: 'var(--radius-control)', cursor: 'pointer',
                  border: `1px solid ${ACCENT_LINE}`, background: ACCENT_TINT, color: ACCENT,
                  fontFamily: MONO, fontSize: 11, fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase',
                }}
              >
                ▶ Previsualizar ahora
              </button>
              <p style={{ fontSize: 10, color: 'var(--color-fg-faint)', margin: 0 }}>Tras 3 min sin actividad se activa solo. Mueve el mouse para salir.</p>
            </>
          )}
        </Section>

        <Section title="Supraconsciente">
          <Row label="Línea viva (Cerebro)"><Toggle value={supraconsciente.enabled} onChange={v => set('supraconsciente', { ...supraconsciente, enabled: v })} /></Row>
          {supraconsciente.enabled && (
            <Slider label="Rotación" value={supraconsciente.rotateMinutes} min={2} max={15} step={1} onChange={v => set('supraconsciente', { ...supraconsciente, rotateMinutes: v })} fmt={v => v + ' min'} />
          )}
        </Section>

        <Section title="Widgets">
          <Row label="Lolo"><Toggle value={showLolo} onChange={v => set('showLolo', v)} /></Row>
          <p style={{ fontSize: 10, color: 'var(--color-fg-faint)', margin: 0 }}>Más widgets próximamente</p>
        </Section>
      </div>
    </>
  )
}
