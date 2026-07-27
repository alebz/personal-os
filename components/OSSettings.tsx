'use client'

import { useEffect, useRef } from 'react'
import { useOSSettings, CRT_PHOSPHORS } from './OSSettingsContext'
import type { CrtColor } from './OSSettingsContext'

// ── Sub-components ────────────────────────────────────────────────────────────

function Toggle({ value, onChange }: { value: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      onClick={() => onChange(!value)}
      aria-pressed={value}
      style={{
        display: 'inline-flex', alignItems: 'center', width: 36, height: 20, borderRadius: 10,
        background: value ? 'oklch(0.68 0.16 255)' : 'rgba(255,255,255,0.1)',
        border: 'none', cursor: 'pointer', transition: 'background 180ms ease', padding: 2, flexShrink: 0,
      }}
    >
      <span style={{
        width: 16, height: 16, borderRadius: '50%', background: 'white',
        transform: value ? 'translateX(16px)' : 'translateX(0)', transition: 'transform 180ms ease',
        display: 'block', boxShadow: '0 1px 3px rgba(0,0,0,0.3)',
      }} />
    </button>
  )
}

function PillSelector<T extends string>({ options, value, onChange }: {
  options: { value: T; label: string }[]; value: T; onChange: (v: T) => void
}) {
  return (
    <div style={{ display: 'flex', gap: 3, flexWrap: 'wrap' }}>
      {options.map(opt => (
        <button
          key={opt.value}
          onClick={() => onChange(opt.value)}
          style={{
            padding: '3px 9px', borderRadius: 20, fontSize: 10, border: '1px solid',
            borderColor: value === opt.value ? 'oklch(0.68 0.16 255)' : 'rgba(255,255,255,0.1)',
            background: value === opt.value ? 'oklch(0.68 0.16 255 / 0.15)' : 'transparent',
            color: value === opt.value ? 'oklch(0.68 0.16 255)' : 'rgba(255,255,255,0.4)',
            cursor: 'pointer', transition: 'all 140ms ease', letterSpacing: '0.03em',
          }}
        >
          {opt.label}
        </button>
      ))}
    </div>
  )
}

function Slider({ label, value, min, max, step, onChange, fmt }: {
  label: string; value: number; min: number; max: number; step: number
  onChange: (v: number) => void; fmt?: (v: number) => string
}) {
  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10, color: 'rgba(255,255,255,0.5)', marginBottom: 4, letterSpacing: '0.04em', textTransform: 'uppercase' }}>
        <span>{label}</span>
        <span style={{ color: 'oklch(0.68 0.16 255)', fontVariantNumeric: 'tabular-nums' }}>{fmt ? fmt(value) : value}</span>
      </div>
      <input
        type="range" min={min} max={max} step={step} value={value}
        onChange={e => onChange(parseFloat(e.target.value))}
        style={{ width: '100%', accentColor: 'oklch(0.68 0.16 255)', cursor: 'pointer' }}
      />
    </div>
  )
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: 18 }}>
      <p style={{ fontSize: 9, fontWeight: 700, letterSpacing: '0.14em', textTransform: 'uppercase', color: 'rgba(255,255,255,0.25)', marginBottom: 10, marginTop: 0 }}>
        {title}
      </p>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 9 }}>{children}</div>
    </div>
  )
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
      <span style={{ fontSize: 12, color: 'rgba(255,255,255,0.65)', flexShrink: 1 }}>{label}</span>
      <div style={{ flexShrink: 0 }}>{children}</div>
    </div>
  )
}

// ── Panel ─────────────────────────────────────────────────────────────────────

export default function OSSettings() {
  const {
    settingsOpen, closeSettings, set, setCrt,
    showStars, showShips, showPlanes, discreto, showLolo, crt, screensaver, startScreensaver,
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
          backgroundColor: 'rgba(12, 12, 17, 0.96)', backdropFilter: 'blur(20px)', WebkitBackdropFilter: 'blur(20px)',
          border: '1px solid rgba(255,255,255,0.07)', borderRadius: 14, padding: '16px 18px',
          zIndex: 10001, boxShadow: '0 24px 64px rgba(0,0,0,0.6)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
          <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.12em', color: 'rgba(255,255,255,0.5)' }}>AJUSTES</span>
          <button onClick={closeSettings} style={{ fontSize: 18, lineHeight: 1, color: 'rgba(255,255,255,0.25)', background: 'none', border: 'none', cursor: 'pointer', padding: '0 2px' }}>×</button>
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
                        height: 20, borderRadius: 5, background: hex, cursor: 'pointer', padding: 0,
                        border: crt.phosphor === hex ? '2px solid white' : '2px solid transparent',
                        boxShadow: crt.phosphor === hex ? '0 0 0 1.5px rgba(0,0,0,0.6)' : 'none',
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
                  width: '100%', marginTop: 2, padding: '7px 0', borderRadius: 8, cursor: 'pointer',
                  border: '1px solid oklch(0.68 0.16 255 / 0.4)', background: 'oklch(0.68 0.16 255 / 0.12)',
                  color: 'oklch(0.68 0.16 255)', fontSize: 11, fontWeight: 600, letterSpacing: '0.06em', textTransform: 'uppercase',
                }}
              >
                ▶ Previsualizar ahora
              </button>
              <p style={{ fontSize: 10, color: 'rgba(255,255,255,0.2)', fontStyle: 'italic', margin: 0 }}>Tras 3 min sin actividad se activa solo. Mueve el mouse para salir.</p>
            </>
          )}
        </Section>

        <Section title="Widgets">
          <Row label="Lolo"><Toggle value={showLolo} onChange={v => set('showLolo', v)} /></Row>
          <p style={{ fontSize: 10, color: 'rgba(255,255,255,0.2)', fontStyle: 'italic', margin: 0 }}>Más widgets próximamente</p>
        </Section>
      </div>
    </>
  )
}
