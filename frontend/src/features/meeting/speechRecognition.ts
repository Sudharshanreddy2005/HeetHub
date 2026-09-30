export type SpeechRecognitionResultItem = { transcript: string }

export type SpeechRecognitionEvent = {
  resultIndex: number
  results: ArrayLike<{ isFinal: boolean; 0: SpeechRecognitionResultItem }>
}

export type SpeechRecognitionInstance = {
  continuous: boolean
  interimResults: boolean
  lang: string
  onresult: ((event: SpeechRecognitionEvent) => void) | null
  onerror: ((event: { error?: string }) => void) | null
  onend: (() => void) | null
  start: () => void
  stop: () => void
  abort: () => void
}

export type SpeechRecognitionConstructor = new () => SpeechRecognitionInstance

declare global {
  interface Window {
    SpeechRecognition?: SpeechRecognitionConstructor
    webkitSpeechRecognition?: SpeechRecognitionConstructor
  }
}

export type SpeechRecognitionCallbacks = {
  onFinalTranscript: (transcript: string) => void
  onError: (message: string) => void
  onEnd: () => void
}

export type SpeechRecognitionSession = {
  start: () => void
  stop: () => void
  abort: () => void
}

export interface SpeechToTextProvider {
  isSupported(): boolean
  createSession(callbacks: SpeechRecognitionCallbacks): SpeechRecognitionSession
}

/**
 * Opt-in browser speech recognition. Audio is handled by the browser/provider;
 * the application does not record it or transmit microphone bytes to its API.
 */
export class BrowserSpeechToTextProvider implements SpeechToTextProvider {
  isSupported() {
    return Boolean(window.SpeechRecognition || window.webkitSpeechRecognition)
  }

  createSession(callbacks: SpeechRecognitionCallbacks): SpeechRecognitionSession {
    const Constructor = window.SpeechRecognition || window.webkitSpeechRecognition
    if (!Constructor) throw new Error('Speech recognition is not supported by this browser')
    const recognition = new Constructor()
    recognition.continuous = false
    recognition.interimResults = false
    recognition.lang = navigator.language || 'en-US'
    recognition.onresult = (event) => {
      for (let index = event.resultIndex; index < event.results.length; index += 1) {
        const result = event.results[index]
        if (result.isFinal) callbacks.onFinalTranscript(result[0].transcript.trim())
      }
    }
    recognition.onerror = (event) => callbacks.onError(event.error ? `Speech recognition failed: ${event.error}` : 'Speech recognition failed')
    recognition.onend = callbacks.onEnd
    return { start: recognition.start.bind(recognition), stop: recognition.stop.bind(recognition), abort: recognition.abort.bind(recognition) }
  }
}

export const browserSpeechToTextProvider = new BrowserSpeechToTextProvider()
