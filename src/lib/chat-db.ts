import { blink } from '@/blink/client'
import type { ChatMessagesRow } from '@/lib/db-types'

const table = blink.db.table<ChatMessagesRow>('chat_messages')

export type StoredChatMessage = Omit<ChatMessagesRow, 'reactions'> & {
  reactions?: Record<string, string[]>
}

function decode(row: ChatMessagesRow): StoredChatMessage {
  let reactions: Record<string, string[]> | undefined
  if (row.reactions) {
    try { reactions = JSON.parse(row.reactions) } catch { reactions = undefined }
  }
  return { ...row, reactions }
}

export async function listChatMessages(channelId: string, limit = 50) {
  const rows = await table.list({
    where: { channelId },
    orderBy: { timestamp: 'desc' },
    limit,
  })
  return rows.map(decode).reverse()
}

export async function saveChatMessage(message: {
  id: string
  channelId: string
  uid: string
  username: string
  photoURL: string
  timestamp: number
  text?: string
  gif?: string
  gifTitle?: string
  attachment?: string
  attachmentType?: string
  attachmentName?: string
  attachmentSize?: number
  reactions?: Record<string, string[]>
}) {
  await table.upsert({
    id: message.id,
    channelId: message.channelId,
    uid: message.uid,
    username: message.username,
    photoUrl: message.photoURL,
    timestamp: String(message.timestamp),
    text: message.text ?? null,
    gif: message.gif ?? null,
    gifTitle: message.gifTitle ?? null,
    attachment: message.attachment ?? null,
    attachmentType: message.attachmentType ?? null,
    attachmentName: message.attachmentName ?? null,
    attachmentSize: message.attachmentSize ?? null,
    reactions: message.reactions ? JSON.stringify(message.reactions) : null,
  })
}

export async function deleteChatMessage(id: string) {
  await table.delete(id)
}
