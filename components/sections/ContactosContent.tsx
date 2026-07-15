'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { createPortal } from 'react-dom'

// ── Types ─────────────────────────────────────────────────────────────────────

interface Contact {
  id: string
  name: string
  category: string
  birthday: string | null
  notes: string | null
  company: string | null
  last_contacted: string | null
  created_at: string
}

interface ContactForm {
  name: string
  category: string
  company: string
  birthday: string
  last_contacted: string
  notes: string
}

interface ContactCategory {
  id: string
  name: string
}

type Drawer = { mode: 'create' } | { mode: 'edit'; contact: Contact }
type Sort   = 'alpha' | 'bday' | 'tipo'

// ── Styling maps ──────────────────────────────────────────────────────────────

const CAT_CLS: Record<string, string> = {
  'Familia':           'text-accent border-accent/25 bg-accent/10',
  'Círculo cercano':   'text-ok border-ok/25 bg-ok/10',
  'Círculo extendido': 'text-fg-muted border-border bg-surface-1',
  'Proveedores':       'text-warn border-warn/25 bg-warn/10',
  'Clientes':          'text-ok border-ok/15 bg-ok/5',
}
const CAT_CLS_DEFAULT = 'text-fg-muted border-border bg-surface-1'

const SORT_LABELS: Record<Sort, string> = {
  alpha: 'A–Z',
  bday:  'Cumpleaños',
  tipo:  'Tipo',
}

const CAT_EMOJI: Record<string, string> = {
  'Familia':           '👨‍👩‍👧',
  'Círculo cercano':   '🤝',
  'Círculo extendido': '🌐',
  'Proveedores':       '🔧',
  'Clientes':          '💼',
}

function catCls(cat: string)   { return CAT_CLS[cat]   ?? CAT_CLS_DEFAULT }
function catEmoji(cat: string) { return CAT_EMOJI[cat] ?? '🏷️' }

// ── Helpers ───────────────────────────────────────────────────────────────────

function initials(name: string): string {
  return name.split(' ').map(w => w[0] ?? '').slice(0, 2).join('').toUpperCase()
}

function formatBirthday(date: string): string {
  const [, m, d] = date.split('-').map(Number)
  const months = ['ene','feb','mar','abr','may','jun','jul','ago','sep','oct','nov','dic']
  return `${d} ${months[m - 1]}`
}

function relativeDate(date: string): string {
  const d = new Date(date + 'T12:00:00')
  const now = new Date()
  const days = Math.round((now.getTime() - d.getTime()) / 86400000)
  if (days <= 0) return 'Hoy'
  if (days === 1) return 'Ayer'
  if (days < 7) return `Hace ${days} días`
  if (days < 30) return `Hace ${Math.round(days / 7)} sem.`
  if (days < 365) return `Hace ${Math.round(days / 30)} mes.`
  const y = Math.round(days / 365)
  return `Hace ${y} año${y > 1 ? 's' : ''}`
}

function daysUntilBirthday(birthday: string | null): number {
  if (!birthday) return Infinity
  const today   = new Date()
  const todayMs = new Date(today.getFullYear(), today.getMonth(), today.getDate()).getTime()
  const [, bm, bd] = birthday.split('-').map(Number)
  const thisYear = new Date(today.getFullYear(), bm - 1, bd).getTime()
  const nextOccurrence = thisYear >= todayMs ? thisYear : new Date(today.getFullYear() + 1, bm - 1, bd).getTime()
  return Math.round((nextOccurrence - todayMs) / 86400000)
}

function groupByType(contacts: Contact[], catNames: string[]): { cat: string; items: Contact[] }[] {
  const ordered = [...catNames]
  for (const c of contacts) {
    if (!ordered.includes(c.category)) ordered.push(c.category)
  }
  return ordered
    .map(cat => ({ cat, items: contacts.filter(c => c.category === cat) }))
    .filter(g => g.items.length > 0)
}

function emptyForm(): ContactForm {
  return { name: '', category: 'Círculo extendido', company: '', birthday: '', last_contacted: '', notes: '' }
}

