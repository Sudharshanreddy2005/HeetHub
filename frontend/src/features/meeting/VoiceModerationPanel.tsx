import { useEffect, useRef, useState } from 'react'

import { submitVoiceTranscript, type VoiceModerationResult } from './meetingApi'
import { browserSpeechToTextProvider, type SpeechRecognitionSession, type SpeechToTextProvider } from './speechRecognition'

type VoiceModerationPanelProps = {
  meetingId: string
  authToken: string
  provider?: SpeechToTextProvider
  initialConsent?: boolean
}

function resultMessage(result: VoiceModerationResult) {
  if (result.decision === 'BLOCK') return 'Potentially abusive speech was flagged for host review.'
  if (result.decision === 'WARNING') return 'Potentially abusive speech was detected. The host may review it.'
  return 'Speech checked without a moderation warning.'
}

export function VoiceModerationPanel({ meetingId, authToken, provider = browserSpeechToTextProvider, initialConsent = false }: VoiceModerationPanelProps) {
  const [hasConsent, setConsent] = useState(initialConsent)
  const [isListening, setListening] = useState(false)
  const [status, setStatus] = useState('')
  const session = useRef<SpeechRecognitionSession | null>(null)

  useEffect(() => () => session.current?.abort(), [])

  const stop = () => {
    session.current?.stop()
    session.current = null
    setListening(false)
  }

  const start = () => {
    if (!provider.isSupported()) {
      setStatus('Speech recognition is unavailable in this browser. Voice moderation remains off.')
      return
    }
    setStatus('Listening for one spoken response…')
    try {
      session.current = provider.createSession({
        onFinalTranscript: (transcript) => {
          if (!transcript) return
          setListening(false)
          setStatus('Checking the final transcript…')
          void submitVoiceTranscript(meetingId, authToken, transcript, hasConsent)
            .then((result) => setStatus(resultMessage(result)))
            .catch((error: unknown) => setStatus(error instanceof Error ? error.message : 'Voice moderation is unavailable'))
        },
        onError: (message) => {
          setListening(false)
          setStatus(message)
        },
        onEnd: () => {
          setListening(false)
          session.current = null
        },
      })
      session.current.start()
      setListening(true)
    } catch (error) {
      setStatus(error instanceof Error ? error.message : 'Speech recognition is unavailable')
    }
  }

  return (
    <section className="voice-moderation" aria-labelledby="voice-moderation-title">
      <h2 id="voice-moderation-title">Voice moderation</h2>
      {!hasConsent ? <>
        <p>Optional. Your browser processes one spoken response at a time. This app never records or uploads microphone audio; only final recognized text is checked and is not stored.</p>
        <p>Your browser or its speech-recognition provider may process microphone audio under its own policy.</p>
        <button type="button" onClick={() => setConsent(true)}>Allow voice moderation</button>
      </> : <>
        <p>Enabled for this meeting. Start recognition only when you want a spoken response checked.</p>
        <button type="button" onClick={() => isListening ? stop() : start()}>{isListening ? 'Stop voice check' : 'Start voice check'}</button>
        <button type="button" onClick={() => { stop(); setConsent(false); setStatus('Voice moderation disabled.') }}>Disable voice moderation</button>
      </>}
      {status && <p className="voice-status" role="status">{status}</p>}
    </section>
  )
}
