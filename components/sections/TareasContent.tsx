'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { createPortal } from 'react-dom'
import { dayColor } from '@/lib/weekdayColors'

// ── Types ──────────────────────────────────────────────────────────────────

type Urgency = 'today' | 'this_week' | 'this_month' | 'someday'
type View = 'kanban' | 'lista'

interface Entity {
  id: string
  name: string
  type: string
}

interface Task {
  id: string
  title: string
  description: string | null
  urgency: Urgency | null
  key: string | null
  priority_score: number | null
  tags: string[]
  entity_id: string | null
  entity_name: string | null
  completed_at: string | null
  created_at: string
  due_date: string | null
  metadata: Record<string, unknown> | null
}

// ── Constants ──────────────────────────────────────────────────────────────

// Urgency tiers are neutral now — they carry NO colour (colour only ever means a weekday, below).
const TIERS: { id: Urgency; label: string }[] = [
  { id: 'today',      label: 'Hoy' },
  { id: 'this_week',  label: 'Esta Semana' },
  { id: 'this_month', label: 'Este Mes' },
  { id: 'someday',    label: 'Algún Día' },
]

const COLUMN_TOP_N = 8   // top-N per column/section, then "ver más" (golden rule: never an internal scroll)

// ── API helpers ────────────────────────────────────────────────────────────

async function apiFetch<T>(url: string, opts?: RequestInit): Promise<T> {
  const res = await fetch(url, opts)
  if (!res.ok) {
    const msg = await res.text().catch(() => 'Unknown error')
    throw new Error(msg)
  }
  if (res.status === 204) return undefined as T
  return res.json()
}

