'use client'

import { useSyncExternalStore } from 'react'

// Fotos de perfil de MSN-Cerebro (tuya + de cada contacto). Store reactivo módulo-nivel + persistido en
// localStorage (dataURL downscaleado a 96px → barato). Reactivo entre TODAS las ventanas abiertas (buddy
// list + chats) porque comparten el árbol de React bajo XPDesktop. Sin backend (endurecimiento futuro:
// subir a Supabase Storage). id: 'me' = tú; 'sys:cerebro'/'sys:lolo' = buddies fijos; uuid = contacto.

const KEY = 'xp-msn-avatars'
type Store = Record<string, string>

function load(): Store {
  try { return JSON.parse(localStorage.getItem(KEY) || '{}') as Store } catch { return {} }
}

let store: Store = typeof window !== 'undefined' ? load() : {}
const listeners = new Set<() => void>()

function emit() { listeners.forEach((l) => l()) }

export function setAvatar(id: string, dataUrl: string) {
  store = { ...store, [id]: dataUrl }
  try { localStorage.setItem(KEY, JSON.stringify(store)) } catch { /* cuota llena */ }
  emit()
}

export function clearAvatar(id: string) {
  const next = { ...store }; delete next[id]; store = next
  try { localStorage.setItem(KEY, JSON.stringify(store)) } catch { /* */ }
  emit()
}

function subscribe(l: () => void) { listeners.add(l); return () => { listeners.delete(l) } }

// Hook reactivo: devuelve el dataURL de la foto (o undefined).
export function useAvatar(id: string): string | undefined {
  return useSyncExternalStore(subscribe, () => store[id], () => undefined)
}

// Abre el selector de archivo, downscalea a un cuadro `size` (cover-crop) y guarda la foto de `id`.
// Lectura 100% local (FileReader/canvas) — no sube nada.
export async function changeAvatar(id: string, size = 96): Promise<boolean> {
  const file = await pickImageFile()
  if (!file) return false
  const dataUrl = await fileToSquareDataUrl(file, size)
  setAvatar(id, dataUrl)
  return true
}

function pickImageFile(): Promise<File | null> {
  return new Promise((resolve) => {
    const input = document.createElement('input')
    input.type = 'file'
    input.accept = 'image/*'
    input.onchange = () => resolve(input.files?.[0] ?? null)
    input.click()
  })
}

function fileToSquareDataUrl(file: File, size: number): Promise<string> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file)
    const img = new Image()
    img.onload = () => {
      try {
        const canvas = document.createElement('canvas')
        canvas.width = size; canvas.height = size
        const ctx = canvas.getContext('2d')
        if (!ctx) { reject(new Error('no ctx')); return }
        const scale = Math.max(size / img.width, size / img.height)   // cover
        const w = img.width * scale, h = img.height * scale
        ctx.drawImage(img, (size - w) / 2, (size - h) / 2, w, h)
        resolve(canvas.toDataURL('image/jpeg', 0.82))
      } catch (e) { reject(e) } finally { URL.revokeObjectURL(url) }
    }
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('img load')) }
    img.src = url
  })
}
