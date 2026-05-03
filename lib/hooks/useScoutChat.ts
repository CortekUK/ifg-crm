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

// Attachments the user adds via paste / drop / picker.
//
//   image — sent to gpt-4o vision as an image_url part. dataUrl is a
//           base64-encoded data: URI; we keep it client-side only (not
//           persisted) so the payload stays bounded.
//   text  — read on the client and inlined in the message body as a fenced
//           code block, prefixed with the filename. Suitable for csv/json/md/
//           code files. Anything binary should not be uploaded as 'text'.
export type ScoutAttachment =
  | { kind: 'image'; name: string; dataUrl: string; size: number }
  | { kind: 'text'; name: string; content: string; size: number }

export interface ScoutMessage {
  id: string
  role: ScoutRole
  content: string
  // ISO timestamp. Set when sending (Date.now) and when loading history
  // (server's created_at). Used by the bubble's hover row to render a date.
  createdAt?: string
  // Only set on user messages with attachments — used by the bubble renderer
  // to show thumbnails / file chips. Server doesn't echo these back, so they
  // disappear after a page reload (deliberate; see persistence note above).
  attachments?: ScoutAttachment[]
  toolEvents?: ScoutToolEvent[]
  pending?: boolean
}

export interface ScoutConversationSummary {
  id: string
  title: string | null
  starred?: boolean
  updated_at: string
}

