import { NextResponse } from 'next/server'
import { readFile } from 'fs/promises'
import path from 'path'
import { createServerClient } from '@/lib/supabase'
import { insertMemoryChunk } from '@/lib/memoryIndex'

export const runtime = 'nodejs'
export const maxDuration = 300

const CONTEXT_FILE = path.join(process.cwd(), 'context', 'contexto-alex.md')

// Split the profile doc into independently-recoverable chunks: every heading (# ## ###) starts a new
// chunk (its heading + body up to the next heading) — so each ## section, each ### subsection, and
// each `## <fecha>` bitácora entry becomes its own chunk. Pure dividers / meta headings (a heading
// whose only body is blockquotes, `---` or blanks — e.g. `# PARTE 1`, the doc title) are dropped.
function chunkByHeadings(md: string): { section: string; content: string }[] {
  const chunks: { section: string; content: string }[] = []
  let cur: { section: string; lines: string[] } | null = null

  const flush = () => {
    if (!cur) return
    const body = cur.lines.slice(1).filter(l => {
      const t = l.trim()
      return t.length > 0 && !t.startsWith('>') && t !== '---'
    })
    const content = cur.lines.join('\n').trim()
    if (body.length > 0 && content) chunks.push({ section: cur.section, content })
    cur = null
  }

  for (const line of md.split('\n')) {
    const m = /^#{1,3}\s+(.+?)\s*$/.exec(line)
    if (m) { flush(); cur = { section: m[1].trim(), lines: [line] } }
    else { if (!cur) cur = { section: 'Intro', lines: [] }; cur.lines.push(line) }
  }
  flush()
  return chunks
}

// POST /api/context/reindex — re-ingest context/contexto-alex.md into memory_chunks as the "perfil"
// (backstage profile) layer. Idempotent + cheap to re-run: deletes ALL kind='perfil' chunks first,
// then re-inserts one chunk per section/entry. Returns { ok, indexed, cleared }.
export async function POST() {
  let md: string
  try {
    md = await readFile(CONTEXT_FILE, 'utf8')
  } catch {
    return NextResponse.json({ error: 'context/contexto-alex.md not found' }, { status: 404 })
  }

  const chunks = chunkByHeadings(md)
  const supabase = createServerClient()

  // Dedup: drop the whole previous 'perfil' layer so a re-ingest replaces it (never duplicates).
  const { data: deleted, error: delErr } = await supabase
    .from('memory_chunks')
    .delete()
    .eq('metadata->>kind', 'perfil')
    .select('id')
  if (delErr) return NextResponse.json({ error: delErr.message }, { status: 500 })
  const cleared = deleted?.length ?? 0

  let indexed = 0
  for (const ch of chunks) {
    await insertMemoryChunk(supabase, ch.content, { kind: 'perfil', section: ch.section })
    indexed++
  }

  return NextResponse.json({ ok: true, indexed, cleared })
}
