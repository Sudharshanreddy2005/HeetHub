export type ThemePreference = 'light' | 'dark' | 'system'
export type FontSizePreference = 'small' | 'default' | 'large' | 'extra-large'

export type Preferences = {
  theme: ThemePreference
  reduceMotion: boolean
  highContrast: boolean
  fontSize: FontSizePreference
  microphoneDeviceId: string
  speakerDeviceId: string
  cameraDeviceId: string
  muteOnEntry: boolean
  cameraOnEntry: boolean
  mirrorVideo: boolean
  hdVideo: 'auto' | 'hd' | 'standard'
  visualEngagementConsent: boolean
  voiceModerationConsent: boolean
}

export const DEFAULT_PREFERENCES: Preferences = {
  theme: 'system',
  reduceMotion: false,
  highContrast: false,
  fontSize: 'default',
  microphoneDeviceId: '',
  speakerDeviceId: '',
  cameraDeviceId: '',
  muteOnEntry: true,
  cameraOnEntry: false,
  mirrorVideo: false,
  hdVideo: 'auto',
  visualEngagementConsent: false,
  voiceModerationConsent: false,
}

const STORAGE_KEY = 'meethub.preferences'

function isThemePreference(value: unknown): value is ThemePreference {
  return value === 'light' || value === 'dark' || value === 'system'
}

function isFontSizePreference(value: unknown): value is FontSizePreference {
  return value === 'small' || value === 'default' || value === 'large' || value === 'extra-large'
}

function normalizePreferences(value: unknown): Preferences {
  if (!value || typeof value !== 'object') return { ...DEFAULT_PREFERENCES }
  const stored = value as Partial<Preferences>
  return {
    theme: isThemePreference(stored.theme) ? stored.theme : DEFAULT_PREFERENCES.theme,
    reduceMotion: typeof stored.reduceMotion === 'boolean' ? stored.reduceMotion : DEFAULT_PREFERENCES.reduceMotion,
    highContrast: typeof stored.highContrast === 'boolean' ? stored.highContrast : DEFAULT_PREFERENCES.highContrast,
    fontSize: isFontSizePreference(stored.fontSize) ? stored.fontSize : DEFAULT_PREFERENCES.fontSize,
    microphoneDeviceId: typeof stored.microphoneDeviceId === 'string' ? stored.microphoneDeviceId : DEFAULT_PREFERENCES.microphoneDeviceId,
    speakerDeviceId: typeof stored.speakerDeviceId === 'string' ? stored.speakerDeviceId : DEFAULT_PREFERENCES.speakerDeviceId,
    cameraDeviceId: typeof stored.cameraDeviceId === 'string' ? stored.cameraDeviceId : DEFAULT_PREFERENCES.cameraDeviceId,
    muteOnEntry: typeof stored.muteOnEntry === 'boolean' ? stored.muteOnEntry : DEFAULT_PREFERENCES.muteOnEntry,
    cameraOnEntry: typeof stored.cameraOnEntry === 'boolean' ? stored.cameraOnEntry : DEFAULT_PREFERENCES.cameraOnEntry,
    mirrorVideo: typeof stored.mirrorVideo === 'boolean' ? stored.mirrorVideo : DEFAULT_PREFERENCES.mirrorVideo,
    hdVideo: stored.hdVideo === 'auto' || stored.hdVideo === 'hd' || stored.hdVideo === 'standard' ? stored.hdVideo : DEFAULT_PREFERENCES.hdVideo,
    visualEngagementConsent: typeof stored.visualEngagementConsent === 'boolean' ? stored.visualEngagementConsent : DEFAULT_PREFERENCES.visualEngagementConsent,
    voiceModerationConsent: typeof stored.voiceModerationConsent === 'boolean' ? stored.voiceModerationConsent : DEFAULT_PREFERENCES.voiceModerationConsent,
  }
}

export function loadPreferences(): Preferences {
  try {
    return normalizePreferences(JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '{}'))
  } catch {
    return { ...DEFAULT_PREFERENCES }
  }
}

export function savePreferences(preferences: Preferences): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(normalizePreferences(preferences)))
  } catch {
    // Preferences remain active for this session when browser storage is unavailable.
  }
}

export function resetPreferences(): Preferences {
  const defaults = { ...DEFAULT_PREFERENCES }
  savePreferences(defaults)
  return defaults
}