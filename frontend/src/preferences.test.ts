import { beforeEach, describe, expect, it } from 'vitest'
import { DEFAULT_PREFERENCES, loadPreferences, resetPreferences, savePreferences } from './preferences'

describe('preferences', () => {
  beforeEach(() => localStorage.clear())

  it('uses safe defaults without enabling camera or visual monitoring', () => {
    expect(loadPreferences()).toMatchObject({
      theme: 'system',
      muteOnEntry: true,
      cameraOnEntry: false,
      visualEngagementConsent: false,
      voiceModerationConsent: false,
    })
  })

  it('persists personal preferences across reloads', () => {
    savePreferences({ ...DEFAULT_PREFERENCES, theme: 'dark', mirrorVideo: true, fontSize: 'large' })
    expect(loadPreferences()).toMatchObject({ theme: 'dark', mirrorVideo: true, fontSize: 'large' })
  })

  it('falls back to defaults when stored data is malformed', () => {
    localStorage.setItem('meethub.preferences', '{bad json')
    expect(loadPreferences()).toEqual(DEFAULT_PREFERENCES)
  })

  it('falls back per field when stored values are invalid', () => {
    localStorage.setItem('meethub.preferences', JSON.stringify({ theme: 'neon', reduceMotion: 'yes', fontSize: 'huge', mirrorVideo: true }))
    expect(loadPreferences()).toEqual({ ...DEFAULT_PREFERENCES, mirrorVideo: true })
  })

  it('resets and persists all personal defaults', () => {
    savePreferences({ ...DEFAULT_PREFERENCES, theme: 'dark', highContrast: true, cameraOnEntry: true })
    expect(resetPreferences()).toEqual(DEFAULT_PREFERENCES)
    expect(loadPreferences()).toEqual(DEFAULT_PREFERENCES)
  })
})