'use client'

import { createContext, useContext, type ReactNode } from 'react'

// Contexto del gestor de ventanas XP: deja que una SECCIÓN abra/cierre ventanas del WM (p.ej. MSN-Cerebro
// abre una ventana de chat por buddy, canon MSN 6). Reutilizable por futuras apps de "alma de época"
// (navegador IE6, etc.). Lo provee <XPDesktop>; null fuera de XP (las secciones bajo XP siempre lo tienen).

export interface XpWinOpts { w?: number; h?: number; resizable?: boolean; icon?: string }

export interface XpWM {
  openWindow: (id: string, title: string, content: ReactNode, opts?: XpWinOpts) => void
  closeWindow: (id: string) => void
}

export const XpWMContext = createContext<XpWM | null>(null)

export function useXpWM(): XpWM | null {
  return useContext(XpWMContext)
}
