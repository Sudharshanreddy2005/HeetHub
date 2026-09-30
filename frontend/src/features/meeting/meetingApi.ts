export type MeetingAccess = {
  meeting_id: string
  room_name: string
  livekit_url: string
  token: string
  is_host: boolean
}

export type MeetingControls = {
  meeting_id: string
  is_host: boolean
  allow_chat: boolean
  allow_participant_microphone: boolean
  allow_participant_camera: boolean
  allow_screen_share: boolean
  allow_reactions: boolean
  allow_raise_hand: boolean
  meeting_locked: boolean
  waiting_room_enabled: boolean
  join_before_host: boolean
}

export type ParticipantControls = {
  user_id: string
  username: string
  chat_allowed: boolean
  microphone_allowed: boolean
  camera_allowed: boolean
  screen_share_allowed: boolean
}

export type User = { id: string; username: string; email: string; full_name: string; phone: string; role: string; created_at: string }
export type AuthResponse = { access_token: string; token_type: string; user: User }
export type Participant = { username: string; role: string; invitation_status: string }
export type Meeting = {
  id: string
  title: string
  description: string
  scheduled_at: string
  duration_minutes: number
  status: string
  host_username: string
  meeting_code?: string
  join_url?: string
  join_password?: string
  participants: Participant[]
}
export type Invitation = {
  id: string
  meeting_id: string
  meeting_title: string
  host_username: string
  scheduled_at: string
  duration_minutes: number
  invitation_status: string
  created_at: string
}

const apiBaseUrl = (import.meta.env.VITE_API_URL ?? '').replace(/\/$/, '')

export function apiFetch(path: string, init?: RequestInit): Promise<Response> {
  return globalThis.fetch(`${apiBaseUrl}${path}`, init)
}

function fetch(path: string, init?: RequestInit): Promise<Response> {
  return apiFetch(path, init)
}

function readableDetail(detail: unknown): string | undefined {
  if (typeof detail === 'string') return detail
  if (!Array.isArray(detail)) return undefined
  const messages = detail.flatMap((item) => {
    if (typeof item !== 'object' || item === null || !('msg' in item) || typeof item.msg !== 'string') return []
    return [item.msg]
  })
  return messages.length ? messages.join(' ') : undefined
}

async function apiError(response: Response, fallback: string, unauthorizedFallback?: string): Promise<Error> {
  const detail = readableDetail((await response.json().catch(() => null))?.detail)
  if (response.status === 401) return new Error(detail ?? unauthorizedFallback ?? 'Your session has expired. Please sign in again.')
  if (response.status === 403) return new Error(detail ?? 'You are not authorized to perform this action.')
  if (response.status === 404) return new Error(detail ?? 'The requested resource was not found.')
  if (response.status === 409) return new Error(detail ?? 'This action conflicts with the current meeting state.')
  if (response.status === 422) return new Error(detail ?? 'Check the submitted fields and try again.')
  if (response.status === 503) return new Error(detail ?? 'The service is temporarily unavailable.')
  return new Error(detail ?? fallback)
}

export async function login(email: string, password: string): Promise<AuthResponse> {
  const response = await fetch('/auth/login', {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email, password }),
  })
  if (!response.ok) throw await apiError(response, 'Unable to sign in', 'Invalid email or password')
  return response.json() as Promise<AuthResponse>
}

export async function register(payload: {
  username: string
  email: string
  full_name: string
  phone: string
  password: string
  password_confirmation: string
}): Promise<AuthResponse> {
  const response = await fetch('/auth/register', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  })
  if (!response.ok) throw await apiError(response, 'Unable to create your account')
  return response.json() as Promise<AuthResponse>
}

export async function fetchCurrentUser(authToken: string): Promise<User> {
  const response = await fetch('/auth/me', { headers: { Authorization: `Bearer ${authToken}` } })
  if (!response.ok) throw await apiError(response, 'Unable to load your profile')
  return response.json() as Promise<User>
}

export async function fetchMeetings(authToken: string, path = '/meetings/upcoming'): Promise<Meeting[]> {
  const response = await fetch(path, { headers: { Authorization: `Bearer ${authToken}` } })
  if (!response.ok) throw await apiError(response, 'Unable to load meetings')
  return response.json() as Promise<Meeting[]>
}

