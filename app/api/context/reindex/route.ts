import { NextResponse } from 'next/server'
import { readFile } from 'fs/promises'
import path from 'path'
import { createServerClient } from '@/lib/supabase'
import { insertMemoryChunk } from '@/lib/memoryIndex'

export const runtime = 'nodejs'
export const maxDuration = 300

const CONTEXT_FILE = path.join(process.cwd(), 'context', 'contexto-alex.md')

// Split the profile doc into small, independently-recoverable chunks:
//   1. Split by markdown heading (# ## ###). Pure dividers/meta (a heading whose only body is
//      blockquotes / `---` / blanks — e.g. `# PARTE 1`, the doc title) are dropped.
//   2. A section that is a bullet LIST (≥2 top-level bullets) is split into ONE chunk per bullet,
//      each prefixed with the section title for context — so every person in the directory and every
//      bitácora item becomes its own focused chunk (a query like "quién es Andrés" hits it directly,
//      instead of a diluted 8-people blob). Prose sections stay as a single chunk.
function chunkDoc(md: string): { section: string; content: string }[] {
  type Sec = { title: string; heading: string; body: string[] }
  const secs: Sec[] = []
  let cur: Sec | null = null
  for (const line of md.split('\n')) {
    const m = /^#{1,3}\s+(.+?)\s*$/.exec(line)
    if (m) { if (cur) secs.push(cur); cur = { title: m[1].trim(), heading: line, body: [] } }
    else if (cur) cur.body.push(line)
  }
  if (cur) secs.push(cur)

  const hasBody = (lines: string[]) => lines.some(l => { const t = l.trim(); return t.length > 0 && !t.startsWith('>') && t !== '---' })
  const chunks: { section: string; content: string }[] = []

  for (const s of secs) {
    if (!hasBody(s.body)) continue   // drop pure divider / meta headings
    const bulletIdx = s.body.map((l, i) => (/^[-*]\s+/.test(l) ? i : -1)).filter(i => i >= 0)
    if (bulletIdx.length >= 2) {
      for (let b = 0; b < bulletIdx.length; b++) {
        const start = bulletIdx[b]
        const end   = b + 1 < bulletIdx.length ? bulletIdx[b + 1] : s.body.length
        const block = s.body.slice(start, end).join('\n').trim()
        if (block) chunks.push({ section: s.title, content: `${s.title}\n${block}` })
      }
    } else {
      chunks.push({ section: s.title, content: [s.heading, ...s.body].join('\n').trim() })
    }
  }
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

  const chunks = chunkDoc(md)
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
