// Sonidos del cascarón XP — WAVs reales del pack (public/themes/xp/sounds/). Se leen los settings
// FRESCOS de localStorage al momento de tocar (el contexto ya persiste ahí), así el mute/volumen
// aplican al instante sin enhebrar el contexto por todo el WM. Nunca lanza: sin gesto del usuario el
// navegador bloquea autoplay y lo tragamos en silencio — por eso el startup se dispara SOLO desde el
// click que entra al tema (ceremonia de llegada, no ruido de cada reload).

export type XpSoundName = 'startup' | 'minimize' | 'restore' | 'close' | 'open'

export function playXpSound(name: XpSoundName) {
  try {
    const parsed = JSON.parse(localStorage.getItem('os-settings') ?? '{}')
    const on: boolean   = parsed?.xpSound?.on ?? true
    const volume: number = parsed?.xpSound?.volume ?? 0.25
    if (!on || volume <= 0) return
    const a = new Audio(`/themes/xp/sounds/${name}.wav`)
    a.volume = Math.min(1, Math.max(0, volume))
    void a.play().catch(() => {})   // autoplay bloqueado u otro fallo → silencio, jamás rompe UI
  } catch { /* sin localStorage/Audio (SSR, permisos) → silencio */ }
}