export async function fetchMeetingDetails(meetingId: string, authToken: string): Promise<Meeting> {
  const response = await fetch(`/meetings/${encodeURIComponent(meetingId)}`, {
    headers: { Authorization: `Bearer ${authToken}` },
  })
  if (!response.ok) throw await apiError(response, 'Unable to load meeting details')
  return response.json() as Promise<Meeting>
}

export async function fetchInvitations(authToken: string): Promise<Invitation[]> {
  const response = await fetch('/meetings/invitations', { headers: { Authorization: `Bearer ${authToken}` } })
  if (!response.ok) throw await apiError(response, 'Unable to load invitations')
  return response.json() as Promise<Invitation[]>
}

export async function createMeeting(authToken: string, payload: {
  title: string; description: string; scheduled_at: string; duration_minutes: number; participant_usernames?: string[]; participant_emails?: string[]
}): Promise<Meeting> {
  const response = await fetch('/meetings', {
    method: 'POST', headers: { Authorization: `Bearer ${authToken}`, 'Content-Type': 'application/json' }, body: JSON.stringify(payload),
  })
  if (!response.ok) throw await apiError(response, 'Unable to create the meeting')
  return response.json() as Promise<Meeting>
}

export async function updateInvitation(authToken: string, invitationId: string, action: 'accept' | 'decline'): Promise<Invitation> {
  const response = await fetch(`/meetings/invitations/${encodeURIComponent(invitationId)}/${action}`, {
    method: 'POST', headers: { Authorization: `Bearer ${authToken}` },
  })
  if (!response.ok) throw await apiError(response, `Unable to ${action} the invitation`)
  return response.json() as Promise<Invitation>
}

export type ChatMessage = {
  id: string
  meeting_id: string
  username: string
  content: string
  created_at: string
  moderation_decision: 'SAFE' | 'WARNING' | 'BLOCK'
}

export type MeetingAnalytics = {
  meeting_id: string
  meeting_status: string
  scheduled_duration_minutes: number
  actual_duration_seconds: number
  attendance: Array<{ username: string; role: string; invitation_status: string; joined_at: string | null; left_at: string | null }>
  total_participants: number
  engagement: { high: number; moderate: number; low: number; unavailable: number; eligible: number; average_score: number | null; peak_score: number | null; lowest_score: number | null }
  moderation: { total_events: number; warnings: number; blocked: number; allowed: number; host_actions: number; muted: number; removed: number; blocked_participants: number }
}

export async function requestMeetingAccess(meetingId: string, authToken: string): Promise<MeetingAccess> {
  const response = await fetch(`/meetings/${encodeURIComponent(meetingId)}/join`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${authToken}`,
    },
  })

  if (!response.ok) {
    const detail = (await response.json().catch(() => null))?.detail
    throw new Error(detail ?? 'Unable to join this meeting')
  }
  return response.json() as Promise<MeetingAccess>
}

export async function requestMeetingAccessByCode(meetingCode: string, joinPassword: string, authToken: string): Promise<MeetingAccess> {
  const response = await fetch('/meetings/join', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${authToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ meeting_code: meetingCode, join_password: joinPassword }),
  })

  if (!response.ok) {
    const detail = (await response.json().catch(() => null))?.detail
    throw new Error(detail ?? 'Unable to join this meeting')
  }
  return response.json() as Promise<MeetingAccess>
}

export async function leaveMeeting(meetingId: string, authToken: string): Promise<void> {
  await fetch(`/meetings/${encodeURIComponent(meetingId)}/leave`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${authToken}`,
    },
  })
}

export async function endMeeting(meetingId: string, authToken: string): Promise<void> {
  const response = await fetch(`/meetings/${encodeURIComponent(meetingId)}/end`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${authToken}`,
    },
  })
  if (!response.ok) {
    throw new Error('Only the host can end this meeting')
  }
}

export async function fetchMeetingControls(meetingId: string, authToken: string): Promise<MeetingControls> {
  const response = await fetch(`/meetings/${encodeURIComponent(meetingId)}/controls`, { headers: { Authorization: `Bearer ${authToken}` } })
  if (!response.ok) throw await apiError(response, 'Unable to load meeting controls')
  return response.json() as Promise<MeetingControls>
}

export async function updateMeetingControls(meetingId: string, authToken: string, changes: Partial<MeetingControls>): Promise<MeetingControls> {
  const response = await fetch(`/meetings/${encodeURIComponent(meetingId)}/controls`, {
    method: 'PATCH',
    headers: { Authorization: `Bearer ${authToken}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(changes),
  })
  if (!response.ok) throw await apiError(response, 'Unable to update meeting controls')
  return response.json() as Promise<MeetingControls>
}