function formFromContact(c: Contact): ContactForm {
  return {
    name:           c.name,
    category:       c.category,
    company:        c.company ?? '',
    birthday:       c.birthday ?? '',
    last_contacted: c.last_contacted ?? '',
    notes:          c.notes ?? '',
  }
}

// ── API helpers ───────────────────────────────────────────────────────────────

async function apiGet(): Promise<Contact[]> {
  const r = await fetch('/api/contacts')
  if (!r.ok) throw new Error(await r.text())
  return r.json()
}

async function apiPost(body: Partial<Omit<Contact, 'id' | 'created_at'>>): Promise<Contact> {
  const r = await fetch('/api/contacts', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  })
  if (!r.ok) throw new Error(await r.text())
  return r.json()
}

async function apiPatch(id: string, body: Partial<Omit<Contact, 'id' | 'created_at'>>): Promise<Contact> {
  const r = await fetch(`/api/contacts/${id}`, {
    method: 'PATCH',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  })
  if (!r.ok) throw new Error(await r.text())
  return r.json()
}

async function apiDelete(id: string): Promise<void> {
  await fetch(`/api/contacts/${id}`, { method: 'DELETE' })
}

async function apiGetCategories(): Promise<ContactCategory[]> {
  const r = await fetch('/api/contact-categories')
  if (!r.ok) throw new Error(await r.text())
  return r.json()
}

async function apiAddCategory(name: string): Promise<ContactCategory> {
  const r = await fetch('/api/contact-categories', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ name }),
  })
  if (!r.ok) throw new Error(await r.text())
  return r.json()
}

async function apiDeleteCategory(id: string): Promise<void> {
  const r = await fetch(`/api/contact-categories/${id}`, { method: 'DELETE' })
  if (!r.ok) throw new Error(await r.text())
}

// ── CategoryManagerModal ──────────────────────────────────────────────────────

function CategoryManagerModal({
  categories,
  onClose,
  onAdd,
  onDelete,
}: {
  categories: ContactCategory[]
  onClose: () => void
  onAdd: (name: string) => Promise<void>
  onDelete: (id: string, name: string) => Promise<void>
}) {
  const [newName, setNewName]       = useState('')
  const [adding, setAdding]         = useState(false)
  const [addError, setAddError]     = useState<string | null>(null)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => { inputRef.current?.focus() }, [])

  async function handleAdd() {
    const name = newName.trim()
    if (!name || adding) return
    setAdding(true); setAddError(null)
    try {
      await onAdd(name)
      setNewName('')
    } catch (e) {
      setAddError(String(e).replace(/^Error:\s*/, ''))
    } finally {
      setAdding(false)
    }
  }

  async function handleDelete(id: string, name: string) {
    if (!confirm(`¿Eliminar la categoría "${name}"?\n\nLos contactos con esta categoría no se eliminarán, pero quedarán sin categoría reconocida.`)) return
    setDeletingId(id)
    try { await onDelete(id, name) } finally { setDeletingId(null) }
  }

  return createPortal(
    <>
      <div
        aria-hidden
        onClick={onClose}
        className="fixed inset-0 z-40 bg-black/60 backdrop-blur-[2px]"
      />
      <div
        role="dialog"
        aria-modal
        aria-label="Gestionar categorías"
        className="fixed left-1/2 top-1/2 z-50 w-full max-w-sm -translate-x-1/2 -translate-y-1/2 rounded-card border border-border bg-surface-base shadow-2xl"
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-border px-5 py-4">
          <span className="text-secondary font-semibold uppercase tracking-wider text-fg-muted">
            Gestionar categorías
          </span>
          <button
            onClick={onClose}
            aria-label="Cerrar"
            className="flex h-6 w-6 items-center justify-center rounded-control text-fg-muted transition-colors hover:bg-surface-hover hover:text-fg"
          >
            <svg className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
            </svg>
          </button>
        </div>

        {/* Category list */}
        <div className="max-h-64 overflow-y-auto p-2">
          {categories.length === 0 && (
            <p className="py-6 text-center text-body italic text-fg-muted/50">Sin categorías aún</p>
          )}
          {categories.map(cat => (
            <div
              key={cat.id}
              className="group flex items-center gap-3 rounded-card px-3 py-2 transition-colors hover:bg-surface-2"
            >
              <span className={`shrink-0 rounded-pill border px-2 py-0.5 text-label font-medium ${catCls(cat.name)}`}>
                {catEmoji(cat.name)} {cat.name}
              </span>
              <span className="flex-1 truncate text-body text-fg">{cat.name}</span>
              <button
                onClick={() => handleDelete(cat.id, cat.name)}
                disabled={deletingId === cat.id}
                className="shrink-0 rounded-control px-2 py-0.5 text-label text-fg-muted/40 opacity-0 transition-all hover:bg-danger/10 hover:text-danger group-hover:opacity-100 disabled:opacity-30"
              >
                {deletingId === cat.id ? '…' : 'Eliminar'}
              </button>
            </div>
          ))}
        </div>

        {/* Add new */}
        <div className="border-t border-border p-3 space-y-2">
          {addError && (
            <p className="text-secondary text-danger">{addError}</p>
          )}
          <div className="flex gap-2">
            <input
              ref={inputRef}
              value={newName}
              onChange={e => { setNewName(e.target.value); setAddError(null) }}
              onKeyDown={e => e.key === 'Enter' && handleAdd()}
              placeholder="Nueva categoría…"
              className="flex-1 rounded-card border border-border bg-surface-1 px-3 py-2 text-body text-fg placeholder:text-fg-faint outline-none transition-colors focus:border-accent/30 focus:ring-1 focus:ring-accent/20"
            />
            <button
              onClick={handleAdd}
              disabled={!newName.trim() || adding}
              className="rounded-card bg-accent/15 px-4 py-2 text-body font-medium text-accent transition-colors hover:bg-accent/25 disabled:cursor-not-allowed disabled:opacity-40"
            >
              {adding ? '…' : '+ Agregar'}
            </button>
          </div>
        </div>
      </div>
    </>,
    document.body
  )
}

