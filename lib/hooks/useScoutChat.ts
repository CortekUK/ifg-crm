'use client'

// Client-side hook driving the Scout chat: state, history loading, streaming
// SSE consumption, and tool-event capture.
//
// The route returns SSE with these event names (see app/api/scout/chat/route.ts):
//   token        — incremental assistant text. Append delta to the current
//                  assistant message.
//   tool_call    — model invoked a tool. Push a tool-event into the trail
//                  attached to the current assistant message.
//   tool_result  — tool finished. Update the matching trail entry with a
//                  digest (count + sample rows) so the UI can render it.
//   done         — final, with the conversation_id (so the widget can reuse
//                  it for the next turn) and message_id.
//   error        — surface to the user; abort the loop.

import { useCallback, useEffect, useRef, useState } from 'react'

export type ScoutRole = 'user' | 'assistant'

export interface ScoutToolEvent {
  id: string
  name: string
  args: Record<string, unknown>
  result?: unknown
  status: 'running' | 'done' | 'error'
}

export interface ScoutMessage {
  id: string
  role: ScoutRole
  content: string
  toolEvents?: ScoutToolEvent[]
  pending?: boolean
}

export interface ScoutConversationSummary {
  id: string
  title: string | null
  updated_at: string
}

interface UseScoutChatResult {
  messages: ScoutMessage[]
  conversations: ScoutConversationSummary[]
  conversationId: string | null
  sending: boolean
  error: string | null
  send: (text: string) => Promise<void>
  newConversation: () => void
  loadConversation: (id: string) => Promise<void>
  deleteConversation: (id: string) => Promise<void>
  refreshConversations: () => Promise<void>
}

function newId() {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) return crypto.randomUUID()
  return Math.random().toString(36).slice(2)
}