interface UseScoutChatResult {
  messages: ScoutMessage[]
  conversations: ScoutConversationSummary[]
  conversationId: string | null
  sending: boolean
  // Set to the conversation id while loadConversation is fetching messages.
  // Null when nothing is loading. Used by the sidebar to spin the row that
  // was clicked, and by the main pane to render a skeleton thread.
  loadingConversationId: string | null
  error: string | null
  // Temporary chat mode. While true, sends carry an `incognito: true` flag
  // and the server skips persistence (no conversation, no message rows, no
  // memory writes). Memory READS still apply.
  incognito: boolean
  setIncognito: (v: boolean) => void
  send: (text: string, attachments?: ScoutAttachment[]) => Promise<void>
  stop: () => void
  // Retry the user message at this id — re-runs that message after deleting
  // it (and everything after) on the server. Falls back to local-only branch
  // if the server delete fails.
  retryFromUser: (userMessageId: string) => Promise<void>
  // Like retryFromUser but anchored on an assistant message — finds the
  // user message that produced it, deletes from there, and re-sends.
  regenerateAssistant: (assistantMessageId: string) => Promise<void>
  // Edit a user message's text, splice the rest, and resend with the new text.
  editAndResend: (userMessageId: string, newText: string) => Promise<void>
  newConversation: () => void
  loadConversation: (id: string) => Promise<void>
  deleteConversation: (id: string) => Promise<void>
  renameConversation: (id: string, title: string) => Promise<void>
  toggleStar: (id: string, starred: boolean) => Promise<void>
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
  const [loadingConversationId, setLoadingConversationId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [incognito, setIncognito] = useState(false)
  // Mirror in a ref so the latest value is visible inside the streaming
  // callback closure without forcing a re-render of `send`.
  const incognitoRef = useRef(false)
  useEffect(() => {
    incognitoRef.current = incognito
  }, [incognito])
  const abortRef = useRef<AbortController | null>(null)
  // Track the in-flight assistant message id so `stop()` knows which bubble
  // to mark as no-longer-pending (otherwise the typing dots stay forever).
  const inflightAssistantIdRef = useRef<string | null>(null)

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
    // Reset incognito on a new chat so a fresh thread starts persistent
    // unless the user explicitly toggles it back on.
    setIncognito(false)
  }, [])

  // Cancel an in-flight stream. The actual cleanup (typing-dots off, finally
  // block, sending=false) is driven by the AbortError branch in `send`.
  const stop = useCallback(() => {
    abortRef.current?.abort()
  }, [])

  // Branch helpers (edit/retry/regenerate) are declared AFTER `send` because
  // they all delegate to it; see further down in this hook.

  const loadConversation = useCallback(async (id: string) => {
    setError(null)
    setConversationId(id)
    setLoadingConversationId(id)
    // Clear messages immediately so the main pane shows the skeleton instead
    // of the previous chat's content while the new one loads.
    setMessages([])
    try {
      const res = await fetch(`/api/scout/messages?conversation_id=${id}`, {
        cache: 'no-store',
      })
      if (!res.ok) {
        setError('Could not load that conversation.')
        return
      }
      const json = (await res.json()) as {
        messages: { id: string; role: 'user' | 'assistant'; content: string; created_at?: string }[]
      }
      setMessages(
        json.messages.map((m) => ({
          id: m.id,
          role: m.role,
          content: m.content,
          createdAt: (m as { created_at?: string }).created_at,
        })),
      )
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load conversation.')
    } finally {
      setLoadingConversationId(null)
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

  // Optimistic local update first, then revalidate from the server. Keeps the
  // sidebar feeling instant — Claude does the same with their pin/rename.
  const renameConversation = useCallback(
    async (id: string, title: string) => {
      setConversations((prev) =>
        prev.map((c) => (c.id === id ? { ...c, title } : c)),
      )
      try {
        await fetch(`/api/scout/conversations/${id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ title }),
        })
      } finally {
        refreshConversations()
      }
    },
    [refreshConversations],
  )

  const toggleStar = useCallback(
    async (id: string, starred: boolean) => {
      // Optimistic — UI flips instantly. We deliberately do NOT refresh the
      // whole conversation list afterwards: re-fetching introduces a brief
      // visual round-trip where the row briefly re-shows the old star state
      // before settling, which read as a multi-second flicker in testing.
      // The PATCH response is authoritative; if it fails we revert in place.
      setConversations((prev) =>
        prev.map((c) => (c.id === id ? { ...c, starred } : c)),
      )
      try {
        const res = await fetch(`/api/scout/conversations/${id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ starred }),
        })
        if (!res.ok) throw new Error('star toggle failed')
      } catch {
        setConversations((prev) =>
          prev.map((c) => (c.id === id ? { ...c, starred: !starred } : c)),
        )
      }
    },
    [],
  )

  const send = useCallback(
    async (text: string, attachments: ScoutAttachment[] = []) => {
      const trimmed = text.trim()
      // Allow attachment-only messages (e.g. "look at this screenshot" with no
      // accompanying text). Either text OR at least one attachment is required.
      if (!trimmed && attachments.length === 0) return
      if (sending) return
      setError(null)
      setSending(true)

      // Build the OpenAI content parts. Text-file attachments get inlined as
      // fenced code blocks so the model sees them as plain text; images go in
      // as image_url parts for gpt-4o vision.
      type Part =
        | { type: 'text'; text: string }
        | { type: 'image_url'; image_url: { url: string; detail?: 'low' | 'high' | 'auto' } }
      const parts: Part[] = []
      const textBlocks: string[] = []
      if (trimmed) textBlocks.push(trimmed)
      for (const a of attachments) {
        if (a.kind === 'text') {
          textBlocks.push(`File: ${a.name}\n\`\`\`\n${a.content}\n\`\`\``)
        }
      }
      if (textBlocks.length > 0) {
        parts.push({ type: 'text', text: textBlocks.join('\n\n') })
      }
      for (const a of attachments) {
        if (a.kind === 'image') {
          parts.push({ type: 'image_url', image_url: { url: a.dataUrl, detail: 'auto' } })
        }
      }
      const wireContent: string | Part[] =
        attachments.length === 0 ? trimmed : parts

      const nowIso = new Date().toISOString()
      const userMsg: ScoutMessage = {
        id: newId(),
        role: 'user',
        content: trimmed,
        createdAt: nowIso,
        attachments: attachments.length > 0 ? attachments : undefined,
      }
      const assistantId = newId()
      const assistantMsg: ScoutMessage = {
        id: assistantId,
        role: 'assistant',
        content: '',
        createdAt: nowIso,
        toolEvents: [],
        pending: true,
      }

      // Optimistic: add user msg + empty assistant placeholder. We update the
      // assistant placeholder in place as tokens arrive. For history, prior
      // turns are sent as their plain text (we never resend old image bytes —
      // that's why this hook has a session-bounded notion of attachments).
      const historyForServer: { role: 'user' | 'assistant'; content: string | Part[] }[] = [
        ...messages.map((m) => ({ role: m.role, content: m.content })),
        { role: 'user' as const, content: wireContent },
      ]
      setMessages((prev) => [...prev, userMsg, assistantMsg])

      const controller = new AbortController()
      abortRef.current = controller
      inflightAssistantIdRef.current = assistantId

      try {
        const res = await fetch('/api/scout/chat', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            conversation_id: conversationId,
            incognito: incognitoRef.current,
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
        if ((e as Error).name === 'AbortError') {
          // User pressed Stop. Drop the typing dots and tag whatever streamed
          // text already arrived as "(stopped)" so the bubble looks finished.
          setMessages((prev) =>
            prev.map((m) =>
              m.id === assistantId
                ? {
                    ...m,
                    content: m.content
                      ? m.content + '\n\n_(stopped)_'
                      : '_(stopped)_',
                    pending: false,
                  }
                : m,
            ),
          )
          return
        }
        const msg = e instanceof Error ? e.message : 'Stream error'
        setError(msg)
        setMessages((prev) =>
          prev.map((m) =>
            m.id === assistantId ? { ...m, content: m.content || msg, pending: false } : m,
          ),
        )
      } finally {
        setSending(false)
        inflightAssistantIdRef.current = null
        // Refresh conversation list so a new chat appears in the sidebar.
        // In incognito mode nothing was saved, so skip the round-trip.
        if (!incognitoRef.current) refreshConversations()
      }
    },
    [conversationId, messages, sending, refreshConversations],
  )

  // ---------------------------------------------------------------------
  // Branch helpers: edit/retry/regenerate.
  //
  // All three converge on "splice the conversation at this user message and
  // re-send its (optionally edited) text". The server gets a DELETE so its
  // history matches what the user sees on screen.
  // ---------------------------------------------------------------------

  const branchFromUserMessage = useCallback(
    async (userMessageId: string, overrideText?: string) => {
      const idx = messages.findIndex(
        (m) => m.id === userMessageId && m.role === 'user',
      )
      if (idx === -1) return
      const userMessage = messages[idx]
      const text = (overrideText ?? userMessage.content).trim()
      if (!text && (userMessage.attachments?.length ?? 0) === 0) return

      abortRef.current?.abort()
      const truncated = messages.slice(0, idx)
      setMessages(truncated)

      if (conversationId) {
        try {
          await fetch(
            `/api/scout/messages?conversation_id=${conversationId}&from_id=${userMessageId}`,
            { method: 'DELETE' },
          )
        } catch {
          // best-effort
        }
      }

      await send(text)
    },
    [messages, conversationId, send],
  )

  const retryFromUser = useCallback(
    async (userMessageId: string) => {
      await branchFromUserMessage(userMessageId)
    },
    [branchFromUserMessage],
  )

  const editAndResend = useCallback(
    async (userMessageId: string, newText: string) => {
      await branchFromUserMessage(userMessageId, newText)
    },
    [branchFromUserMessage],
  )

  const regenerateAssistant = useCallback(
    async (assistantMessageId: string) => {
      const idx = messages.findIndex((m) => m.id === assistantMessageId)
      if (idx === -1) return
      let userIdx = -1
      for (let i = idx - 1; i >= 0; i--) {
        if (messages[i].role === 'user') {
          userIdx = i
          break
        }
      }
      if (userIdx === -1) return
      await branchFromUserMessage(messages[userIdx].id)
    },
    [messages, branchFromUserMessage],
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
    loadingConversationId,
    error,
    incognito,
    setIncognito,
    send,
    stop,
    retryFromUser,
    regenerateAssistant,
    editAndResend,
    newConversation,
    loadConversation,
    deleteConversation,
    renameConversation,
    toggleStar,
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
