import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

import { VoiceModerationPanel } from './VoiceModerationPanel'
import type { SpeechRecognitionCallbacks, SpeechToTextProvider } from './speechRecognition'

const baseProps = { meetingId: 'meeting-1', authToken: 'token' }

describe('VoiceModerationPanel', () => {
  it('requires an explicit opt-in and explains that raw audio is not uploaded', () => {
    render(<VoiceModerationPanel {...baseProps} provider={{ isSupported: () => false, createSession: vi.fn() }} />)

    expect(screen.getByText(/never records or uploads microphone audio/i)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Allow voice moderation' })).toBeInTheDocument()
  })

  it('shows a speech-to-text provider failure without exposing audio', () => {
    const provider: SpeechToTextProvider = {
      isSupported: () => true,
      createSession: (callbacks: SpeechRecognitionCallbacks) => ({
        start: () => callbacks.onError('Speech recognition failed: network'),
        stop: vi.fn(),
        abort: vi.fn(),
      }),
    }
    render(<VoiceModerationPanel {...baseProps} provider={provider} />)

    fireEvent.click(screen.getByRole('button', { name: 'Allow voice moderation' }))
    fireEvent.click(screen.getByRole('button', { name: 'Start voice check' }))

    expect(screen.getByRole('status')).toHaveTextContent('Speech recognition failed: network')
  })
})