export function useScoutChat(): UseScoutChatResult {
  const [messages, setMessages] = useState<ScoutMessage[]>([])
  const [conversations, setConversations] = useState<ScoutConversationSummary[]>([])
  const [conversationId, setConversationId] = useState<string | null>(null)
  const [sending, setSending] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const abortRef = useRef<AbortController | null>(null)

  const refreshConversations = useCallback(async () => {
    try {
      const res = await fetch('/api/scout/conversations', { cache: 'no-store' })
      if (!res.ok) return
      const json = (await res.json()) as { conversations: ScoutConversationSummary[] }
      setConversations(json.conversations ?? [])
    } catch {
      // History is best-effort; failing to load shouldn't block sending.
    }
  }, [])

  useEffect(() => {
    refreshConversations()
  }, [refreshConversations])

  const newConversation = useCallback(() => {
    abortRef.current?.abort()
    setMessages([])
    setConversationId(null)
    setError(null)
  }, [])

  const loadConversation = useCallback(async (id: string) => {
    setError(null)
    setConversationId(id)
    try {
      const res = await fetch(`/api/scout/messages?conversation_id=${id}`, {
        cache: 'no-store',
      })
      if (!res.ok) {
        setError('Could not load that conversation.')
        return
      }
      const json = (await res.json()) as {
        messages: { id: string; role: 'user' | 'assistant'; content: string }[]
      }
      setMessages(
        json.messages.map((m) => ({
          id: m.id,
          role: m.role,
          content: m.content,
        })),
      )
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load conversation.')
    }
  }, [])

  const deleteConversation = useCallback(
    async (id: string) => {
      await fetch(`/api/scout/conversations?id=${id}`, { method: 'DELETE' })
      if (conversationId === id) newConversation()
      refreshConversations()
    },
    [conversationId, newConversation, refreshConversations],
  )

  const send = useCallback(
    async (text: string) => {
      const trimmed = text.trim()
      if (!trimmed || sending) return
      setError(null)
      setSending(true)

      const userMsg: ScoutMessage = {
        id: newId(),
        role: 'user',
        content: trimmed,
      }
      const assistantId = newId()
      const assistantMsg: ScoutMessage = {
        id: assistantId,
        role: 'assistant',
        content: '',
        toolEvents: [],
        pending: true,
      }

      // Optimistic: add user msg + empty assistant placeholder. We update the
      // assistant placeholder in place as tokens arrive.
      const historyForServer = [
        ...messages.map((m) => ({ role: m.role, content: m.content })),
        { role: 'user' as const, content: trimmed },
      ]
      setMessages((prev) => [...prev, userMsg, assistantMsg])

      const controller = new AbortController()
      abortRef.current = controller

      try {
        const res = await fetch('/api/scout/chat', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            conversation_id: conversationId,
            messages: historyForServer,
          }),
          signal: controller.signal,
        })

        if (!res.ok || !res.body) {
          let msg = 'Scout request failed.'
          try {
            const j = await res.json()
            if (j.error) msg = j.error
          } catch {
            // ignore
          }
          throw new Error(msg)
        }

        const reader = res.body.getReader()
        const decoder = new TextDecoder()
        let buffer = ''

        while (true) {
          const { value, done } = await reader.read()
          if (done) break
          buffer += decoder.decode(value, { stream: true })

          // SSE frames are separated by \n\n.
          let sepIdx
          while ((sepIdx = buffer.indexOf('\n\n')) !== -1) {
            const frame = buffer.slice(0, sepIdx)
            buffer = buffer.slice(sepIdx + 2)
            const event = parseSSEFrame(frame)
            if (!event) continue
            applyEvent(assistantId, event)
          }
        }
      } catch (e) {
        if ((e as Error).name === 'AbortError') return
        const msg = e instanceof Error ? e.message : 'Stream error'
        setError(msg)
        setMessages((prev) =>
          prev.map((m) =>
            m.id === assistantId ? { ...m, content: m.content || msg, pending: false } : m,
          ),
        )
      } finally {
        setSending(false)
        // Refresh conversation list so a new chat appears in the sidebar.
        refreshConversations()
      }
    },
    [conversationId, messages, sending, refreshConversations],
  )

  function applyEvent(
    assistantId: string,
    event: { name: string; data: Record<string, unknown> },
  ) {
    if (event.name === 'token') {
      const delta = typeof event.data.delta === 'string' ? event.data.delta : ''
      setMessages((prev) =>
        prev.map((m) =>
          m.id === assistantId ? { ...m, content: m.content + delta, pending: true } : m,
        ),
      )
    } else if (event.name === 'tool_call') {
      const toolEvent: ScoutToolEvent = {
        id: String(event.data.id ?? newId()),
        name: String(event.data.name ?? 'unknown'),
        args: (event.data.args as Record<string, unknown>) ?? {},
        status: 'running',
      }
      setMessages((prev) =>
        prev.map((m) =>
          m.id === assistantId
            ? { ...m, toolEvents: [...(m.toolEvents ?? []), toolEvent] }
            : m,
        ),
      )
    } else if (event.name === 'tool_result') {
      const eid = String(event.data.id ?? '')
      setMessages((prev) =>
        prev.map((m) =>
          m.id === assistantId
            ? {
                ...m,
                toolEvents: (m.toolEvents ?? []).map((t) =>
                  t.id === eid ? { ...t, result: event.data.result, status: 'done' } : t,
                ),
              }
            : m,
        ),
      )
    } else if (event.name === 'done') {
      const cid = (event.data.conversation_id as string | undefined) ?? null
      if (cid) setConversationId(cid)
      setMessages((prev) =>
        prev.map((m) => (m.id === assistantId ? { ...m, pending: false } : m)),
      )
    } else if (event.name === 'error') {
      const errMsg = (event.data.error as string) ?? 'Scout error'
      setError(errMsg)
      setMessages((prev) =>
        prev.map((m) =>
          m.id === assistantId
            ? { ...m, content: m.content || errMsg, pending: false }
            : m,
        ),
      )
    }
  }

  return {
    messages,
    conversations,
    conversationId,
    sending,
    error,
    send,
    newConversation,
    loadConversation,
    deleteConversation,
    refreshConversations,
  }
}

function parseSSEFrame(frame: string): { name: string; data: Record<string, unknown> } | null {
  let eventName = 'message'
  const dataLines: string[] = []
  for (const line of frame.split('\n')) {
    if (line.startsWith('event:')) {
      eventName = line.slice(6).trim()
    } else if (line.startsWith('data:')) {
      dataLines.push(line.slice(5).trim())
    }
  }
  if (dataLines.length === 0) return null
  try {
    const data = JSON.parse(dataLines.join('\n')) as Record<string, unknown>
    return { name: eventName, data }
  } catch {
    return null
  }
}