export async function updateParticipantControls(
  meetingId: string,
  authToken: string,
  userId: string,
  changes: Partial<Omit<ParticipantControls, 'user_id' | 'username'>>,
): Promise<ParticipantControls> {
  const response = await fetch(`/meetings/${encodeURIComponent(meetingId)}/participants/${encodeURIComponent(userId)}/controls`, {
    method: 'PATCH',
    headers: { Authorization: `Bearer ${authToken}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(changes),
  })
  if (!response.ok) throw await apiError(response, 'Unable to update participant controls')
  return response.json() as Promise<ParticipantControls>
}

export async function fetchMessageHistory(meetingId: string, authToken: string): Promise<ChatMessage[]> {
  const response = await fetch(`/meetings/${encodeURIComponent(meetingId)}/messages`, {
    headers: { Authorization: `Bearer ${authToken}` },
  })
  if (!response.ok) throw new Error('Unable to load chat history')
  return response.json() as Promise<ChatMessage[]>
}

export async function fetchMeetingAnalytics(meetingId: string, authToken: string): Promise<MeetingAnalytics> {
  const response = await fetch(`/meetings/${encodeURIComponent(meetingId)}/analytics`, { headers: { Authorization: `Bearer ${authToken}` } })
  if (!response.ok) throw await apiError(response, 'Unable to load meeting analytics')
  return response.json() as Promise<MeetingAnalytics>
}

export async function sendMessage(meetingId: string, authToken: string, content: string): Promise<ChatMessage> {
  const response = await fetch(`/meetings/${encodeURIComponent(meetingId)}/messages`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${authToken}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ content }),
  })
  if (!response.ok) {
    const detail = (await response.json().catch(() => null))?.detail
    throw new Error(detail ?? 'Unable to send message')
  }
  return response.json() as Promise<ChatMessage>
}

export type ModerationAction = 'WARN' | 'MUTE' | 'UNMUTE' | 'DISABLE_CHAT' | 'ENABLE_CHAT' | 'DISABLE_CAMERA' | 'ENABLE_CAMERA' | 'DISABLE_SCREEN_SHARE' | 'ENABLE_SCREEN_SHARE' | 'REMOVE' | 'BLOCK'

export type VoiceModerationResult = {
  decision: 'SAFE' | 'WARNING' | 'BLOCK'
  score: number
  action: string
}

export type EngagementAlert = {
  alert: boolean
  message: string | null
  low_engagement_rate: number
  eligible_participants: number
  low_engagement_participants: number
  low_since: string | null
  cooldown_until: string | null
}

export async function submitEngagementMetric(meetingId: string, authToken: string, score: number, status: string): Promise<void> {
  const response = await fetch(`/meetings/${encodeURIComponent(meetingId)}/engagement`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${authToken}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ score, status }),
  })
  if (!response.ok) throw await apiError(response, 'Unable to submit engagement estimate')
}

export async function fetchEngagementAlert(meetingId: string, authToken: string): Promise<EngagementAlert> {
  const response = await fetch(`/meetings/${encodeURIComponent(meetingId)}/engagement-alert`, {
    headers: { Authorization: `Bearer ${authToken}` },
  })
  if (!response.ok) throw await apiError(response, 'Unable to load engagement alert')
  return response.json() as Promise<EngagementAlert>
}

export async function moderateParticipant(
  meetingId: string,
  authToken: string,
  userId: string,
  action: ModerationAction,
): Promise<void> {
  const response = await fetch(`/meetings/${encodeURIComponent(meetingId)}/moderation/${encodeURIComponent(userId)}`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${authToken}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ action }),
  })
  if (!response.ok) {
    const detail = (await response.json().catch(() => null))?.detail
    throw new Error(detail ?? 'Unable to apply the moderation action')
  }
}

export async function submitVoiceTranscript(
  meetingId: string,
  authToken: string,
  transcript: string,
  consentGiven = true,
): Promise<VoiceModerationResult> {
  const response = await fetch(`/meetings/${encodeURIComponent(meetingId)}/voice-moderation`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${authToken}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ transcript, consent_given: consentGiven }),
  })
  if (!response.ok) {
    const detail = (await response.json().catch(() => null))?.detail
    throw new Error(detail ?? 'Voice moderation is unavailable')
  }
  return response.json() as Promise<VoiceModerationResult>
}