// ── ContactRow ────────────────────────────────────────────────────────────────

function ContactRow({ contact, onClick }: { contact: Contact; onClick: () => void }) {
  const ini = initials(contact.name)
  return (
    <button
      onClick={onClick}
      className="group flex w-full items-center gap-4 border-t border-border px-5 py-3.5 text-left transition-colors hover:bg-surface-2 first:border-t-0"
    >
      <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-pill border text-secondary font-bold ${catCls(contact.category)}`}>
        {ini}
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <span className="truncate text-body font-medium text-fg">{contact.name}</span>
          <span className={`shrink-0 rounded-pill border px-1.5 py-0.5 text-label font-medium ${catCls(contact.category)}`}>
            {catEmoji(contact.category)} {contact.category}
          </span>
        </div>
        {contact.company && (
          <p className="truncate text-secondary text-fg-muted">{contact.company}</p>
        )}
      </div>
      <div className="shrink-0 text-right">
        {contact.last_contacted && (
          <p className="text-secondary text-fg-muted">{relativeDate(contact.last_contacted)}</p>
        )}
        {contact.birthday && (
          <p className="text-label text-fg-muted/50">🎂 {formatBirthday(contact.birthday)}</p>
        )}
      </div>
    </button>
  )
}

// ── ContactDrawer ─────────────────────────────────────────────────────────────

function ContactDrawer({
  drawer,
  categoryNames,
  onClose,
  onCreate,
  onUpdate,
  onDelete,
}: {
  drawer: Drawer | null
  categoryNames: string[]
  onClose: () => void
  onCreate: (form: ContactForm) => Promise<void>
  onUpdate: (id: string, form: ContactForm) => Promise<void>
  onDelete: (id: string) => Promise<void>
}) {
  const [form, setForm] = useState<ContactForm>(emptyForm())
  const [saving, setSaving] = useState(false)
  const [deleting, setDeleting] = useState(false)

  const drawerKey =
    !drawer ? 'closed' : drawer.mode === 'edit' ? drawer.contact.id : 'create'

  useEffect(() => {
    if (!drawer) return
    setForm(drawer.mode === 'create' ? emptyForm() : formFromContact(drawer.contact))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [drawerKey])

  function set(key: keyof ContactForm, val: string) {
    setForm(prev => ({ ...prev, [key]: val }))
  }

  async function handleSave() {
    if (!form.name.trim() || saving) return
    setSaving(true)
    try {
      if (drawer?.mode === 'create') await onCreate(form)
      else if (drawer?.mode === 'edit') await onUpdate(drawer.contact.id, form)
      onClose()
    } catch {
      // error surfaced in parent
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete() {
    if (drawer?.mode !== 'edit' || deleting) return
    if (!confirm(`¿Eliminar a ${drawer.contact.name}?`)) return
    setDeleting(true)
    try { await onDelete(drawer.contact.id); onClose() }
    finally { setDeleting(false) }
  }

  const isOpen = !!drawer
  const labelCls = 'mb-1.5 block text-label font-semibold uppercase tracking-wider text-fg-muted'
  const inputCls =
    'w-full rounded-card border border-border bg-surface-1 px-3 py-2.5 text-body text-fg placeholder:text-fg-faint transition-colors focus:border-accent/30 focus:outline-none focus:ring-1 focus:ring-accent/20 backdrop-blur-xl'

  // Always include the contact's current category as an option even if it was deleted from the list
  const selectOptions = categoryNames.includes(form.category)
    ? categoryNames
    : [...categoryNames, form.category]

  return createPortal(
    <>
      <div
        aria-hidden
        onClick={onClose}
        className={`fixed inset-0 z-40 bg-black/50 backdrop-blur-[2px] transition-opacity duration-300 ${
          isOpen ? 'opacity-100' : 'pointer-events-none opacity-0'
        }`}
      />
      <aside
        className={`fixed inset-y-0 right-0 z-50 flex w-full max-w-md flex-col border-l border-border bg-surface-base shadow-2xl transition-transform duration-300 ease-out ${
          isOpen ? 'translate-x-0' : 'translate-x-full'
        }`}
      >
        {drawer && (
          <>
            <div className="flex items-center justify-between border-b border-border px-6 py-4">
              <span className="text-secondary font-medium uppercase tracking-wider text-fg-muted">
                {drawer.mode === 'create' ? 'Nuevo contacto' : 'Editar contacto'}
              </span>
              <button
                onClick={onClose}
                aria-label="Cerrar"
                className="rounded-control p-1 text-fg-muted transition-colors hover:bg-surface-hover hover:text-fg"
              >
                <svg className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
                </svg>
              </button>
            </div>

            <div className="flex-1 space-y-5 overflow-y-auto px-6 py-5">
              <div>
                <label className={labelCls}>Nombre</label>
                <input
                  value={form.name}
                  onChange={e => set('name', e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && handleSave()}
                  className={inputCls}
                  placeholder="Nombre completo"
                  // eslint-disable-next-line jsx-a11y/no-autofocus
                  autoFocus={drawer.mode === 'create'}
                />
              </div>

              <div>
                <label className={labelCls}>Categoría</label>
                <div className="relative">
                  <select
                    value={form.category}
                    onChange={e => set('category', e.target.value)}
                    className={`${inputCls} appearance-none cursor-pointer pr-9`}
                  >
                    {selectOptions.map(name => (
                      <option key={name} value={name}>{catEmoji(name)} {name}</option>
                    ))}
                  </select>
                  <svg
                    className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-fg-muted"
                    viewBox="0 0 20 20" fill="currentColor" aria-hidden
                  >
                    <path fillRule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clipRule="evenodd" />
                  </svg>
                </div>
              </div>

              <div>
                <label className={labelCls}>Empresa / Contexto</label>
                <input
                  value={form.company}
                  onChange={e => set('company', e.target.value)}
                  className={inputCls}
                  placeholder="Donde trabaja, cómo los conociste…"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className={labelCls}>Cumpleaños</label>
                  <input
                    type="date"
                    value={form.birthday}
                    onChange={e => set('birthday', e.target.value)}
                    className={inputCls}
                  />
                </div>
                <div>
                  <label className={labelCls}>Último contacto</label>
                  <input
                    type="date"
                    value={form.last_contacted}
                    onChange={e => set('last_contacted', e.target.value)}
                    className={inputCls}
                  />
                </div>
              </div>

              <div>
                <label className={labelCls}>Notas</label>
                <textarea
                  value={form.notes}
                  onChange={e => set('notes', e.target.value)}
                  rows={5}
                  className={`${inputCls} resize-none`}
                  placeholder="Contexto, intereses, cosas a recordar…"
                />
              </div>
            </div>

            <div className="flex items-center gap-3 border-t border-border px-6 py-4">
              <button
                onClick={handleSave}
                disabled={saving || !form.name.trim()}
                className="flex-1 rounded-card border border-accent/20 bg-accent/10 py-2.5 text-body font-medium text-accent transition-colors hover:bg-accent/20 disabled:cursor-not-allowed disabled:opacity-40"
              >
                {saving ? 'Guardando…' : 'Guardar'}
              </button>
              {drawer.mode === 'edit' && (
                <button
                  onClick={handleDelete}
                  disabled={deleting}
                  className="rounded-card border border-danger/20 px-4 py-2.5 text-body font-medium text-danger transition-colors hover:bg-danger/10 disabled:opacity-40"
                >
                  {deleting ? '…' : 'Eliminar'}
                </button>
              )}
            </div>
          </>
        )}
      </aside>
    </>,
    document.body
  )
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function ContactosContent() {
  const [contacts, setContacts]       = useState<Contact[]>([])
  const [categories, setCategories]   = useState<ContactCategory[]>([])
  const [loading, setLoading]         = useState(true)
  const [error, setError]             = useState<string | null>(null)
  const [search, setSearch]           = useState('')
  const [catFilter, setCatFilter]     = useState<string | null>(null)
  const [drawer, setDrawer]           = useState<Drawer | null>(null)
  const [showCatMgr, setShowCatMgr]  = useState(false)
  const [listOpen, setListOpen]       = useState(false)
  const [filterOpen, setFilterOpen]   = useState(false)
  const filterRef = useRef<HTMLDivElement>(null)
  const [sort, setSort] = useState<Sort>(() => {
    try { return (localStorage.getItem('contacts:sort') as Sort) ?? 'alpha' } catch { return 'alpha' }
  })

  useEffect(() => {
    try { localStorage.setItem('contacts:sort', sort) } catch {}
  }, [sort])

  useEffect(() => {
    if (!filterOpen) return
    function onClick(e: MouseEvent) {
      if (filterRef.current && !filterRef.current.contains(e.target as Node)) setFilterOpen(false)
    }
    document.addEventListener('mousedown', onClick)
    return () => document.removeEventListener('mousedown', onClick)
  }, [filterOpen])

  const load = useCallback(async () => {
    setError(null)
    try {
      const [contactsData, catsData] = await Promise.all([
        apiGet(),
        apiGetCategories(),
      ])
      setContacts(contactsData)
      setCategories(catsData)
    } catch (e) {
      setError(String(e))
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { void load() }, [load])

  const catNames = categories.map(c => c.name)

  const filtered = contacts
    .filter(c => !catFilter || c.category === catFilter)
    .filter(c => {
      if (!search) return true
      const q = search.toLowerCase()
      return c.name.toLowerCase().includes(q) || (c.company ?? '').toLowerCase().includes(q)
    })
    .sort((a, b) => {
      if (sort === 'bday') {
        const diff = daysUntilBirthday(a.birthday) - daysUntilBirthday(b.birthday)
        if (diff !== 0) return diff
      }
      if (sort === 'tipo') {
        const ai = catNames.indexOf(a.category)
        const bi = catNames.indexOf(b.category)
        const diff = (ai === -1 ? catNames.length : ai) - (bi === -1 ? catNames.length : bi)
        if (diff !== 0) return diff
      }
      return a.name.localeCompare(b.name, 'es')
    })

  async function handleCreate(form: ContactForm) {
    const data = await apiPost({
      name:           form.name.trim(),
      category:       form.category,
      company:        form.company.trim() || null,
      birthday:       form.birthday || null,
      last_contacted: form.last_contacted || null,
      notes:          form.notes.trim() || null,
    })
    setContacts(prev => [data, ...prev])
  }

  async function handleUpdate(id: string, form: ContactForm) {
    const data = await apiPatch(id, {
      name:           form.name.trim(),
      category:       form.category,
      company:        form.company.trim() || null,
      birthday:       form.birthday || null,
      last_contacted: form.last_contacted || null,
      notes:          form.notes.trim() || null,
    })
    setContacts(prev => prev.map(c => (c.id === id ? data : c)))
  }

  async function handleDelete(id: string) {
    await apiDelete(id)
    setContacts(prev => prev.filter(c => c.id !== id))
  }

  async function handleAddCategory(name: string) {
    const cat = await apiAddCategory(name)
    setCategories(prev => [...prev, cat])
  }

  async function handleDeleteCategory(id: string) {
    await apiDeleteCategory(id)
    setCategories(prev => prev.filter(c => c.id !== id))
    // Clear filter if the deleted category was active
    setCatFilter(prev => {
      const cat = categories.find(c => c.id === id)
      return cat && prev === cat.name ? null : prev
    })
  }

  return (
    <>
      <main className="mx-auto flex h-full max-w-3xl flex-col px-6 pt-6 pb-4">
        {/* Header */}
        <div className="mb-6 flex shrink-0 items-center justify-between">
          <button onClick={() => setListOpen(o => !o)} className="flex items-center gap-2 text-left">
            <svg viewBox="0 0 12 12" className={`h-3 w-3 shrink-0 text-fg-muted/50 transition-transform ${listOpen ? '' : '-rotate-90'}`} fill="none" stroke="currentColor" strokeWidth={1.8}><path d="M3 5l3 3 3-3" strokeLinecap="round" strokeLinejoin="round" /></svg>
            <div>
              <h1 className="text-heading font-bold tracking-tight text-fg">Contactos</h1>
              {!loading && (
                <p className="text-secondary text-fg-muted">
                  {contacts.length} persona{contacts.length !== 1 ? 's' : ''}
                </p>
              )}
            </div>
          </button>
          <button
            onClick={() => setDrawer({ mode: 'create' })}
            className="rounded-card bg-accent/15 px-4 py-2 text-body font-medium text-accent transition-colors hover:bg-accent/25"
          >
            + Nuevo
          </button>
        </div>

        {/* Search + filters + sort */}
        <div className="mb-4 shrink-0 space-y-3">
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Buscar por nombre o empresa…"
            className="w-full rounded-card border border-border bg-surface-1 px-4 py-2.5 text-body text-fg placeholder:text-fg-faint backdrop-blur-xl outline-none transition-colors focus:border-accent/30 focus:ring-1 focus:ring-accent/20"
          />
          <div className="flex flex-wrap items-center justify-between gap-2">
            {/* Filtros dropdown */}
            <div ref={filterRef} className="relative">
              <button
                onClick={() => setFilterOpen(o => !o)}
                className={`flex items-center gap-1.5 rounded-pill border px-3 py-1 text-secondary transition-colors ${
                  catFilter
                    ? catCls(catFilter)
                    : 'border-border text-fg-muted hover:text-fg'
                }`}
              >
                <svg viewBox="0 0 14 14" className="h-3 w-3" fill="none" stroke="currentColor" strokeWidth={1.5}><path d="M1 3h12M3 7h8M5 11h4" strokeLinecap="round" /></svg>
                {catFilter ? `${catEmoji(catFilter)} ${catFilter}` : 'Filtros'}
                <svg viewBox="0 0 12 12" className={`h-2.5 w-2.5 transition-transform ${filterOpen ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" strokeWidth={1.8}><path d="M3 5l3 3 3-3" strokeLinecap="round" strokeLinejoin="round" /></svg>
              </button>
              {filterOpen && (
                <div className="absolute left-0 top-full z-20 mt-1.5 w-56 rounded-card border border-border bg-surface-base p-1.5 shadow-2xl">
                  <button
                    onClick={() => { setCatFilter(null); setFilterOpen(false) }}
                    className={`flex w-full items-center justify-between rounded-control px-3 py-1.5 text-secondary transition-colors hover:bg-surface-2 ${catFilter === null ? 'text-accent' : 'text-fg'}`}
                  >
                    Todos {catFilter === null && '✓'}
                  </button>
                  {catNames.map(cat => (
                    <button
                      key={cat}
                      onClick={() => { setCatFilter(prev => (prev === cat ? null : cat)); setFilterOpen(false) }}
                      className={`flex w-full items-center justify-between rounded-control px-3 py-1.5 text-secondary transition-colors hover:bg-surface-2 ${catFilter === cat ? 'text-accent' : 'text-fg'}`}
                    >
                      <span>{catEmoji(cat)} {cat}</span>
                      {catFilter === cat && <span>✓</span>}
                    </button>
                  ))}
                  <button
                    onClick={() => { setShowCatMgr(true); setFilterOpen(false) }}
                    className="mt-1 flex w-full items-center gap-1.5 rounded-control border-t border-border px-3 pt-2 pb-1 text-secondary text-fg-muted transition-colors hover:text-fg"
                  >
                    ⚙ Gestionar categorías
                  </button>
                </div>
              )}
            </div>

            {/* Sort control */}
            <div className="flex shrink-0 items-center gap-1">
              {(Object.keys(SORT_LABELS) as Sort[]).map(s => (
                <button
                  key={s}
                  onClick={() => setSort(s)}
                  className={`rounded-pill border px-2.5 py-0.5 text-label font-medium transition-colors ${
                    sort === s
                      ? 'border-accent/30 bg-accent/10 text-accent'
                      : 'border-border text-fg-muted hover:text-fg'
                  }`}
                >
                  {SORT_LABELS[s]}
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="flex-1 min-h-0">
        {/* Contact list */}
        {loading ? (
          <div className="flex justify-center py-20">
            <p className="animate-pulse text-body text-fg-muted">Cargando…</p>
          </div>
        ) : error ? (
          <div className="rounded-card border border-danger/30 bg-danger/10 px-4 py-3 text-body text-danger">
            {error}{' '}
            <button onClick={load} className="underline">Reintentar</button>
          </div>
        ) : filtered.length === 0 ? (
          <div className="py-20 text-center">
            <p className="text-body italic text-fg-muted/60">
              {search || catFilter ? 'Sin resultados.' : '¡Agrega tu primer contacto!'}
            </p>
          </div>
        ) : listOpen ? (
          <div className="max-h-[55vh] overflow-y-auto rounded-card border border-border bg-surface-1 shadow-xl shadow-black/20 backdrop-blur-xl dashboard-card">
            {sort === 'tipo'
              ? groupByType(filtered, catNames).map(({ cat, items }) => (
                  <div key={cat}>
                    <div className="border-t border-border bg-surface-base/50 px-5 py-2 first:border-t-0">
                      <span className="text-label font-semibold uppercase tracking-widest text-fg-muted">
                        {catEmoji(cat)} {cat}
                      </span>
                    </div>
                    {items.map(c => (
                      <ContactRow key={c.id} contact={c} onClick={() => setDrawer({ mode: 'edit', contact: c })} />
                    ))}
                  </div>
                ))
              : filtered.map(c => (
                  <ContactRow key={c.id} contact={c} onClick={() => setDrawer({ mode: 'edit', contact: c })} />
                ))
            }
          </div>
        ) : null}
        </div>
      </main>

      <ContactDrawer
        drawer={drawer}
        categoryNames={catNames}
        onClose={() => setDrawer(null)}
        onCreate={handleCreate}
        onUpdate={handleUpdate}
        onDelete={handleDelete}
      />

      {showCatMgr && (
        <CategoryManagerModal
          categories={categories}
          onClose={() => setShowCatMgr(false)}
          onAdd={handleAddCategory}
          onDelete={handleDeleteCategory}
        />
      )}
    </>
  )
}
