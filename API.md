# API

## Phase 1 endpoints

### `GET /health`

Returns the service liveness status:

```json
{"status":"ok"}
```

This endpoint intentionally does not require authentication or MongoDB availability. Protected application endpoints will be added in later phases.

## Phase 2 authentication endpoints

### `POST /auth/register`

Creates an account with a unique normalized username and email, hashes the password with Argon2, and returns a bearer access token plus the public user profile.

### `POST /auth/login`

Accepts an email and password and returns a bearer access token plus the public user profile. Invalid credentials receive the same response regardless of whether the account exists.

### `GET /auth/me`

Requires `Authorization: Bearer <token>` and returns the authenticated user's public profile. Password hashes are never returned.

## Phase 3 meeting and invitation endpoints

All meeting endpoints require a bearer token. The backend derives the host and participant identity from that token.

- `POST /meetings`: create a scheduled meeting and invite users by normalized username.
- `GET /meetings`: list meetings visible to the authenticated user.
- `GET /meetings/upcoming`: list visible meetings scheduled now or later.
- `GET /meetings/past`: list visible meetings scheduled before now.
- `GET /meetings/{meeting_id}`: view meeting details and its participant statuses.
- `PATCH /meetings/{meeting_id}`: update title, description, schedule, or duration; host only.
- `POST /meetings/{meeting_id}/cancel`: cancel a scheduled meeting; host only.
- `GET /meetings/invitations`: list invitations for the authenticated user.
- `POST /meetings/invitations/{invitation_id}/accept`: accept an owned pending invitation.
- `POST /meetings/invitations/{invitation_id}/decline`: decline an owned pending invitation.

Meeting statuses are `SCHEDULED`, `LIVE`, `ENDED`, and `CANCELLED`. A scheduled meeting becomes live after an authorized join; media transport is handled by LiveKit.

Meeting responses include `meeting_code`, `join_url`, `join_password`, and `invited_emails` for the host only. These fields are empty for accepted participants so one invitee cannot reuse the host's guest-invitation credentials or view other invitees' email addresses.

## Phase 4 video conferencing endpoints

- `POST /meetings/{meeting_id}/join`: authenticate the caller, verify host or accepted-participant access, transition a scheduled meeting to `LIVE`, and return a short-lived server-issued LiveKit token.
- `POST /meetings/{meeting_id}/leave`: record the authenticated participant leaving the LiveKit room.
- `POST /meetings/{meeting_id}/end`: end the meeting; host only.

Ending a meeting immediately blocks further joins, removes active non-host participants from the LiveKit room when configured, and records departure times for joined participants.

The frontend meeting room is available at `/meetings/{meeting_id}`. It requests the token from the backend and connects using the returned LiveKit URL. It does not generate authorization tokens. Camera, microphone, and screen sharing are explicit user actions.

## Phase 6 chat endpoints

- `GET /meetings/{meeting_id}/messages`: return persisted chat history for the host or an accepted participant.
- `POST /meetings/{meeting_id}/messages`: validate, rate-limit, persist, and broadcast a message through the LiveKit data channel.

Chat messages are limited to 2,000 characters and 30 messages per user per meeting per minute by default. Persistence occurs before real-time delivery; a LiveKit delivery failure does not discard the history record. Pending, declined, removed, blocked, and unrelated users receive `403`.

## Phase 8 voice moderation endpoints

- `POST /meetings/{meeting_id}/voice-moderation`: authenticated host or accepted participant submits a final browser-produced transcript for moderation. The JSON body requires `transcript` and `consent_given: true`; raw audio and unknown fields are rejected. The endpoint is rate-limited and stores only moderation decision metadata for host review. Missing consent receives `422`; declined consent receives `403`; unavailable moderation receives `503`.

Voice moderation is optional and does not use LiveKit audio capture. The browser speech-recognition provider handles microphone audio after explicit user action. The application does not receive or persist raw audio or transcript content.

## Phase 10 engagement alert endpoints

- `POST /meetings/{meeting_id}/engagement`: authenticated accepted host or participant submits the local estimate `{"score": 0-100, "status": "LOW|MODERATE|HIGH|UNAVAILABLE"}`. Only the latest score/status is retained in `focus_events`; raw frames and client-supplied timestamps are not accepted. `UNAVAILABLE` requires score `0`.
- `GET /meetings/{meeting_id}/engagement-alert`: host-only aggregate read. Metrics older than the configured stale window and `UNAVAILABLE` metrics are excluded. An alert is returned only when the low-engagement rate is strictly greater than `0.50` for at least 30 seconds and the five-minute cooldown is inactive.

The alert is an estimate for host assistance, not proof of attention and not an automatic punitive action. Phase 10 does not expose individual participant scores through the alert endpoint.

## Phase 11 meeting analytics endpoint

- `GET /meetings/{meeting_id}/analytics`: host-only derived analytics for scheduled and observed duration, participant attendance timeline, total participants, latest engagement distribution and extrema, and moderation outcomes. The endpoint reuses existing server-side meeting, participant, `focus_events`, and `moderation_events` data and does not return raw media or transcript content.

## Phase 7 chat moderation endpoints

- `GET /meetings/{meeting_id}/moderation`: host-only moderation event history.
- `POST /meetings/{meeting_id}/moderation/{user_id}`: host-only moderation action for a meeting participant. Supported actions are `WARN`, `MUTE`, `UNMUTE`, `DISABLE_CHAT`, `ENABLE_CHAT`, `REMOVE`, and `BLOCK`.

Chat submissions pass through the configurable baseline classifier. `SAFE` and `WARNING` messages are persisted and delivered; `BLOCK` messages create a moderation event but are not persisted or broadcast. A warning is an AI-assisted signal, not a final finding.

`MUTE` records a five-minute microphone restriction and, when the target is connected, requests LiveKit to mute active audio tracks. `UNMUTE` removes that restriction but does not enable the participant's microphone. `REMOVE` and `BLOCK` revoke backend meeting access and request an active LiveKit disconnect. All moderation requests derive the host identity from the bearer token; hosts cannot moderate themselves.

## Host meeting controls

- `GET /meetings/{meeting_id}/controls`: returns effective meeting-wide permissions to the authenticated host or accepted participant.
- `PATCH /meetings/{meeting_id}/controls`: host-only update for chat, participant microphone/camera, screen sharing, meeting lock, waiting-room flag, join-before-host, reactions, and raise-hand permissions. Values are stored on the meeting document.
- `GET /meetings/{meeting_id}/participants/{user_id}/controls`: returns effective participant restrictions for the host or that participant.
- `PATCH /meetings/{meeting_id}/participants/{user_id}/controls`: host-only update for participant chat, microphone, camera, and screen-share permissions. Camera and microphone restrictions request LiveKit to mute active tracks and apply to later LiveKit publish grants.

Chat sends, meeting joins, and LiveKit publish grants consume persisted control state. Reactions, raise-hand events, and waiting-room admission remain unavailable in the current client/realtime flow until their participant-event and admission workflows are implemented.
