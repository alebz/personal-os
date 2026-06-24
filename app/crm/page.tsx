'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import Shell from '@/components/Shell'

// ── Types ──────────────────────────────────────────────────────────────────

type Urgency = 'today' | 'this_week' | 'this_month' | 'someday'
type View = 'kanban' | 'smart' | 'category'

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
}

// ── Constants ──────────────────────────────────────────────────────────────

const TIERS: {
  id: Urgency
  label: string
  dotCls: string
  badgeCls: string
  borderCls: string
}[] = [
  {
    id: 'today',
    label: 'Hoy',
    dotCls: 'bg-danger',
    badgeCls: 'text-danger border-danger/30',
    borderCls: 'border-danger/20',
  },
  {
    id: 'this_week',
    label: 'Esta Semana',
    dotCls: 'bg-warn',
    badgeCls: 'text-warn border-warn/30',
    borderCls: 'border-warn/20',
  },
  {
    id: 'this_month',
    label: 'Este Mes',
    dotCls: 'bg-accent',
    badgeCls: 'text-accent border-accent/30',
    borderCls: 'border-accent/20',
  },
  {
    id: 'someday',
    label: 'Algún Día',
    dotCls: 'bg-ink-3',
    badgeCls: 'text-ink-3 border-ink-4/10',
    borderCls: 'border-ink-4/10',
  },
]

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

