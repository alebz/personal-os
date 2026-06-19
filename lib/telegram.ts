// Thin wrapper over the Telegram Bot API for the parts the webhook needs.

const API_BASE = 'https://api.telegram.org'

function botToken(): string {
  const token = process.env.TELEGRAM_BOT_TOKEN
  if (!token) throw new Error('Missing TELEGRAM_BOT_TOKEN environment variable.')
  return token
}

export type InlineKeyboardButton = {
  text: string
  callback_data: string
}

export type InlineKeyboardMarkup = {
  inline_keyboard: InlineKeyboardButton[][]
}

async function callApi<T = unknown>(method: string, body: unknown): Promise<T> {
  const res = await fetch(`${API_BASE}/bot${botToken()}/${method}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  const data = (await res.json()) as { ok: boolean; result: T; description?: string }
  if (!data.ok) {
    throw new Error(`Telegram ${method} failed: ${data.description ?? res.status}`)
  }
  return data.result
}

export function sendMessage(
  chatId: number | string,
  text: string,
  replyMarkup?: InlineKeyboardMarkup
) {
  return callApi('sendMessage', {
    chat_id: chatId,
    text,
    parse_mode: 'HTML',
    reply_markup: replyMarkup,
  })
}

export function answerCallbackQuery(callbackQueryId: string, text?: string) {
  return callApi('answerCallbackQuery', {
    callback_query_id: callbackQueryId,
    text,
  })
}

export function editMessageReplyMarkup(
  chatId: number | string,
  messageId: number,
  replyMarkup: InlineKeyboardMarkup
) {
  return callApi('editMessageReplyMarkup', {
    chat_id: chatId,
    message_id: messageId,
    reply_markup: replyMarkup,
  })
}

/** Resolve a Telegram file_id to a temporary download URL. */
export async function getFileUrl(fileId: string): Promise<string> {
  const result = await callApi<{ file_path: string }>('getFile', {
    file_id: fileId,
  })
  return `${API_BASE}/file/bot${botToken()}/${result.file_path}`
}

/** Download a Telegram-hosted file (e.g. a voice note) as raw bytes. */
export async function downloadFile(fileId: string): Promise<ArrayBuffer> {
  const url = await getFileUrl(fileId)
  const res = await fetch(url)
  if (!res.ok) {
    throw new Error(`Failed to download Telegram file: ${res.status}`)
  }
  return res.arrayBuffer()
}
