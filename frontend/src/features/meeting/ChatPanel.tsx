import { useState } from 'react'
import type { FormEvent } from 'react'
import type { ChatMessage } from './meetingApi'

type ChatPanelProps = {
  messages: ChatMessage[]
  isOpen: boolean
  isSending: boolean
  error: string
  embedded?: boolean
  onToggle: () => void
  onSend: (content: string) => Promise<void>
  disabled?: boolean
  disabledMessage?: string
}

export function ChatPanel({ messages, isOpen, isSending, error, embedded = false, onToggle, onSend, disabled = false, disabledMessage = 'Chat has been disabled by the host.' }: ChatPanelProps) {
  const [draft, setDraft] = useState('')
  const submit = async (event: FormEvent) => {
    event.preventDefault()
    if (!draft.trim() || isSending) return
    await onSend(draft)
    setDraft('')
  }

  return (
    <aside className={`chat-panel ${isOpen ? 'chat-panel-open' : ''}${embedded ? ' chat-panel-embedded' : ''}`} aria-label="Meeting chat">
      {!embedded && <button type="button" className="chat-toggle" onClick={onToggle} aria-expanded={isOpen}>
        {isOpen ? 'Close chat' : 'Open chat'}
      </button>}
      {isOpen && <div className="chat-content">
        <h2>Meeting chat</h2>
        <div className="chat-messages" aria-live="polite">
          {messages.length ? messages.map((message) => <article className="chat-message" key={message.id}>
            <strong>{message.username}</strong>
            {message.moderation_decision === 'WARNING' && <span className="moderation-warning">Potentially abusive content</span>}
            <p>{message.content}</p>
            <time dateTime={message.created_at}>{new Date(message.created_at).toLocaleTimeString()}</time>
          </article>) : <p className="chat-empty">No messages yet.</p>}
        </div>
        {error && <p className="chat-error" role="alert">{error}</p>}
        {disabled && <p className="chat-disabled" role="status">{disabledMessage}</p>}
        <form className="chat-form" onSubmit={(event) => void submit(event)}>
          <label className="sr-only" htmlFor="chat-message">Message</label>
          <input id="chat-message" value={draft} disabled={disabled} onChange={(event) => setDraft(event.target.value)} maxLength={2000} placeholder={disabled ? 'Chat disabled' : 'Write a message'} />
          <button type="submit" disabled={disabled || isSending || !draft.trim()}>Send</button>
        </form>
      </div>}
    </aside>
  )
}