function TaskCard({
  task,
  onToggle,
  onClick,
}: {
  task: Task
  onToggle: (id: string, done: boolean) => void
  onClick: (task: Task) => void
}) {
  const tier = TIERS.find((t) => t.id === task.urgency)
  const done = !!task.completed_at

  return (
    <div
      role="button"
      tabIndex={0}
      className="group relative cursor-pointer rounded-xl border border-ink-4/10 bg-ink-1/30 p-3 backdrop-blur-sm transition-all duration-150 hover:border-ink-4/20 hover:bg-ink-1/50 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-accent/40"
      onClick={() => onClick(task)}
      onKeyDown={(e) => e.key === 'Enter' && onClick(task)}
    >
      <div className="flex items-start gap-3">
        <button
          className="mt-0.5 shrink-0 focus-visible:outline-none"
          onClick={(e) => {
            e.stopPropagation()
            onToggle(task.id, !done)
          }}
          aria-label={done ? 'Mark incomplete' : 'Mark complete'}
        >
          <div
            className={`flex h-4 w-4 items-center justify-center rounded border transition-all duration-150 ${
              done ? 'border-ok/60 bg-ok/20' : 'border-ink-4/30 hover:border-ink-4/60'
            }`}
          >
            {done && (
              <svg className="h-2.5 w-2.5 text-ok" viewBox="0 0 10 10" fill="none">
                <path d="M1.5 5L4 7.5L8.5 2.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            )}
          </div>
        </button>

        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-2">
            <span className={`text-sm font-medium leading-snug ${done ? 'text-ink-2 line-through' : 'text-ink-4'}`}>
              {task.title}
            </span>
            {task.key && (
              <span className="shrink-0 rounded-md border border-ink-4/10 px-1.5 py-0.5 font-mono text-[10px] text-ink-3">
                {task.key}
              </span>
            )}
          </div>

          {task.description && !done && (
            <p className="mt-0.5 line-clamp-2 text-xs text-ink-3">{task.description}</p>
          )}

          <div className="mt-2 flex flex-wrap items-center gap-1.5">
            {task.entity_name && (
              <span className="text-[10px] font-medium text-ink-3">{task.entity_name}</span>
            )}
            {task.entity_name && task.tags?.length > 0 && (
              <span className="text-[10px] text-ink-2">·</span>
            )}
            {task.tags?.map((tag) => (
              <span key={tag} className="rounded-full border border-ink-4/10 px-1.5 py-0.5 text-[10px] text-ink-3">
                {tag}
              </span>
            ))}
            {task.priority_score != null && (
              <span className={`ml-auto rounded-full border px-1.5 py-0.5 text-[10px] font-semibold ${tier?.badgeCls ?? 'border-ink-4/10 text-ink-3'}`}>
                P{task.priority_score}
              </span>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

// ── NewTaskInput ───────────────────────────────────────────────────────────

function NewTaskInput({
  urgency,
  entityName,
  entityId,
  onAdd,
}: {
  urgency: Urgency
  entityName?: string
  entityId?: string
  onAdd: (task: Task) => void
}) {
  const [value, setValue] = useState('')
  const [adding, setAdding] = useState(false)
  const [errored, setErrored] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const title = value.trim()
    if (!title || adding) return
    setAdding(true)
    setErrored(false)
    try {
      const task = await apiPost<Task>('/api/tasks', {
        title,
        urgency,
        entity_name: entityName ?? null,
        entity_id: entityId ?? null,
        tags: [],
      })
      onAdd(task)
      setValue('')
      inputRef.current?.focus()
    } catch (err) {
      console.error('[NewTaskInput] POST /api/tasks failed:', err)
      setErrored(true)
      setTimeout(() => setErrored(false), 2000)
    } finally {
      setAdding(false)
    }
  }

  const [open, setOpen] = useState(false)

  function handleBlur() {
    if (!value.trim()) setOpen(false)
  }

  if (!open) {
    return (
      <button
        onClick={() => { setOpen(true); setTimeout(() => inputRef.current?.focus(), 0) }}
        className="mb-2 flex w-full items-center gap-1.5 rounded-lg border border-dashed border-ink-4/15 px-2.5 py-1.5 text-xs text-ink-2 transition-colors hover:border-ink-4/30 hover:text-ink-3"
      >
        <svg viewBox="0 0 12 12" fill="none" className="h-3 w-3 shrink-0" stroke="currentColor" strokeWidth={1.8}>
          <path d="M6 2v8M2 6h8" strokeLinecap="round" />
        </svg>
        Nueva tarea
      </button>
    )
  }

  return (
    <form onSubmit={handleSubmit} className="mb-2">
      <input
        ref={inputRef}
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onBlur={handleBlur}
        placeholder="Nombre de la tarea…"
        disabled={adding}
        className={`w-full rounded-lg border bg-ink-0/40 px-2.5 py-1.5 text-sm text-ink-4 placeholder:text-ink-2/50 transition-colors focus:outline-none focus:ring-1 disabled:opacity-40 ${
          errored
            ? 'border-danger/40 focus:ring-danger/20'
            : 'border-accent/30 focus:ring-accent/20'
        }`}
      />
      {errored && <p className="mt-0.5 text-[10px] text-danger">Error al guardar — revisar consola</p>}
    </form>
  )
}

// ── KanbanColumn ───────────────────────────────────────────────────────────

function KanbanColumn({
  tier,
  tasks,
  onToggle,
  onAdd,
  onClickTask,
}: {
  tier: (typeof TIERS)[number]
  tasks: Task[]
  onToggle: (id: string, done: boolean) => void
  onAdd: (task: Task) => void
  onClickTask: (task: Task) => void
}) {
  const [showDone, setShowDone] = useState(false)
  const open = tasks.filter((t) => !t.completed_at)
  const done = tasks.filter((t) => t.completed_at)

  return (
    <div className="flex flex-col gap-2">
      <div className="mb-1 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className={`h-2 w-2 rounded-full ${tier.dotCls}`} />
          <span className="text-xs font-semibold uppercase tracking-wider text-ink-3">{tier.label}</span>
        </div>
        <span className="tabular-nums text-[10px] text-ink-2">{open.length}</span>
      </div>

      <NewTaskInput urgency={tier.id} onAdd={onAdd} />

      <div className="flex flex-col gap-2">
        {open.length === 0 && <p className="py-6 text-center text-xs text-ink-2">Sin tareas abiertas</p>}
        {open.map((task) => (
          <TaskCard key={task.id} task={task} onToggle={onToggle} onClick={onClickTask} />
        ))}
      </div>

      {done.length > 0 && (
        <div className="mt-2">
          <button onClick={() => setShowDone((v) => !v)} className="text-[10px] text-ink-2 transition-colors hover:text-ink-3">
            {showDone ? '▾' : '▸'} {done.length} completadas
          </button>
          {showDone && (
            <div className="mt-2 flex flex-col gap-2 opacity-50">
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
  onAdd,
  onClickTask,
}: {
  tasks: Task[]
  onToggle: (id: string, done: boolean) => void
  onAdd: (task: Task) => void
  onClickTask: (task: Task) => void
}) {
  return (
    <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 xl:grid-cols-4">
      {TIERS.map((tier) => (
        <div key={tier.id} className={`rounded-2xl border bg-ink-1/40 p-4 shadow-xl shadow-black/20 backdrop-blur-xl ${tier.borderCls}`}>
          <KanbanColumn
            tier={tier}
            tasks={tasks.filter((t) => (t.urgency ?? 'someday') === tier.id)}
            onToggle={onToggle}
            onAdd={onAdd}
            onClickTask={onClickTask}
          />
        </div>
      ))}
    </div>
  )
}

// ── SmartView ──────────────────────────────────────────────────────────────

function SmartView({
  allTasks,
  onToggle,
  onClickTask,
}: {
  allTasks: Task[]
  onToggle: (id: string, done: boolean) => void
  onClickTask: (task: Task) => void
}) {
  const [query, setQuery] = useState('')
  const [matchedIds, setMatchedIds] = useState<string[] | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const results = matchedIds !== null ? allTasks.filter((t) => matchedIds.includes(t.id)) : null

  async function handleSearch(e: React.FormEvent) {
    e.preventDefault()
    const q = query.trim()
    if (!q || loading) return
    setLoading(true)
    setError(null)
    try {
      const matched = await apiPost<Task[]>('/api/tasks/smart', { query: q })
      setMatchedIds(matched.map((t) => t.id))
    } catch {
      setError('Error al buscar — revisa tu conexión e intenta de nuevo.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="mx-auto max-w-2xl">
      <div className="rounded-2xl border border-ink-4/10 bg-ink-1/40 p-6 shadow-xl shadow-black/20 backdrop-blur-xl">
        <div className="mb-5 flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl border border-accent/20 bg-accent/10 text-accent">
            <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none">
              <path d="M12 3L14.5 9H21L15.5 13L17.5 19L12 15.5L6.5 19L8.5 13L3 9H9.5L12 3Z" fill="currentColor" opacity="0.9" />
            </svg>
          </div>
          <div>
            <h3 className="text-sm font-semibold text-ink-4">Búsqueda Inteligente</h3>
            <p className="text-xs text-ink-3">Claude interpreta lenguaje natural para encontrar tareas</p>
          </div>
        </div>

        <form onSubmit={handleSearch} className="mb-5 flex gap-2">
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="ej. 'seguimiento urgente de clientes' o 'tareas de diseño esta semana'"
            className="flex-1 rounded-xl border border-ink-4/10 bg-ink-0/60 px-4 py-2.5 text-sm text-ink-4 placeholder:text-ink-2 transition-colors focus:border-accent/30 focus:outline-none focus:ring-1 focus:ring-accent/20"
          />
          <button
            type="submit"
            disabled={loading || !query.trim()}
            className="shrink-0 rounded-xl border border-accent/20 bg-accent/10 px-4 py-2.5 text-sm font-medium text-accent transition-colors hover:bg-accent/20 disabled:cursor-not-allowed disabled:opacity-40"
          >
            {loading ? '…' : 'Buscar'}
          </button>
        </form>

        {error && <p className="mb-4 text-sm text-danger">{error}</p>}

        {loading && (
          <div className="flex flex-col items-center gap-3 py-10 text-center">
            <div className="h-5 w-5 animate-spin rounded-full border-2 border-ink-4/10 border-t-accent" />
            <p className="text-sm text-ink-3">Claude está buscando…</p>
          </div>
        )}

        {!loading && results !== null && (
          <div>
            <p className="mb-3 text-xs text-ink-3">
              {results.length === 0 ? 'Sin tareas coincidentes.' : `${results.length} tarea${results.length === 1 ? '' : 's'} encontrada${results.length === 1 ? '' : 's'}`}
            </p>
            <div className="flex flex-col gap-2">
              {results.map((task) => (
                <TaskCard key={task.id} task={task} onToggle={onToggle} onClick={onClickTask} />
              ))}
            </div>
          </div>
        )}

        {!loading && results === null && (
          <div className="py-8 text-center">
            <p className="text-xs leading-relaxed text-ink-2">
              Intenta: &ldquo;todas las tareas de un cliente&rdquo; · &ldquo;prioridades de esta semana&rdquo; · &ldquo;cualquier cosa etiquetada diseño&rdquo;
            </p>
          </div>
        )}
      </div>
    </div>
  )
}

// ── CategoryView ───────────────────────────────────────────────────────────

function CategoryView({
  tasks,
  entities,
  onToggle,
  onAdd,
  onClickTask,
}: {
  tasks: Task[]
  entities: Entity[]
  onToggle: (id: string, done: boolean) => void
  onAdd: (task: Task) => void
  onClickTask: (task: Task) => void
}) {
  const entityNames = entities.map((e) => e.name)
  const groups = [
    ...entities.map((e) => ({ id: e.id as string | null, name: e.name })),
    { id: null, name: 'Sin categoría' },
  ].map((g) => ({
    ...g,
    tasks: tasks.filter((t) =>
      g.name === 'Sin categoría'
        ? !t.entity_name || !entityNames.includes(t.entity_name)
        : t.entity_name === g.name
    ),
  }))

  return (
    <div className="flex flex-col gap-4">
      {groups.map((group) => {
        const open = group.tasks.filter((t) => !t.completed_at)
        const done = group.tasks.filter((t) => t.completed_at)

        return (
          <div key={group.name} className="rounded-2xl border border-ink-4/10 bg-ink-1/40 p-5 shadow-xl shadow-black/20 backdrop-blur-xl">
            <div className="mb-4 flex items-center gap-3">
              <h3 className="text-xs font-semibold uppercase tracking-wider text-ink-3">{group.name}</h3>
              {open.length > 0 && (
                <span className="tabular-nums rounded-full border border-ink-4/10 px-1.5 py-0.5 text-[10px] text-ink-2">
                  {open.length}
                </span>
              )}
            </div>

            <NewTaskInput
              urgency="someday"
              entityName={group.name === 'Uncategorized' ? undefined : group.name}
              entityId={group.id ?? undefined}
              onAdd={onAdd}
            />

            <div className="flex flex-col gap-2">
              {open.map((task) => (
                <TaskCard key={task.id} task={task} onToggle={onToggle} onClick={onClickTask} />
              ))}
              {done.length > 0 && (
                <div className="mt-1 flex flex-col gap-2 opacity-40">
                  {done.map((task) => (
                    <TaskCard key={task.id} task={task} onToggle={onToggle} onClick={onClickTask} />
                  ))}
                </div>
              )}
              {open.length === 0 && done.length === 0 && (
                <p className="py-3 text-xs text-ink-2">Sin tareas aún.</p>
              )}
            </div>
          </div>
        )
      })}
    </div>
  )
}

// ── EntityManager ──────────────────────────────────────────────────────────

function EntityManager({
  entities,
  onCreate,
  onRename,
  onDelete,
}: {
  entities: Entity[]
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
    <div className="mt-3 flex flex-wrap items-center gap-2">
      <span className="shrink-0 text-[10px] font-semibold uppercase tracking-wider text-ink-2">
        Entidades
      </span>

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
            className="rounded-full border border-accent/30 bg-ink-1/60 px-3 py-0.5 text-xs text-ink-4 outline-none focus:ring-1 focus:ring-accent/30"
            style={{ width: Math.max(80, editingName.length * 8 + 28) }}
          />
        ) : (
          <div key={e.id} className="group flex items-center gap-0.5 rounded-full border border-ink-4/10 bg-ink-1/40 py-0.5 pl-2.5 pr-1">
            <span className="text-xs text-ink-3">{e.name}</span>
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
  const inputCls = 'w-full rounded-xl border border-ink-4/10 bg-ink-1/40 px-3 py-2.5 text-sm text-ink-4 placeholder:text-ink-2 transition-colors focus:border-accent/30 focus:outline-none focus:ring-1 focus:ring-accent/20'

  return (
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
    </>
  )
}

// ── CRMPage ────────────────────────────────────────────────────────────────

export default function CRMPage() {
  const [tasks, setTasks] = useState<Task[]>([])
  const [entities, setEntities] = useState<Entity[]>([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [view, setView] = useState<View>('kanban')
  const [drawerTask, setDrawerTask] = useState<Task | null>(null)
  const [creating, setCreating] = useState(false)

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

  function handleAdd(task: Task) {
    setTasks((prev) => [task, ...prev])
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
    })
    setTasks((prev) => [task, ...prev])
  }

  async function handleDeleteEntity(id: string) {
    await apiDelete(`/api/entities/${id}`)
    setEntities((prev) => prev.filter((e) => e.id !== id))
    setTasks((prev) => prev.map((t) => (t.entity_id === id ? { ...t, entity_id: null } : t)))
  }

  const openCount = tasks.filter((t) => !t.completed_at).length

  const VIEWS: { id: View; label: string }[] = [
    { id: 'kanban', label: 'Kanban' },
    { id: 'smart', label: 'Smart' },
    { id: 'category', label: 'Category' },
  ]

  return (
    <Shell glow="crm">
      <div className="mx-auto max-w-7xl px-6 pb-4 pt-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-semibold text-ink-4">Tareas</h1>
            <p className="mt-0.5 text-xs text-ink-3">
              {loading ? 'Loading…' : `${openCount} open task${openCount === 1 ? '' : 's'}`}
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

          <nav className="flex items-center gap-1 rounded-full border border-ink-4/10 bg-ink-1/40 p-1 backdrop-blur-xl">
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
          <EntityManager
            entities={entities}
            onCreate={handleCreateEntity}
            onRename={handleRenameEntity}
            onDelete={handleDeleteEntity}
          />
        )}
      </div>

      <main className="mx-auto max-w-7xl px-6 pb-16">
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
              <KanbanView tasks={tasks} onToggle={handleToggle} onAdd={handleAdd} onClickTask={setDrawerTask} />
            )}
            {view === 'smart' && (
              <SmartView allTasks={tasks} onToggle={handleToggle} onClickTask={setDrawerTask} />
            )}
            {view === 'category' && (
              <CategoryView tasks={tasks} entities={entities} onToggle={handleToggle} onAdd={handleAdd} onClickTask={setDrawerTask} />
            )}
          </>
        )}
      </main>

      <TaskDrawer
        task={drawerTask}
        creating={creating}
        entities={entities}
        onClose={() => { setDrawerTask(null); setCreating(false) }}
        onCreate={handleCreateTask}
        onSave={handleSave}
        onDelete={handleDelete}
      />
    </Shell>
  )
}
