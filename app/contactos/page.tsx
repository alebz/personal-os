'use client'

import { useState, useEffect, useCallback } from 'react'
import Shell from '@/components/Shell'

// ── Types ─────────────────────────────────────────────────────────────────────

type Category =
  | 'Familia'
  | 'Círculo cercano'
  | 'Círculo extendido'
  | 'Proveedores'
  | 'Clientes'
  | 'Enemigos'

interface Contact {
  id: string
  name: string
  category: Category
  birthday: string | null
  notes: string | null
  company: string | null
  last_contacted: string | null
  created_at: string
}

interface ContactForm {
  name: string
  category: Category
  company: string
  birthday: string
  last_contacted: string
  notes: string
}

type Drawer = { mode: 'create' } | { mode: 'edit'; contact: Contact }

// ── Constants ─────────────────────────────────────────────────────────────────

const CATEGORIES: Category[] = [
  'Familia',
  'Círculo cercano',
  'Círculo extendido',
  'Proveedores',
  'Clientes',
  'Enemigos',
]

const CAT_CLS: Record<Category, string> = {
  'Familia':           'text-accent border-accent/25 bg-accent/10',
  'Círculo cercano':   'text-ok border-ok/25 bg-ok/10',
  'Círculo extendido': 'text-ink-3 border-ink-4/15 bg-ink-1/30',
  'Proveedores':       'text-warn border-warn/25 bg-warn/10',
  'Clientes':          'text-ok border-ok/15 bg-ok/5',
  'Enemigos':          'text-danger border-danger/25 bg-danger/10',
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function initials(name: string): string {
  return name
    .split(' ')
    .map(w => w[0] ?? '')
    .slice(0, 2)
    .join('')
    .toUpperCase()
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

function emptyForm(): ContactForm {
  return {
    name: '',
    category: 'Círculo extendido',
    company: '',
    birthday: '',
    last_contacted: '',
    notes: '',
  }
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

// ── ContactRow ────────────────────────────────────────────────────────────────

function ContactRow({ contact, onClick }: { contact: Contact; onClick: () => void }) {
  const ini = initials(contact.name)
  return (
    <button
      onClick={onClick}
      className="group flex w-full items-center gap-4 border-t border-ink-4/5 px-5 py-3.5 text-left transition-colors hover:bg-ink-2/10 first:border-t-0"
    >
      {/* Avatar */}
      <div
        className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full border text-xs font-bold ${CAT_CLS[contact.category]}`}
      >
        {ini}
      </div>

      {/* Main info */}
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <span className="truncate text-sm font-medium text-ink-4">{contact.name}</span>
          <span className={`shrink-0 rounded-full border px-1.5 py-0.5 text-[10px] font-medium ${CAT_CLS[contact.category]}`}>
            {contact.category}
          </span>
        </div>
        {contact.company && (
          <p className="truncate text-xs text-ink-3">{contact.company}</p>
        )}
      </div>

      {/* Meta */}
      <div className="shrink-0 text-right">
        {contact.last_contacted && (
          <p className="text-xs text-ink-3">{relativeDate(contact.last_contacted)}</p>
        )}
        {contact.birthday && (
          <p className="text-[10px] text-ink-3/50">🎂 {formatBirthday(contact.birthday)}</p>
        )}
      </div>
    </button>
  )
}

// ── ContactDrawer ─────────────────────────────────────────────────────────────

function ContactDrawer({
  drawer,
  onClose,
  onCreate,
  onUpdate,
  onDelete,
}: {
  drawer: Drawer | null
  onClose: () => void
  onCreate: (form: ContactForm) => Promise<void>
  onUpdate: (id: string, form: ContactForm) => Promise<void>
  onDelete: (id: string) => Promise<void>
}) {
  const [form, setForm] = useState<ContactForm>(emptyForm())
  const [saving, setSaving] = useState(false)
  const [deleting, setDeleting] = useState(false)

  const drawerKey =
    !drawer
      ? 'closed'
      : drawer.mode === 'edit'
      ? drawer.contact.id
      : 'create'

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
      // error is surfaced in the parent
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete() {
    if (drawer?.mode !== 'edit' || deleting) return
    if (!confirm(`¿Eliminar a ${drawer.contact.name}?`)) return
    setDeleting(true)
    try {
      await onDelete(drawer.contact.id)
      onClose()
    } finally {
      setDeleting(false)
    }
  }

  const isOpen = !!drawer

  const labelCls = 'mb-1.5 block text-[10px] font-semibold uppercase tracking-wider text-ink-3'
  const inputCls =
    'w-full rounded-xl border border-ink-4/10 bg-ink-1/40 px-3 py-2.5 text-sm text-ink-4 placeholder:text-ink-2 transition-colors focus:border-accent/30 focus:outline-none focus:ring-1 focus:ring-accent/20 backdrop-blur-xl'

  return (
    <>
      {/* Backdrop */}
      <div
        aria-hidden
        onClick={onClose}
        className={`fixed inset-0 z-40 bg-black/50 backdrop-blur-[2px] transition-opacity duration-300 ${
          isOpen ? 'opacity-100' : 'pointer-events-none opacity-0'
        }`}
      />

      {/* Drawer */}
      <aside
        className={`fixed inset-y-0 right-0 z-50 flex w-full max-w-md flex-col border-l border-ink-4/10 bg-ink-0 shadow-2xl transition-transform duration-300 ease-out ${
          isOpen ? 'translate-x-0' : 'translate-x-full'
        }`}
      >
        {drawer && (
          <>
            {/* Header */}
            <div className="flex items-center justify-between border-b border-ink-4/10 px-6 py-4">
              <span className="text-xs font-medium uppercase tracking-wider text-ink-3">
                {drawer.mode === 'create' ? 'Nuevo contacto' : 'Editar contacto'}
              </span>
              <button
                onClick={onClose}
                aria-label="Cerrar"
                className="rounded-lg p-1 text-ink-3 transition-colors hover:bg-ink-4/10 hover:text-ink-4"
              >
                <svg className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                  <path
                    fillRule="evenodd"
                    d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z"
                    clipRule="evenodd"
                  />
                </svg>
              </button>
            </div>

            {/* Fields */}
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
                <select
                  value={form.category}
                  onChange={e => set('category', e.target.value)}
                  className={`${inputCls} appearance-none`}
                >
                  {CATEGORIES.map(c => (
                    <option key={c} value={c}>{c}</option>
                  ))}
                </select>
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

            {/* Actions */}
            <div className="flex items-center gap-3 border-t border-ink-4/10 px-6 py-4">
              <button
                onClick={handleSave}
                disabled={saving || !form.name.trim()}
                className="flex-1 rounded-xl border border-accent/20 bg-accent/10 py-2.5 text-sm font-medium text-accent transition-colors hover:bg-accent/20 disabled:cursor-not-allowed disabled:opacity-40"
              >
                {saving ? 'Guardando…' : 'Guardar'}
              </button>
              {drawer.mode === 'edit' && (
                <button
                  onClick={handleDelete}
                  disabled={deleting}
                  className="rounded-xl border border-danger/20 px-4 py-2.5 text-sm font-medium text-danger transition-colors hover:bg-danger/10 disabled:opacity-40"
                >
                  {deleting ? '…' : 'Eliminar'}
                </button>
              )}
            </div>
          </>
        )}
      </aside>
    </>
  )
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function ContactosPage() {
  const [contacts, setContacts] = useState<Contact[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  const [catFilter, setCatFilter] = useState<Category | null>(null)
  const [drawer, setDrawer] = useState<Drawer | null>(null)

  const load = useCallback(async () => {
    setError(null)
    try {
      const data = await apiGet()
      setContacts(data)
    } catch (e) {
      setError(String(e))
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { void load() }, [load])

  const filtered = contacts
    .filter(c => !catFilter || c.category === catFilter)
    .filter(c => {
      if (!search) return true
      const q = search.toLowerCase()
      return (
        c.name.toLowerCase().includes(q) ||
        (c.company ?? '').toLowerCase().includes(q)
      )
    })
    .sort((a, b) => a.name.localeCompare(b.name, 'es'))

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

  return (
    <Shell glow="contactos">
      <main className="mx-auto max-w-3xl px-6 py-6">
        {/* Header */}
        <div className="mb-6 flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-ink-4">Contactos</h1>
            {!loading && (
              <p className="text-xs text-ink-3">
                {contacts.length} persona{contacts.length !== 1 ? 's' : ''}
              </p>
            )}
          </div>
          <button
            onClick={() => setDrawer({ mode: 'create' })}
            className="rounded-xl bg-accent/15 px-4 py-2 text-sm font-medium text-accent transition-colors hover:bg-accent/25"
          >
            + Nuevo
          </button>
        </div>

        {/* Search + category filter */}
        <div className="mb-4 space-y-3">
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Buscar por nombre o empresa…"
            className="w-full rounded-xl border border-ink-4/10 bg-ink-1/40 px-4 py-2.5 text-sm text-ink-4 placeholder:text-ink-2 backdrop-blur-xl outline-none transition-colors focus:border-accent/30 focus:ring-1 focus:ring-accent/20"
          />
          <div className="flex flex-wrap gap-1.5">
            <button
              onClick={() => setCatFilter(null)}
              className={`rounded-full border px-3 py-1 text-xs transition-colors ${
                catFilter === null
                  ? 'border-accent/30 bg-accent/10 text-accent'
                  : 'border-ink-4/10 text-ink-3 hover:text-ink-4'
              }`}
            >
              Todos
            </button>
            {CATEGORIES.map(cat => (
              <button
                key={cat}
                onClick={() => setCatFilter(prev => (prev === cat ? null : cat))}
                className={`rounded-full border px-3 py-1 text-xs transition-colors ${
                  catFilter === cat
                    ? CAT_CLS[cat]
                    : 'border-ink-4/10 text-ink-3 hover:text-ink-4'
                }`}
              >
                {cat}
              </button>
            ))}
          </div>
        </div>

        {/* Contact list */}
        {loading ? (
          <div className="flex justify-center py-20">
            <p className="animate-pulse text-sm text-ink-3">Cargando…</p>
          </div>
        ) : error ? (
          <div className="rounded-xl border border-danger/30 bg-danger/10 px-4 py-3 text-sm text-danger">
            {error}{' '}
            <button onClick={load} className="underline">
              Reintentar
            </button>
          </div>
        ) : filtered.length === 0 ? (
          <div className="py-20 text-center">
            <p className="text-sm italic text-ink-3/60">
              {search || catFilter
                ? 'Sin resultados.'
                : '¡Agrega tu primer contacto!'}
            </p>
          </div>
        ) : (
          <div className="overflow-hidden rounded-2xl border border-ink-4/10 bg-ink-1/40 shadow-xl shadow-black/20 backdrop-blur-xl">
            {filtered.map(c => (
              <ContactRow
                key={c.id}
                contact={c}
                onClick={() => setDrawer({ mode: 'edit', contact: c })}
              />
            ))}
          </div>
        )}
      </main>

      <ContactDrawer
        drawer={drawer}
        onClose={() => setDrawer(null)}
        onCreate={handleCreate}
        onUpdate={handleUpdate}
        onDelete={handleDelete}
      />
    </Shell>
  )
}
