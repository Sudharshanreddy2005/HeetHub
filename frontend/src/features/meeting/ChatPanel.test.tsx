import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

import { ChatPanel } from './ChatPanel'

describe('ChatPanel moderation state', () => {
  it('keeps warning messages visible and marks them as potentially abusive', () => {
    render(
      <ChatPanel
        messages={[{
          id: 'message-1',
          meeting_id: 'meeting-1',
          username: 'guest',
          content: 'That was stupid',
          created_at: '2026-08-23T00:00:00Z',
          moderation_decision: 'WARNING',
        }]}
        isOpen
        isSending={false}
        error=""
        onToggle={vi.fn()}
        onSend={vi.fn(async () => undefined)}
      />,
    )

    expect(screen.getByText('That was stupid')).toBeInTheDocument()
    expect(screen.getByText('Potentially abusive content')).toBeInTheDocument()
  })
})