function apiPost<T>(url: string, body: unknown): Promise<T> {
  return apiFetch<T>(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
}

function apiPatch<T>(url: string, body: unknown): Promise<T> {
  return apiFetch<T>(url, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
}

function apiDelete(url: string): Promise<void> {
  return apiFetch<void>(url, { method: 'DELETE' })
}

// ── TaskCard ───────────────────────────────────────────────────────────────

// Oculta la descripción cuando solo repite el título (común en capturas rápidas donde
// el resumen ≈ el texto original). Normaliza mayúsculas + puntuación/espacios finales.
function sameAsTitle(desc: string, title: string): boolean {
  const norm = (s: string) => s.trim().replace(/[.\s]+$/, '').toLowerCase()
  return norm(desc) === norm(title)
}

// ── Weekday colour — the ONLY colour allowed in Tareas ──────────────────────
// Colour never decorates urgency here. It appears solely when a task references a concrete calendar
// day: that day gets a small tag in its weekday colour (lib/weekdayColors, same as CalendarCard). The
// day comes from due_date, or metadata.event_date/date for events captured from the calendar.
const DOW_SHORT = ['dom', 'lun', 'mar', 'mié', 'jue', 'vie', 'sáb']   // indexed by Date.getDay()

function taskDay(task: Task): Date | null {
  const md  = task.metadata ?? {}
  const raw = task.due_date ?? (md.event_date as string | undefined) ?? (md.date as string | undefined)
  if (!raw) return null
  const d = new Date(String(raw).slice(0, 10) + 'T12:00:00')
  return isNaN(d.getTime()) ? null : d
}

function DayTag({ day }: { day: Date }) {
  const c = dayColor(day)
  return (
    <span
      className="inline-flex shrink-0 items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium"
      style={{ color: c, background: c + '18' }}
    >
      <span className="h-1.5 w-1.5 rounded-full" style={{ background: c }} />
      {DOW_SHORT[day.getDay()]} {day.getDate()}
    </span>
  )
}

function TaskCard({
  task,
  onToggle,
  onClick,
}: {
  task: Task
  onToggle: (id: string, done: boolean) => void
  onClick: (task: Task) => void
}) {
  const done     = !!task.completed_at
  const day      = taskDay(task)
  const showDesc = task.description && !done && !sameAsTitle(task.description, task.title)
  const hasMeta  = !!day || !!task.entity_name || (task.tags?.length ?? 0) > 0

  return (
    <div
      role="button"
      tabIndex={0}
      draggable
      onDragStart={(e) => { e.dataTransfer.setData('text/plain', task.id); e.dataTransfer.effectAllowed = 'move' }}
      className="group cursor-grab rounded-2xl border border-ink-4/10 bg-ink-1/30 p-4 backdrop-blur-sm transition-colors hover:border-ink-4/20 hover:bg-ink-1/50 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-accent/40 active:cursor-grabbing"
      onClick={() => onClick(task)}
      onKeyDown={(e) => e.key === 'Enter' && onClick(task)}
    >
      <div className="flex items-start gap-3">
        <button
          className="mt-0.5 shrink-0 focus-visible:outline-none"
          onClick={(e) => { e.stopPropagation(); onToggle(task.id, !done) }}
          aria-label={done ? 'Marcar incompleta' : 'Marcar completa'}
        >
          <div className={`flex h-[18px] w-[18px] items-center justify-center rounded-md border transition-colors ${done ? 'border-ok/60 bg-ok/20' : 'border-ink-4/30 hover:border-ink-4/60'}`}>
            {done && (
              <svg className="h-2.5 w-2.5 text-ok" viewBox="0 0 10 10" fill="none">
                <path d="M1.5 5L4 7.5L8.5 2.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            )}
          </div>
        </button>

        <div className="min-w-0 flex-1">
          <p className={`text-sm font-medium leading-snug ${done ? 'text-ink-2 line-through' : 'text-ink-4'}`}>
            {task.title}
          </p>

          {showDesc && <p className="mt-1 line-clamp-2 text-xs leading-relaxed text-ink-3">{task.description}</p>}

          {hasMeta && (
            <div className="mt-2.5 flex flex-wrap items-center gap-x-2 gap-y-1.5">
              {day && <DayTag day={day} />}
              {task.entity_name && <span className="text-[11px] text-ink-3">{task.entity_name}</span>}
              {task.tags?.map((tag) => (
                <span key={tag} className="rounded-full border border-ink-4/10 px-2 py-0.5 text-[10px] text-ink-3">{tag}</span>
              ))}
            </div>
          )}
        </div>

        {task.key && (
          <span className="shrink-0 rounded-md border border-ink-4/10 px-1.5 py-0.5 font-mono text-[10px] text-ink-3">{task.key}</span>
        )}
      </div>
    </div>
  )
}

// ── KanbanColumn ───────────────────────────────────────────────────────────

function KanbanColumn({
  tier,
  tasks,
  onToggle,
  onClickTask,
  onMove,
}: {
  tier: (typeof TIERS)[number]
  tasks: Task[]
  onToggle: (id: string, done: boolean) => void
  onClickTask: (task: Task) => void
  onMove: (id: string, urgency: Urgency) => void
}) {
  const [showDone, setShowDone] = useState(false)
  const [showAll,  setShowAll]  = useState(false)
  const [dragOver, setDragOver] = useState(false)
  const open = tasks.filter((t) => !t.completed_at)
  const done = tasks.filter((t) => t.completed_at)
  const visible = showAll ? open : open.slice(0, COLUMN_TOP_N)

  return (
    <div
      className={`flex flex-col gap-2.5 rounded-3xl border p-5 shadow-xl shadow-black/20 backdrop-blur-xl dashboard-card transition-colors ${dragOver ? 'border-accent/50 bg-accent/[0.05]' : 'border-ink-4/10 bg-ink-1/40'}`}
      onDragOver={(e) => { e.preventDefault(); e.dataTransfer.dropEffect = 'move'; if (!dragOver) setDragOver(true) }}
      onDragLeave={(e) => { if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setDragOver(false) }}
      onDrop={(e) => { e.preventDefault(); setDragOver(false); const id = e.dataTransfer.getData('text/plain'); if (id) onMove(id, tier.id) }}
    >
      <div className="mb-1 flex items-baseline justify-between">
        <span className="text-xs font-semibold uppercase tracking-wider text-ink-3">{tier.label}</span>
        <span className="tabular-nums text-[11px] text-ink-2">{open.length}</span>
      </div>

      <div className="flex flex-col gap-2.5">
        {open.length === 0 && <p className="py-6 text-center text-xs text-ink-2">Sin tareas abiertas</p>}
        {visible.map((task) => (
          <TaskCard key={task.id} task={task} onToggle={onToggle} onClick={onClickTask} />
        ))}
        {open.length > COLUMN_TOP_N && (
          <button onClick={() => setShowAll((s) => !s)} className="rounded-xl border border-ink-4/10 py-2 text-[11px] text-ink-3 transition-colors hover:text-ink-4">
            {showAll ? 'Ver menos' : `Ver ${open.length - COLUMN_TOP_N} más`}
          </button>
        )}
      </div>

      {done.length > 0 && (
        <div className="mt-2">
          <button onClick={() => setShowDone((v) => !v)} className="text-[11px] text-ink-2 transition-colors hover:text-ink-3">
            {showDone ? '▾' : '▸'} {done.length} completadas
          </button>
          {showDone && (
            <div className="mt-2.5 flex flex-col gap-2.5 opacity-50">
              {done.map((task) => (
                <TaskCard key={task.id} task={task} onToggle={onToggle} onClick={onClickTask} />
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

// ── KanbanView ─────────────────────────────────────────────────────────────

function KanbanView({
  tasks,
  onToggle,
  onClickTask,
  onMove,
}: {
  tasks: Task[]
  onToggle: (id: string, done: boolean) => void
  onClickTask: (task: Task) => void
  onMove: (id: string, urgency: Urgency) => void
}) {
  return (
    <div className="grid grid-cols-1 items-start gap-5 sm:grid-cols-2 xl:grid-cols-4">
      {TIERS.map((tier) => (
        <KanbanColumn
          key={tier.id}
          tier={tier}
          tasks={tasks.filter((t) => (t.urgency ?? 'someday') === tier.id)}
          onToggle={onToggle}
          onClickTask={onClickTask}
          onMove={onMove}
        />
      ))}
    </div>
  )
}

// ── ListaView ──────────────────────────────────────────────────────────────

// Compact single-line row for the list view (checkbox + title + entity + day tag).
function TaskRow({
  task,
  onToggle,
  onClick,
}: {
  task: Task
  onToggle: (id: string, done: boolean) => void
  onClick: (task: Task) => void
}) {
  const done = !!task.completed_at
  const day  = taskDay(task)
  return (
    <div
      role="button"
      tabIndex={0}
      draggable
      onDragStart={(e) => { e.dataTransfer.setData('text/plain', task.id); e.dataTransfer.effectAllowed = 'move' }}
      className="group flex cursor-grab items-center gap-3 rounded-xl px-3 py-2.5 transition-colors hover:bg-ink-4/[0.04] focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-accent/30 active:cursor-grabbing"
      onClick={() => onClick(task)}
      onKeyDown={(e) => e.key === 'Enter' && onClick(task)}
    >
      <button
        className="shrink-0 focus-visible:outline-none"
        onClick={(e) => { e.stopPropagation(); onToggle(task.id, !done) }}
        aria-label={done ? 'Marcar incompleta' : 'Marcar completa'}
      >
        <div className={`flex h-[18px] w-[18px] items-center justify-center rounded-md border transition-colors ${done ? 'border-ok/60 bg-ok/20' : 'border-ink-4/30 hover:border-ink-4/60'}`}>
          {done && <svg className="h-2.5 w-2.5 text-ok" viewBox="0 0 10 10" fill="none"><path d="M1.5 5L4 7.5L8.5 2.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" /></svg>}
        </div>
      </button>

      <span className={`min-w-0 flex-1 truncate text-sm ${done ? 'text-ink-2 line-through' : 'text-ink-4'}`}>{task.title}</span>

      {task.entity_name && <span className="shrink-0 text-[11px] text-ink-3">{task.entity_name}</span>}
      {day && <DayTag day={day} />}
    </div>
  )
}

function ListaSection({
  tier,
  tasks,
  onToggle,
  onClickTask,
  onMove,
}: {
  tier: (typeof TIERS)[number]
  tasks: Task[]
  onToggle: (id: string, done: boolean) => void
  onClickTask: (task: Task) => void
  onMove: (id: string, urgency: Urgency) => void
}) {
  const [showDone, setShowDone] = useState(false)
  const [showAll,  setShowAll]  = useState(false)
  const [dragOver, setDragOver] = useState(false)
  const open = tasks.filter((t) => !t.completed_at)
  const done = tasks.filter((t) => t.completed_at)
  const visible = showAll ? open : open.slice(0, COLUMN_TOP_N)

  return (
    <section
      className={`-mx-2 rounded-2xl px-2 py-1 transition-colors ${dragOver ? 'bg-accent/[0.05]' : ''}`}
      onDragOver={(e) => { e.preventDefault(); e.dataTransfer.dropEffect = 'move'; if (!dragOver) setDragOver(true) }}
      onDragLeave={(e) => { if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setDragOver(false) }}
      onDrop={(e) => { e.preventDefault(); setDragOver(false); const id = e.dataTransfer.getData('text/plain'); if (id) onMove(id, tier.id) }}
    >
      <div className="mb-2 flex items-baseline gap-3 border-b border-ink-4/8 pb-2">
        <h3 className="text-xs font-semibold uppercase tracking-wider text-ink-3">{tier.label}</h3>
        <span className="tabular-nums text-[11px] text-ink-2">{open.length}</span>
      </div>

      <div className="flex flex-col">
        {open.length === 0 && done.length === 0 && <p className="px-3 py-2.5 text-xs italic text-ink-2/60">Sin tareas</p>}
        {visible.map((task) => <TaskRow key={task.id} task={task} onToggle={onToggle} onClick={onClickTask} />)}
        {open.length > COLUMN_TOP_N && (
          <button onClick={() => setShowAll((s) => !s)} className="mt-1 self-start px-3 text-[11px] text-ink-3 transition-colors hover:text-ink-4">
            {showAll ? 'Ver menos' : `Ver ${open.length - COLUMN_TOP_N} más`}
          </button>
        )}
      </div>

      {done.length > 0 && (
        <div className="mt-1 px-3">
          <button onClick={() => setShowDone((v) => !v)} className="text-[11px] text-ink-2 transition-colors hover:text-ink-3">
            {showDone ? '▾' : '▸'} {done.length} completadas
          </button>
          {showDone && <div className="mt-1 flex flex-col opacity-50">{done.map((t) => <TaskRow key={t.id} task={t} onToggle={onToggle} onClick={onClickTask} />)}</div>}
        </div>
      )}
    </section>
  )
}

function ListaView({
  tasks,
  onToggle,
  onClickTask,
  onMove,
}: {
  tasks: Task[]
  onToggle: (id: string, done: boolean) => void
  onClickTask: (task: Task) => void
  onMove: (id: string, urgency: Urgency) => void
}) {
  return (
    <div className="mx-auto max-w-3xl rounded-3xl border border-ink-4/10 bg-ink-1/40 p-5 shadow-xl shadow-black/20 backdrop-blur-xl dashboard-card sm:p-8">
      <div className="flex flex-col gap-8">
        {TIERS.map((tier) => (
          <ListaSection
            key={tier.id}
            tier={tier}
            tasks={tasks.filter((t) => (t.urgency ?? 'someday') === tier.id)}
            onToggle={onToggle}
            onClickTask={onClickTask}
            onMove={onMove}
          />
        ))}
      </div>
    </div>
  )
}

// ── EntityManager ──────────────────────────────────────────────────────────

function EntityManager({
  entities,
  activeFilter,
  onFilter,
  onCreate,
  onRename,
  onDelete,
}: {
  entities: Entity[]
  activeFilter: string | null
  onFilter: (name: string | null) => void
  onCreate: (name: string) => Promise<void>
  onRename: (id: string, name: string) => Promise<void>
  onDelete: (id: string) => Promise<void>
}) {
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editingName, setEditingName] = useState('')
  const [adding, setAdding] = useState(false)
  const [newName, setNewName] = useState('')
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null)

  async function handleRename(id: string) {
    const trimmed = editingName.trim()
    if (trimmed) await onRename(id, trimmed)
    setEditingId(null)
  }

  async function handleCreate() {
    const trimmed = newName.trim()
    if (trimmed) await onCreate(trimmed)
    setAdding(false)
    setNewName('')
  }

  async function handleDelete(id: string) {
    if (pendingDeleteId === id) {
      await onDelete(id)
      setPendingDeleteId(null)
    } else {
      setPendingDeleteId(id)
      setTimeout(() => setPendingDeleteId((cur) => (cur === id ? null : cur)), 3000)
    }
  }

  return (
    <div className="flex flex-wrap items-center gap-1.5">
      <span className="shrink-0 text-[10px] font-semibold uppercase tracking-wider text-ink-2">
        Filtrar
      </span>

      <button
        onClick={() => onFilter(null)}
        className={`rounded-full border px-2.5 py-0.5 text-xs transition-colors ${
          activeFilter === null ? 'border-accent/30 bg-accent/10 text-accent' : 'border-ink-4/10 text-ink-3 hover:text-ink-4'
        }`}
      >
        Todas
      </button>

      {entities.map((e) =>
        editingId === e.id ? (
          <input
            key={e.id}
            autoFocus
            value={editingName}
            onChange={(ev) => setEditingName(ev.target.value)}
            onBlur={() => handleRename(e.id)}
            onKeyDown={(ev) => {
              if (ev.key === 'Enter') handleRename(e.id)
              if (ev.key === 'Escape') setEditingId(null)
            }}
            className="rounded-full border border-accent/30 bg-ink-1/85 px-3 py-0.5 text-xs text-ink-4 outline-none focus:ring-1 focus:ring-accent/30"
            style={{ width: Math.max(80, editingName.length * 8 + 28) }}
          />
        ) : (
          <div key={e.id} className={`group flex items-center gap-0.5 rounded-full border py-0.5 pl-2.5 pr-1 ${activeFilter === e.name ? 'border-accent/30 bg-accent/10' : 'border-ink-4/10 bg-ink-1/85'}`}>
            <button onClick={() => onFilter(activeFilter === e.name ? null : e.name)} className={`text-xs transition-colors ${activeFilter === e.name ? 'font-medium text-accent' : 'text-ink-3 hover:text-ink-4'}`}>{e.name}</button>
            <button
              onClick={() => { setEditingId(e.id); setEditingName(e.name) }}
              className="rounded-full p-0.5 text-ink-2 opacity-0 transition-all group-hover:opacity-100 hover:text-ink-4"
              aria-label={`Renombrar ${e.name}`}
            >
              <svg viewBox="0 0 14 14" fill="none" className="h-3 w-3" stroke="currentColor" strokeWidth={1.5}>
                <path d="M9.5 2.5l2 2-7 7H2.5v-2l7-7z" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </button>
            <button
              onClick={() => handleDelete(e.id)}
              className={`rounded-full p-0.5 transition-all ${
                pendingDeleteId === e.id
                  ? 'text-danger opacity-100'
                  : 'text-ink-2 opacity-0 group-hover:opacity-100 hover:text-danger'
              }`}
              aria-label={pendingDeleteId === e.id ? `Confirmar eliminar ${e.name}` : `Eliminar ${e.name}`}
              title={pendingDeleteId === e.id ? 'Clic para confirmar' : undefined}
            >
              <svg viewBox="0 0 14 14" fill="none" className="h-3 w-3" stroke="currentColor" strokeWidth={1.5}>
                <path d="M2 3.5h10M5 3.5V2.5h4v1M5.5 6v4M8.5 6v4M3 3.5l.7 7.5h6.6L11 3.5" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </button>
          </div>
        )
      )}

      {adding ? (
        <input
          autoFocus
          value={newName}
          onChange={(ev) => setNewName(ev.target.value)}
          onBlur={handleCreate}
          onKeyDown={(ev) => {
            if (ev.key === 'Enter') handleCreate()
            if (ev.key === 'Escape') { setAdding(false); setNewName('') }
          }}
          placeholder="Nombre…"
          className="rounded-full border border-dashed border-accent/40 bg-transparent px-3 py-0.5 text-xs text-ink-3 outline-none placeholder:text-ink-2/50 focus:border-accent/60"
        />
      ) : (
        <button
          onClick={() => { setAdding(true); setNewName('') }}
          className="flex items-center gap-1 rounded-full border border-dashed border-ink-4/20 px-2.5 py-0.5 text-[11px] text-ink-2 transition-colors hover:border-ink-4/40 hover:text-ink-3"
        >
          <svg viewBox="0 0 12 12" fill="none" className="h-3 w-3" stroke="currentColor" strokeWidth={1.8}>
            <path d="M6 2v8M2 6h8" strokeLinecap="round" />
          </svg>
          Nueva entidad
        </button>
      )}
    </div>
  )
}

// ── TaskDrawer ─────────────────────────────────────────────────────────────

type DrawerForm = {
  title: string
  description: string
  urgency: Urgency
  key: string
  priority_score: string
  tags: string
  entity_name: string
  due_date: string
}

function toDrawerForm(task: Task): DrawerForm {
  return {
    title: task.title,
    description: task.description ?? '',
    urgency: task.urgency ?? 'someday',
    key: task.key ?? '',
    priority_score: task.priority_score != null ? String(task.priority_score) : '',
    tags: (task.tags ?? []).join(', '),
    entity_name: task.entity_name ?? '',
    due_date: task.due_date ?? '',
  }
}

function fromDrawerForm(form: DrawerForm): Partial<Task> {
  return {
    title: form.title.trim(),
    description: form.description.trim() || null,
    urgency: form.urgency,
    key: typeof form.key === 'string' ? form.key.trim() || null : form.key ?? null,
    priority_score: form.priority_score !== '' ? Number(form.priority_score) : null,
    tags: form.tags.split(',').map((t) => t.trim()).filter(Boolean),
    entity_name: form.entity_name || null,
    due_date: form.due_date || null,
  }
}

const EMPTY_FORM: DrawerForm = {
  title: '',
  description: '',
  urgency: 'someday',
  key: '',
  priority_score: '',
  tags: '',
  entity_name: '',
  due_date: '',
}

function TaskDrawer({
  task,
  creating,
  entities,
  onClose,
  onSave,
  onCreate,
  onDelete,
}: {
  task: Task | null
  creating: boolean
  entities: Entity[]
  onClose: () => void
  onSave: (id: string, data: Partial<Task>) => Promise<void>
  onCreate: (data: Partial<Task>) => Promise<void>
  onDelete: (id: string) => Promise<void>
}) {
  const [form, setForm] = useState<DrawerForm>(EMPTY_FORM)
  const [saving, setSaving] = useState(false)
  const [deleting, setDeleting] = useState(false)

  useEffect(() => {
    if (task) setForm(toDrawerForm(task))
  }, [task?.id]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (creating) setForm(EMPTY_FORM)
  }, [creating])

  function set(key: keyof DrawerForm, value: string) {
    setForm((prev) => ({ ...prev, [key]: value }))
  }

  async function handleSave() {
    if (saving || !form.title.trim()) return
    setSaving(true)
    try {
      if (creating) {
        await onCreate(fromDrawerForm(form))
      } else if (task) {
        await onSave(task.id, fromDrawerForm(form))
      }
      onClose()
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete() {
    if (!task || deleting) return
    setDeleting(true)
    try {
      await onDelete(task.id)
      onClose()
    } finally {
      setDeleting(false)
    }
  }

  const isOpen = !!task || creating
  const labelCls = 'mb-1.5 block text-[10px] font-semibold uppercase tracking-wider text-ink-3'
  const inputCls = 'w-full rounded-xl border border-ink-4/10 bg-ink-1/85 px-3 py-2.5 text-sm text-ink-4 placeholder:text-ink-2 transition-colors focus:border-accent/30 focus:outline-none focus:ring-1 focus:ring-accent/20'

  return createPortal(
    <>
      <div
        aria-hidden
        className={`fixed inset-0 z-40 bg-black/50 backdrop-blur-[2px] transition-opacity duration-300 ${
          isOpen ? 'opacity-100' : 'pointer-events-none opacity-0'
        }`}
        onClick={onClose}
      />

      <aside
        aria-label={creating ? 'Nueva tarea' : 'Edit task'}
        className={`fixed inset-y-0 right-0 z-50 flex w-full max-w-md flex-col border-l border-ink-4/10 bg-ink-0 shadow-2xl transition-transform duration-300 ease-out ${
          isOpen ? 'translate-x-0' : 'translate-x-full'
        }`}
      >
        {isOpen && (
          <>
            <div className="flex items-center justify-between border-b border-ink-4/10 px-6 py-4">
              <span className="text-xs font-medium uppercase tracking-wider text-ink-3">
                {creating ? 'Nueva tarea' : 'Editar tarea'}
              </span>
              <button onClick={onClose} aria-label="Close" className="rounded-lg p-1 text-ink-3 transition-colors hover:bg-ink-4/10 hover:text-ink-4">
                <svg className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
                </svg>
              </button>
            </div>

            <div className="flex-1 space-y-5 overflow-y-auto px-6 py-5">
              <div>
                <label className={labelCls}>Título</label>
                <input autoFocus={creating} value={form.title} onChange={(e) => set('title', e.target.value)} className={inputCls} placeholder="Nombre de la tarea" />
              </div>

              <div>
                <label className={labelCls}>Descripción</label>
                <textarea value={form.description} onChange={(e) => set('description', e.target.value)} rows={3} className={`${inputCls} resize-none`} placeholder="Detalles opcionales…" />
              </div>

              <div>
                <label className={labelCls}>Urgencia</label>
                <select value={form.urgency} onChange={(e) => set('urgency', e.target.value)} className={`${inputCls} appearance-none`}>
                  {TIERS.map((t) => (
                    <option key={t.id} value={t.id}>{t.label}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className={labelCls}>Día</label>
                <input type="date" value={form.due_date} onChange={(e) => set('due_date', e.target.value)} className={`${inputCls} [color-scheme:dark]`} />
                <p className="mt-1 text-[10px] text-ink-2">Le da a la tarjeta el color de ese día de la semana.</p>
              </div>

              <div>
                <label className={labelCls}>Entidad</label>
                <select value={form.entity_name} onChange={(e) => set('entity_name', e.target.value)} className={`${inputCls} appearance-none`}>
                  <option value="">— Ninguno —</option>
                  {entities.map((e) => (
                    <option key={e.id} value={e.name}>{e.name}</option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className={labelCls}>Key</label>
                  <input value={form.key} onChange={(e) => set('key', e.target.value)} className={`${inputCls} font-mono`} placeholder="CRM-01" />
                </div>
                <div>
                  <label className={labelCls}>Prioridad</label>
                  <input type="number" min={0} max={100} value={form.priority_score} onChange={(e) => set('priority_score', e.target.value)} className={inputCls} placeholder="0–100" />
                </div>
              </div>

              <div>
                <label className={labelCls}>Etiquetas</label>
                <input value={form.tags} onChange={(e) => set('tags', e.target.value)} className={inputCls} placeholder="diseño, cliente, urgente" />
                <p className="mt-1 text-[10px] text-ink-2">Separadas por coma</p>
              </div>
            </div>

            <div className="flex items-center gap-3 border-t border-ink-4/10 px-6 py-4">
              <button onClick={handleSave} disabled={saving || !form.title.trim()} className="flex-1 rounded-xl border border-accent/20 bg-accent/10 py-2.5 text-sm font-medium text-accent transition-colors hover:bg-accent/20 disabled:cursor-not-allowed disabled:opacity-40">
                {saving ? 'Guardando…' : creating ? 'Crear tarea' : 'Guardar cambios'}
              </button>
              {!creating && (
                <button onClick={handleDelete} disabled={deleting} className="rounded-xl border border-danger/20 px-4 py-2.5 text-sm font-medium text-danger transition-colors hover:bg-danger/10 disabled:opacity-40">
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

// ── CRMPage ────────────────────────────────────────────────────────────────

export default function TareasContent() {
  const [tasks, setTasks] = useState<Task[]>([])
  const [entities, setEntities] = useState<Entity[]>([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [view, setView] = useState<View>('kanban')
  const [drawerTask, setDrawerTask] = useState<Task | null>(null)
  const [creating, setCreating] = useState(false)
  const [entityFilter, setEntityFilter] = useState<string | null>(null)
  const [filterOpen, setFilterOpen] = useState(false)
  const filterRef = useRef<HTMLDivElement>(null)

  const loadAll = useCallback(async () => {
    setLoadError(null)
    try {
      const [tasksData, entitiesData] = await Promise.all([
        apiFetch<Task[]>('/api/tasks'),
        apiFetch<Entity[]>('/api/entities'),
      ])
      setTasks(tasksData)
      setEntities(entitiesData)
    } catch (err) {
      console.error('[CRMPage] load failed:', err)
      setLoadError(err instanceof Error ? err.message : 'Error al cargar')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { loadAll() }, [loadAll])

  // A task captured elsewhere (UniversalCapture → /api/capture) fires this; refetch so it shows here.
  useEffect(() => {
    const onCaptureTask = () => loadAll()
    window.addEventListener('capture:task', onCaptureTask)
    return () => window.removeEventListener('capture:task', onCaptureTask)
  }, [loadAll])

  useEffect(() => {
    if (!filterOpen) return
    function onClick(e: MouseEvent) {
      if (filterRef.current && !filterRef.current.contains(e.target as Node)) setFilterOpen(false)
    }
    document.addEventListener('mousedown', onClick)
    return () => document.removeEventListener('mousedown', onClick)
  }, [filterOpen])

  // Drag & drop between tier columns → change the task's urgency (optimistic, reverts on error).
  async function handleReorder(id: string, urgency: Urgency) {
    const prev = tasks.find((t) => t.id === id)
    if (!prev || (prev.urgency ?? 'someday') === urgency) return
    setTasks((ts) => ts.map((t) => (t.id === id ? { ...t, urgency } : t)))
    try {
      await apiPatch(`/api/tasks/${id}`, { urgency })
    } catch {
      setTasks((ts) => ts.map((t) => (t.id === id ? { ...t, urgency: prev.urgency } : t)))
    }
  }

  async function handleToggle(id: string, done: boolean) {
    const completed_at = done ? new Date().toISOString() : null
    setTasks((prev) => prev.map((t) => (t.id === id ? { ...t, completed_at } : t)))
    try {
      await apiPatch(`/api/tasks/${id}`, { completed_at })
    } catch {
      setTasks((prev) => prev.map((t) => (t.id === id ? { ...t, completed_at: done ? null : t.completed_at } : t)))
    }
  }

  async function handleSave(id: string, data: Partial<Task>) {
    const updated = await apiPatch<Task>(`/api/tasks/${id}`, data)
    setTasks((prev) => prev.map((t) => (t.id === id ? updated : t)))
    if (drawerTask?.id === id) setDrawerTask(updated)
  }

  async function handleDelete(id: string) {
    await apiDelete(`/api/tasks/${id}`)
    setTasks((prev) => prev.filter((t) => t.id !== id))
    if (drawerTask?.id === id) setDrawerTask(null)
  }

  async function handleCreateEntity(name: string) {
    const entity = await apiPost<Entity>('/api/entities', { name })
    setEntities((prev) => [...prev, entity].sort((a, b) => a.name.localeCompare(b.name)))
  }

  async function handleRenameEntity(id: string, name: string) {
    const updated = await apiPatch<Entity>(`/api/entities/${id}`, { name })
    setEntities((prev) =>
      prev.map((e) => (e.id === id ? updated : e)).sort((a, b) => a.name.localeCompare(b.name))
    )
    setTasks((prev) =>
      prev.map((t) => (t.entity_id === id ? { ...t, entity_name: updated.name } : t))
    )
  }

  async function handleCreateTask(data: Partial<Task>) {
    const task = await apiPost<Task>('/api/tasks', {
      title: data.title,
      description: data.description ?? null,
      urgency: data.urgency ?? 'someday',
      key: data.key ?? null,
      priority_score: data.priority_score ?? null,
      tags: data.tags ?? [],
      entity_name: data.entity_name ?? null,
      entity_id: entities.find((e) => e.name === data.entity_name)?.id ?? null,
      due_date: data.due_date ?? null,
    })
    setTasks((prev) => [task, ...prev])
  }

  async function handleDeleteEntity(id: string) {
    await apiDelete(`/api/entities/${id}`)
    setEntities((prev) => prev.filter((e) => e.id !== id))
    setTasks((prev) => prev.map((t) => (t.entity_id === id ? { ...t, entity_id: null } : t)))
  }

  const visibleTasks = entityFilter ? tasks.filter((t) => t.entity_name === entityFilter) : tasks
  const openCount = visibleTasks.filter((t) => !t.completed_at).length

  const VIEWS: { id: View; label: string }[] = [
    { id: 'kanban', label: 'Kanban' },
    { id: 'lista',  label: 'Lista' },
  ]

  return (
    <div className="mx-auto w-full max-w-7xl px-6 pb-16 pt-2">
      <div className="pb-2">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-ink-4">Tareas</h1>
            <p className="mt-1 text-xs text-ink-3">
              {loading ? 'Cargando…' : `${openCount} tarea${openCount === 1 ? '' : 's'} abierta${openCount === 1 ? '' : 's'}`}
            </p>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={() => { setCreating(true); setDrawerTask(null) }}
              className="flex items-center gap-1.5 rounded-xl border border-accent/20 bg-accent/10 px-4 py-2 text-sm font-medium text-accent transition-colors hover:bg-accent/20"
            >
              <svg viewBox="0 0 12 12" fill="none" className="h-3.5 w-3.5" stroke="currentColor" strokeWidth={2}>
                <path d="M6 2v8M2 6h8" strokeLinecap="round" />
              </svg>
              Nueva tarea
            </button>

          <nav className="flex items-center gap-1 rounded-full border border-ink-4/10 bg-ink-1/85 p-1 backdrop-blur-xl">
            {VIEWS.map((v) => (
              <button
                key={v.id}
                onClick={() => setView(v.id)}
                className={`rounded-full px-4 py-1.5 text-sm transition-colors ${
                  view === v.id ? 'bg-ink-4/10 font-medium text-ink-4' : 'text-ink-3 hover:text-ink-4'
                }`}
              >
                {v.label}
              </button>
            ))}
          </nav>
          </div>
        </div>

        {!loading && (
          <div ref={filterRef} className="relative mt-3 w-fit">
            <button
              onClick={() => setFilterOpen((o) => !o)}
              className={`flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs transition-colors ${
                entityFilter ? 'border-accent/30 bg-accent/10 text-accent' : 'border-ink-4/10 text-ink-3 hover:text-ink-4'
              }`}
            >
              <svg viewBox="0 0 14 14" className="h-3 w-3" fill="none" stroke="currentColor" strokeWidth={1.5}><path d="M1 3h12M3 7h8M5 11h4" strokeLinecap="round" /></svg>
              {entityFilter ?? 'Filtros'}
              <svg viewBox="0 0 12 12" className={`h-2.5 w-2.5 transition-transform ${filterOpen ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" strokeWidth={1.8}><path d="M3 5l3 3 3-3" strokeLinecap="round" strokeLinejoin="round" /></svg>
            </button>
            {filterOpen && (
              <div className="absolute left-0 top-full z-20 mt-1.5 w-80 rounded-xl border border-ink-4/10 bg-ink-0 p-3 shadow-2xl">
                <EntityManager
                  entities={entities}
                  activeFilter={entityFilter}
                  onFilter={setEntityFilter}
                  onCreate={handleCreateEntity}
                  onRename={handleRenameEntity}
                  onDelete={handleDeleteEntity}
                />
              </div>
            )}
          </div>
        )}
      </div>

      <div className="mt-6">
        {loadError && (
          <div className="mb-4 flex items-center gap-3 rounded-xl border border-danger/20 bg-danger/10 px-4 py-3">
            <span className="text-sm text-danger">{loadError}</span>
            <button onClick={loadAll} className="ml-auto shrink-0 text-xs font-medium text-danger underline-offset-2 hover:underline">
              Reintentar
            </button>
          </div>
        )}
        {loading ? (
          <div className="flex items-center justify-center py-32">
            <div className="h-6 w-6 animate-spin rounded-full border-2 border-ink-4/10 border-t-accent" />
          </div>
        ) : (
          <>
            {view === 'kanban' && (
              <KanbanView tasks={visibleTasks} onToggle={handleToggle} onClickTask={setDrawerTask} onMove={handleReorder} />
            )}
            {view === 'lista' && (
              <ListaView tasks={visibleTasks} onToggle={handleToggle} onClickTask={setDrawerTask} onMove={handleReorder} />
            )}
          </>
        )}
      </div>

      <TaskDrawer
        task={drawerTask}
        creating={creating}
        entities={entities}
        onClose={() => { setDrawerTask(null); setCreating(false) }}
        onCreate={handleCreateTask}
        onSave={handleSave}
        onDelete={handleDelete}
      />
    </div>
  )
}
