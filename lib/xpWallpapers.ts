// Manifiesto de wallpapers del escritorio XP. bliss_4k = default (el Bliss real en 4K); el resto son
// los del pack pixel-art (@NullTale, 800×600, optimizados a JPG). El picker vive en Propiedades de
// Pantalla → pestaña Escritorio; la key elegida se persiste en OSSettings.xpWallpaper.

export interface XpWallpaper {
  key: string
  label: string
  src: string
}

const P = '/themes/xp/wallpapers'

export const XP_WALLPAPERS: XpWallpaper[] = [
  { key: 'bliss_4k',                label: 'Bliss',                    src: `${P}/bliss_4k.jpg` },   // default (4K real)
  { key: 'Ascent',                  label: 'Ascent',                   src: `${P}/Ascent.jpg` },
  { key: 'Autumn',                  label: 'Autumn',                   src: `${P}/Autumn.jpg` },
  { key: 'Azul',                    label: 'Azul',                     src: `${P}/Azul.jpg` },
  { key: 'bliss',                   label: 'Bliss (clásico)',          src: `${P}/bliss.jpg` },
  { key: 'bliss_night',             label: 'Bliss (noche)',            src: `${P}/bliss_night.jpg` },
  { key: 'bliss_sunset',            label: 'Bliss (atardecer)',        src: `${P}/bliss_sunset.jpg` },
  { key: 'Crystal',                 label: 'Crystal',                  src: `${P}/Crystal.jpg` },
  { key: 'Follow',                  label: 'Follow',                   src: `${P}/Follow.jpg` },
  { key: 'Friend',                  label: 'Friend',                   src: `${P}/Friend.jpg` },
  { key: 'Home',                    label: 'Home',                     src: `${P}/Home.jpg` },
  { key: 'Moon_flower',             label: 'Moon Flower',              src: `${P}/Moon_flower.jpg` },
  { key: 'Peace',                   label: 'Peace',                    src: `${P}/Peace.jpg` },
  { key: 'Power',                   label: 'Power',                    src: `${P}/Power.jpg` },
  { key: 'Purple_flower',           label: 'Purple Flower',            src: `${P}/Purple_flower.jpg` },
  { key: 'Radiance',                label: 'Radiance',                 src: `${P}/Radiance.jpg` },
  { key: 'Red_moon_desert',         label: 'Red Moon Desert',          src: `${P}/Red_moon_desert.jpg` },
  { key: 'Ripple',                  label: 'Ripple',                   src: `${P}/Ripple.jpg` },
  { key: 'Stonehenge',              label: 'Stonehenge',               src: `${P}/Stonehenge.jpg` },
  { key: 'Tulips',                  label: 'Tulips',                   src: `${P}/Tulips.jpg` },
  { key: 'Vortec_space',            label: 'Vortec Space',             src: `${P}/Vortec_space.jpg` },
  { key: 'Wind',                    label: 'Wind',                     src: `${P}/Wind.jpg` },
  { key: 'Windows_XP_Home_Edition', label: 'Windows XP Home Edition',  src: `${P}/Windows_XP_Home_Edition.jpg` },
  { key: 'Windows_XP_Professional', label: 'Windows XP Professional',  src: `${P}/Windows_XP_Professional.jpg` },
]

export const DEFAULT_WALLPAPER = 'bliss_4k'

export function wallpaperSrc(key: string): string {
  return (XP_WALLPAPERS.find((w) => w.key === key) ?? XP_WALLPAPERS[0]).src
}
