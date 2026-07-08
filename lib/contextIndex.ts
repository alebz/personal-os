import { readFile } from 'fs/promises'
import path from 'path'
import { createHash } from 'crypto'
import { createServerClient } from '@/lib/supabase'
import { insertMemoryChunk } from '@/lib/memoryIndex'

type SB = ReturnType<typeof createServerClient>

const CONTEXT_FILE = path.join(process.cwd(), 'context', 'contexto-alex.md')

// Split the profile doc into small, independently-recoverable chunks:
//   1. Split by markdown heading (# ## ###). Pure dividers/meta (a heading whose only body is
//      blockquotes / `---` / blanks — e.g. `# PARTE 1`, the doc title) are dropped.
//   2. A section that is a bullet LIST (≥2 top-level bullets) is split into ONE chunk per bullet,
//      each prefixed with its section title — so every person in the directory and every bitácora
//      item is its own focused chunk (a query like "quién es Andrés" hits it directly instead of a
//      diluted multi-person blob). Prose sections stay as a single chunk.
export function chunkDoc(md: string): { section: string; content: string }[] {
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
    if (!hasBody(s.body)) continue
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

// Read the profile doc + its content hash (null if the file is missing).
export async function readContextDoc(): Promise<{ md: string; hash: string } | null> {
  try {
    const md = await readFile(CONTEXT_FILE, 'utf8')
    return { md, hash: createHash('sha256').update(md).digest('hex') }
  } catch {
    return null
  }
}

// The doc hash stored on the currently-indexed 'perfil' chunks (null if none indexed).
export async function indexedContextHash(supabase: SB): Promise<string | null> {
  const { data } = await supabase
    .from('memory_chunks')
    .select('metadata')
    .eq('metadata->>kind', 'perfil')
    .limit(1)
    .maybeSingle()
  return (data?.metadata as { doc_hash?: string } | null)?.doc_hash ?? null
}

// Full reindex: replace the whole 'perfil' layer (dedup) with fresh chunks stamped with the doc hash.
export async function reindexContext(
  supabase: SB,
): Promise<{ indexed: number; cleared: number; hash: string } | { error: string }> {
  const doc = await readContextDoc()
  if (!doc) return { error: 'context/contexto-alex.md not found' }

  const chunks = chunkDoc(doc.md)
  const { data: deleted, error } = await supabase
    .from('memory_chunks')
    .delete()
    .eq('metadata->>kind', 'perfil')
    .select('id')
  if (error) return { error: error.message }
  const cleared = deleted?.length ?? 0

  let indexed = 0
  for (const ch of chunks) {
    await insertMemoryChunk(supabase, ch.content, { kind: 'perfil', section: ch.section, doc_hash: doc.hash })
    indexed++
  }
  return { indexed, cleared, hash: doc.hash }
}
