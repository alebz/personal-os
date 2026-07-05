'use client'

import { useEffect, useRef } from 'react'
import { useOSSettings } from './OSSettingsContext'
import type { Fleet, Font } from './OSSettingsContext'

// ── Sub-components ────────────────────────────────────────────────────────────

function Toggle({ value, onChange }: { value: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      onClick={() => onChange(!value)}
      aria-pressed={value}
      style={{
        display:         'inline-flex',
        alignItems:      'center',
        width:           36,
        height:          20,
        borderRadius:    10,
        background:      value ? 'oklch(0.68 0.16 255)' : 'rgba(255,255,255,0.1)',
        border:          'none',
        cursor:          'pointer',
        transition:      'background 180ms ease',
        padding:         2,
        flexShrink:      0,
      }}
    >
      <span style={{
        width:      16,
        height:     16,
        borderRadius: '50%',
        background: 'white',
        transform:  value ? 'translateX(16px)' : 'translateX(0)',
        transition: 'transform 180ms ease',
        display:    'block',
        boxShadow:  '0 1px 3px rgba(0,0,0,0.3)',
      }} />
    </button>
  )
}

function PillSelector<T extends string>({
  options,
  value,
  onChange,
}: {
  options: { value: T; label: string }[]
  value: T
  onChange: (v: T) => void
}) {
  return (
    <div style={{ display: 'flex', gap: 3, flexWrap: 'wrap' }}>
      {options.map(opt => (
        <button
          key={opt.value}
          onClick={() => onChange(opt.value)}
          style={{
            padding:          '3px 9px',
            borderRadius:     20,
            fontSize:         10,
            border:           '1px solid',
            borderColor:      value === opt.value ? 'oklch(0.68 0.16 255)' : 'rgba(255,255,255,0.1)',
            background:       value === opt.value ? 'oklch(0.68 0.16 255 / 0.15)' : 'transparent',
            color:            value === opt.value ? 'oklch(0.68 0.16 255)' : 'rgba(255,255,255,0.4)',
            cursor:           'pointer',
            transition:       'all 140ms ease',
            letterSpacing:    '0.03em',
          }}
        >
          {opt.label}
        </button>
      ))}
    </div>
  )
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: 18 }}>
      <p style={{
        fontSize:      9,
        fontWeight:    700,
        letterSpacing: '0.14em',
        textTransform: 'uppercase',
        color:         'rgba(255,255,255,0.25)',
        marginBottom:  10,
        marginTop:     0,
      }}>
        {title}
      </p>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 9 }}>
        {children}
      </div>
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
    settingsOpen, closeSettings, set,
    font,
    showStars, showComets, showPlanets,
    showShips, shipFleet, showChases,
    showPlanes,
    discreto,
    showLolo,
  } = useOSSettings()

  const panelRef = useRef<HTMLDivElement>(null)

  // Close on outside click (backdrop handles it; this is the mousedown fallback)
  useEffect(() => {
    if (!settingsOpen) return
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') closeSettings()
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [settingsOpen, closeSettings])

  if (!settingsOpen) return null

  return (
    <>
      {/* Backdrop — closes panel when clicking away */}
      <div
        aria-hidden="true"
        onClick={closeSettings}
        style={{
          position:   'fixed',
          inset:      0,
          zIndex:     10000,
          background: 'transparent',
        }}
      />

      {/* Panel */}
      <div
        ref={panelRef}
        role="dialog"
        aria-label="Ajustes del sistema"
        style={{
          position:           'fixed',
          top:                'calc(4rem + 12px)',
          right:              24,
          width:              300,
          maxHeight:          'calc(100vh - 5rem - 24px)',
          overflowY:          'auto',
          backgroundColor:    'rgba(12, 12, 17, 0.96)',
          backdropFilter:     'blur(20px)',
          WebkitBackdropFilter: 'blur(20px)',
          border:             '1px solid rgba(255,255,255,0.07)',
          borderRadius:       14,
          padding:            '16px 18px',
          zIndex:             10001,
          boxShadow:          '0 24px 64px rgba(0,0,0,0.6)',
        }}
      >
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
          <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.12em', color: 'rgba(255,255,255,0.5)' }}>
            AJUSTES
          </span>
          <button
            onClick={closeSettings}
            style={{
              fontSize:   18,
              lineHeight: 1,
              color:      'rgba(255,255,255,0.25)',
              background: 'none',
              border:     'none',
              cursor:     'pointer',
              padding:    '0 2px',
            }}
          >
            ×
          </button>
        </div>

        <Section title="Apariencia">
          <Row label="Fuente">
            <PillSelector<Font>
              options={[
                { value: 'system', label: 'System' },
                { value: 'mono',   label: 'Mono'   },
              ]}
              value={font}
              onChange={v => set('font', v)}
            />
          </Row>
        </Section>

        <Section title="Fondo — Cuerpos celestes">
          <Row label="Estrellas"><Toggle value={showStars}   onChange={v => set('showStars', v)} /></Row>
          <Row label="Cometas">  <Toggle value={showComets}  onChange={v => set('showComets', v)} /></Row>
          <Row label="Planetas"> <Toggle value={showPlanets} onChange={v => set('showPlanets', v)} /></Row>
        </Section>

        <Section title="Fondo — Naves">
          <Row label="Naves espaciales"><Toggle value={showShips} onChange={v => set('showShips', v)} /></Row>
          {showShips && (
            <>
              <Row label="Flotas">
                <PillSelector<Fleet>
                  options={[
                    { value: 'all',      label: 'Todas'     },
                    { value: 'mainship', label: 'Main'      },
                    { value: 'nairan',   label: 'Nairan'    },
                    { value: 'klaed',    label: "Kla'ed"    },
                    { value: 'nautolan', label: 'Nautolan'  },
                  ]}
                  value={shipFleet}
                  onChange={v => set('shipFleet', v)}
                />
              </Row>
              <Row label="Persecuciones"><Toggle value={showChases} onChange={v => set('showChases', v)} /></Row>
            </>
          )}
        </Section>

        <Section title="Fondo — Otros">
          <Row label="Aviones"><Toggle value={showPlanes} onChange={v => set('showPlanes', v)} /></Row>
        </Section>

        <Section title="Privacidad">
          <Row label="Modo discreto"><Toggle value={discreto} onChange={v => set('discreto', v)} /></Row>
        </Section>

        <Section title="Widgets">
          <Row label="Lolo"><Toggle value={showLolo} onChange={v => set('showLolo', v)} /></Row>
          <p style={{ fontSize: 10, color: 'rgba(255,255,255,0.2)', fontStyle: 'italic', margin: 0 }}>
            Más widgets próximamente
          </p>
        </Section>
      </div>
    </>
  )
}
