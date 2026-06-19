import OpenAI, { toFile } from 'openai'

let client: OpenAI | null = null

export function getOpenAI(): OpenAI {
  if (!process.env.OPENAI_API_KEY) {
    throw new Error('Missing OPENAI_API_KEY environment variable.')
  }
  client ??= new OpenAI()
  return client
}

/** Transcribe a voice note with Whisper. */
export async function transcribeAudio(
  audio: ArrayBuffer,
  filename = 'voice.ogg'
): Promise<string> {
  const file = await toFile(Buffer.from(audio), filename)
  const result = await getOpenAI().audio.transcriptions.create({
    file,
    model: 'whisper-1',
  })
  return result.text
}

/** Embed text with text-embedding-3-small (1536 dims). */
export async function embed(text: string): Promise<number[]> {
  const result = await getOpenAI().embeddings.create({
    model: 'text-embedding-3-small',
    input: text,
  })
  return result.data[0].embedding
}
