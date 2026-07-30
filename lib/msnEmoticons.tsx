'use client'

import type { ReactNode } from 'react'

// Emoticons clásicos de MSN Messenger (set curado en public/themes/xp/emoticons). Atajo de texto →
// imagen, como el original: escribes ":)" y se pinta la carita. Picker + auto-render en los mensajes.

const P = '/themes/xp/emoticons'

export interface Emo { shortcuts: string[]; file: string; name: string }

export const EMOTICONS: Emo[] = [
  { shortcuts: [':)', ':-)'],  file: 'smile.png',                 name: 'Sonrisa' },
  { shortcuts: [':D', ':-D'],  file: 'open-mouthed-smile.png',    name: 'Risa' },
  { shortcuts: [';)', ';-)'],  file: 'winking-smile.gif',         name: 'Guiño' },
  { shortcuts: [':P', ':-P', ':p'], file: 'smile-with-tongue-out.png', name: 'Lengua' },
  { shortcuts: [':(', ':-('],  file: 'sad-smile.png',             name: 'Triste' },
  { shortcuts: [":'("],        file: 'crying-face.gif',           name: 'Llanto' },
  { shortcuts: [':O', ':-O', ':o'], file: 'surprised-smile.png',  name: 'Sorpresa' },
  { shortcuts: [':@'],         file: 'angry-smile.png',           name: 'Enojo' },
  { shortcuts: [':S', ':s'],   file: 'confused-smile.png',        name: 'Confusión' },
  { shortcuts: [':$'],         file: 'embarrassed-smile.png',     name: 'Pena' },
  { shortcuts: [':|', ':-|'],  file: 'disappointed-smile.png',    name: 'Neutral' },
  { shortcuts: ['(H)', '(h)'], file: 'hot-smile.png',             name: 'Cool' },
  { shortcuts: ['8-)'],        file: 'nerd-smile.png',            name: 'Nerd' },
  { shortcuts: ['|-)'],        file: 'sleepy-smile.png',          name: 'Sueño' },
  { shortcuts: ['<:o)'],       file: 'party-smile.gif',           name: 'Fiesta' },
  { shortcuts: ['*-)'],        file: 'thinking-smile.gif',        name: 'Pensando' },
  { shortcuts: ['(6)'],        file: 'devil.png',                 name: 'Diablo' },
  { shortcuts: ['(A)', '(a)'], file: 'angel.png',                 name: 'Ángel' },
  { shortcuts: ['(L)', '(l)'], file: 'red-heart.png',             name: 'Corazón' },
  { shortcuts: ['(U)', '(u)'], file: 'broken-heart.png',          name: 'Corazón roto' },
  { shortcuts: ['(K)', '(k)'], file: 'red-lips.png',              name: 'Beso' },
  { shortcuts: ['(F)', '(f)'], file: 'red-rose.png',              name: 'Rosa' },
  { shortcuts: ['(^)'],        file: 'birthday-cake.png',         name: 'Pastel' },
  { shortcuts: ['(C)', '(c)'], file: 'coffee-cup.png',            name: 'Café' },
  { shortcuts: ['(B)', '(b)'], file: 'beer-mug.png',              name: 'Cerveza' },
  { shortcuts: ['(@)'],        file: 'cat-face.png',              name: 'Gato' },
  { shortcuts: ['(&)'],        file: 'dog-face.png',              name: 'Perro' },
  { shortcuts: ['(*)'],        file: 'star.png',                  name: 'Estrella' },
  { shortcuts: ['(Y)', '(y)'], file: 'thumbs-up.png',             name: 'Pulgar arriba' },
  { shortcuts: ['(N)', '(n)'], file: 'thumbs-down.png',           name: 'Pulgar abajo' },
]

export const emoSrc = (e: Emo) => `${P}/${e.file}`

// Todos los atajos (los más largos primero → match goloso correcto, p.ej. :'( antes que :( ).
const ALL = EMOTICONS.flatMap((e) => e.shortcuts.map((s) => ({ s, e }))).sort((a, b) => b.s.length - a.s.length)

// Convierte un texto en nodos React, reemplazando cada atajo por su imagen.
export function renderEmoticons(text: string, size = 18): ReactNode[] {
  const out: ReactNode[] = []
  let buf = ''
  let i = 0
  let k = 0
  outer: while (i < text.length) {
    for (const { s, e } of ALL) {
      if (text.startsWith(s, i)) {
        if (buf) { out.push(buf); buf = '' }
        out.push(
          <img key={`e${k++}`} src={emoSrc(e)} alt={s} title={e.name} width={size} height={size}
            style={{ display: 'inline-block', verticalAlign: '-4px', margin: '0 1px' }} />
        )
        i += s.length
        continue outer
      }
    }
    buf += text[i++]
  }
  if (buf) out.push(buf)
  return out
}
