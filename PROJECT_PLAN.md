# AI Secure Meeting Project Plan

## Current implementation status

The Phase 0 baseline below is historical. Under this plan's numbering, the source implements Phases 1–12: foundation, authentication/users, meetings/invitations, LiveKit video, private-meeting authorization, chat, chat toxicity moderation, voice-transcript moderation, a consented local visual-engagement baseline, host alerts, host analytics, and centralized engagement scoring. Automated unit and integration tests exist, but Phase 13 system integration/acceptance remains partial; Phase 14 production deployment has not started. Phase 9 keeps frames local, and Phase 10 sends only score/status metrics to the authorized backend.

## 1. Phase 0 Baseline

### Repository inspection

The project directory currently contains only `AGENTS.md`. No application code or project configuration was found.

| Area | Current state | Phase 0 decision |
| --- | --- | --- |
| Frontend | Missing | Create a Vite React TypeScript application in `frontend/` |
| Backend | Missing | Create a modular FastAPI application in `backend/` |
| Database | Missing | Use MongoDB through a centralized backend data-access layer |
| AI | Missing | Add modular baseline services after the meeting platform is reliable |
| Dependencies | No manifests found | Add only phase-required dependencies |
| Environment | No `.env` or `.env.example` found | Add a documented `.env.example`; never commit real secrets |
| Tests | No tests found | Establish frontend, backend, AI, and integration test locations incrementally |
| Deployment | No Docker or cloud configuration found | Add local Docker Compose first, then production deployment configuration |
| Documentation | `AGENTS.md` only | Add architecture, API, privacy, security, and AI documentation as behavior is implemented |

`AGENTS.md` is the controlling product and engineering specification. Because there is no existing implementation, no functionality can be reused and no architectural conflict was found. The first implementation phase should establish the foundation before authentication or meeting features are attempted.

## 2. Target Architecture

Use a modular monolith initially, with clear boundaries between the frontend, backend, and AI processing.

```text
React/Vite frontend
  |-- REST API ----------------------> FastAPI backend
  |                                      |-- Auth and authorization
  |-- Authenticated WebSocket --------- |-- Meetings and invitations
  |                                      |-- Chat and moderation events
  |                                      |-- Analytics and notifications
  |                                      `-- MongoDB data access
  `-- LiveKit client -----------------> LiveKit/WebRTC

Browser-local engagement processing ---> metrics only ---> backend analytics
Chat transcript -----------------------> moderation service
Temporary voice transcript ------------> moderation service (no raw audio storage by default)
```

### Ownership boundaries

- The frontend owns presentation, client state, API clients, LiveKit integration, permission UX, and local engagement feature extraction where practical.
- The backend owns authentication, authorization, meeting lifecycle, invitations, membership checks, WebSocket authentication, persistence, moderation decisions, notifications, and analytics access control.
- AI modules own preprocessing, feature extraction, scoring, moderation inference, thresholds, evaluation, and documented limitations.
- LiveKit/WebRTC owns media transport. A custom media protocol will not be introduced.

## 3. Proposed Repository Structure

```text
/
├── AGENTS.md
├── PROJECT_PLAN.md
├── README.md
├── ARCHITECTURE.md
├── API.md
├── PRIVACY.md
├── SECURITY.md
├── AI_MODEL.md
├── .env.example
├── .gitignore
├── frontend/
│   ├── src/
│   │   ├── app/
│   │   ├── components/
│   │   ├── features/
│   │   ├── lib/
│   │   └── types/
│   ├── public/
│   ├── package.json
│   └── AGENTS.md
├── backend/
│   ├── app/
│   │   ├── core/
│   │   ├── auth/
│   │   ├── users/
│   │   ├── meetings/
│   │   ├── participants/
│   │   ├── notifications/
│   │   ├── chat/
│   │   ├── moderation/
│   │   └── analytics/
│   ├── tests/
│   ├── requirements.txt
│   └── AGENTS.md
├── ai/
│   ├── engagement/
│   │   ├── face_detection/
│   │   ├── gaze_detection/
│   │   ├── head_pose/
│   │   └── scoring/
│   ├── moderation/
│   │   ├── toxicity/
│   │   └── speech_to_text/
│   ├── tests/
│   └── AGENTS.md
├── docker/
└── docker-compose.yml
```

The structure is a target, not a reason to create empty directories in Phase 0. Each directory should be introduced when its owning phase needs it.

## 4. Technology Stack

| Layer | Planned technology | Constraint |
| --- | --- | --- |
| Frontend | React, Vite, TypeScript, Tailwind CSS | Responsive and accessible UI |
| Media | LiveKit client SDK and WebRTC | Tokens generated by the backend; no frontend secrets |
| Backend | Python, FastAPI, Pydantic | Modular routers and services |
| Authentication | JWT and a maintained password-hashing library | Secrets and token policy are environment-configured |
| Database | MongoDB, MongoDB Atlas in production | Explicit indexes and centralized connection lifecycle |
| AI | OpenCV, MediaPipe, scikit-learn, speech-to-text, optional model libraries | Start with rule-based engagement and configurable thresholds |
| Local development | Docker and Docker Compose | Reproducible backend/database startup |
| Production | AWS or equivalent managed services, MongoDB Atlas, LiveKit Cloud or self-hosted LiveKit | Chosen after production constraints and cost are confirmed |

## 5. Development Phases and Gates

1. **Phase 1: Foundation**
   - Create frontend and backend foundations, configuration, health endpoints, logging, error handling, MongoDB connection, Docker, and Compose.
   - Gate: frontend build, backend startup, health checks, and foundation tests pass.
2. **Phase 2: Authentication and users**
   - Add registration, login, logout/token handling, password hashing, usernames, profiles, authentication middleware, and authorization middleware.
   - Gate: duplicate-user, invalid-login, expiry, and unauthorized-request tests pass.
3. **Phase 3: Meetings and invitations**
   - Add meeting lifecycle, scheduling, history, username search, invitations, notifications, accept/decline flows, and indexes.
   - Gate: ownership and invitation authorization tests pass.
4. **Phase 4: Video conferencing**
   - Integrate backend-issued LiveKit tokens, camera/microphone controls, participant grid, screen sharing, connection states, host controls, and leave handling.
   - Gate: permission, reconnection, meeting-ended, and real connectivity checks pass.
5. **Phase 5: Private meeting authorization**
   - Enforce backend checks for authentication, active meeting state, accepted invitation, blocked status, membership, and role permissions across REST, WebSocket, and LiveKit token issuance.
   - Gate: unauthorized users cannot obtain access or join.
6. **Phase 6: Real-time chat**
   - Add authenticated meeting WebSockets, history, timestamps, sender identity, system messages, announcements, disconnect handling, and membership checks.
7. **Phase 7: Chat toxicity detection**
   - Add configurable SAFE/WARNING/BLOCK decisions, moderation events, and host actions. Preserve host authority and support review of probabilistic results.
8. **Phase 8: Voice moderation**
   - Add consented temporary browser speech-to-text processing and toxicity checks with graceful failure handling. Require consent on the backend, accept final transcript text only, and do not persist raw audio or transcript content by default.
   - Gate: explicit opt-in/opt-out, authorization, payload validation, rate limiting, model fallback, privacy, frontend, and container checks pass.
9. **Phase 9: Visual engagement estimation**
   - Add consent UX and opt-out, local face/visibility/gaze/head-pose proxy features, temporal smoothing, and a rule-based score from 0 to 100. Camera off is `UNAVAILABLE`, never low engagement.
   - Gate: local-only processing, explicit consent, camera-off handling, bounded scoring, smoothing, UI disclosure, and regression checks pass.
10. **Phase 10: Engagement alerts**
   - Add eligible-participant aggregation, low-engagement duration, smoothing, a configurable 50% threshold, and a five-minute cooldown with neutral language. Only score/status metrics are submitted; raw frames remain local.
   - Gate: authenticated metric submission, host-only alert reads, stale metric handling, strict threshold, 30-second duration, five-minute cooldown, neutral UI, and regression checks pass.
11. **Phase 11: Meeting analytics**
   - Add protected host analytics for duration, attendance, engagement distribution, extrema, and moderation outcomes, derived from existing meeting participant, focus metric, and moderation event data.
   - Gate: host-only authorization, bounded derived response, attendance/duration calculations, engagement aggregation, moderation outcomes, frontend states, and regression checks pass.
12. **Phase 12: Engagement scoring**
   - Calculate the weighted engagement score from gaze, head pose, face presence, face visibility, and temporal consistency. Keep weights and interpretation thresholds centralized and validated; preserve `UNAVAILABLE` for camera-disabled or invalid observations.
   - Gate: weighted scoring, score bounds, threshold mapping, temporal consistency, unavailable handling, consent/privacy boundaries, Phase 9/10/11 regression checks, and documentation pass.
13. **Phase 13: Testing and integration**
    - Complete unit, integration, authorization, frontend, AI, and end-to-end coverage for the critical user journey.
14. **Phase 14: Production deployment**
    - Validate environment configuration, container builds, Compose, HTTPS, WebSockets, monitoring, migrations/indexes, backups, and deployment smoke tests before any production claim.

Each phase is gated. A failing foundation or security gate blocks the next feature phase.

## 6. Database Design

### Collections

- `users`: username, normalized email, password hash, role, timestamps, and account status. Passwords are never stored in plaintext.
- `meetings`: title, host ID, schedule, lifecycle status (`SCHEDULED`, `LIVE`, `ENDED`, `CANCELLED`), timestamps, and settings.
- `meeting_participants`: meeting ID, user ID, role, invitation status, blocked state, and join/leave timestamps.
- `notifications`: recipient, type, related meeting/invitation, read state, and timestamps.
- `messages`: meeting, sender, content or moderated representation, moderation state, and timestamp.
- `moderation_events`: meeting, user, event type, severity, model score, action, reviewer/host action, and timestamp.
- `focus_events`: meeting, user, metric status, score, timestamp, and model/configuration version. No raw frames.
- `meeting_analytics`: authorized host-facing aggregates and moderation totals, generated from metrics/events.

### Data rules and indexes

- Normalize usernames and emails for uniqueness checks.
- Add unique indexes for normalized username and email.
- Add compound indexes for participant lookup by meeting/user, invitation lookup by recipient/status, messages by meeting/time, and metrics by meeting/user/time.
- Keep event history bounded or archived according to a documented retention policy; avoid unbounded embedded arrays.
- Never persist raw engagement video or raw audio by default.

## 7. API Plan

Base paths will remain consistent and documented in `API.md`:

```text
/api/auth
/api/users
/api/meetings
/api/participants
/api/notifications
/api/messages
/api/moderation
/api/focus
/api/analytics
```

Initial endpoint groups:

- Auth: register, login, logout/token revocation strategy, and current profile.
- Users: authenticated username search and profile access.
- Meetings: create, list, retrieve, update, cancel, invite, accept/decline, join, leave, and end.
- Chat: message history and moderation-aware message submission.
- Moderation: host-visible events and authorized warn/mute/chat-disable/remove/block actions.
- Focus and analytics: consent-aware metric submission and host-authorized aggregate reads.
- WebSockets: authenticated meeting events, chat, and notifications with membership validation before acceptance.

All request bodies use Pydantic validation. Resource ownership and membership are derived from the authenticated server identity, never from client-supplied user IDs, roles, or permissions.

## 8. AI Architecture

### Engagement

The first model is a documented rule-based baseline. Local browser processing extracts face presence, face visibility, gaze, and head-pose signals; temporal smoothing produces an estimate. Initial weights are gaze 30%, head pose 25%, face presence 20%, face visibility 15%, and temporal consistency 10%. Weights, thresholds, and model version are configuration, not constants hidden in UI code.

Outputs are `LOW`, `MODERATE`, `HIGH`, or `UNAVAILABLE`. They represent visual engagement estimates and must not be presented as proof of attention or used for automatic punishment.

### Moderation

Chat and temporary voice transcripts pass through a toxicity classifier producing a score and configurable `SAFE`, `WARNING`, or `BLOCK` decision. The system records the moderation event and gives the host final control. False-positive and normal-message tests are required.

Every model or heuristic will document purpose, input, output, data source/license where relevant, evaluation metrics, thresholds, limitations, and false-positive/false-negative risks in `AI_MODEL.md`.

## 9. Security Architecture

- Hash passwords with a maintained password-hashing implementation; never log credentials, JWTs, API keys, or raw media.
- Keep JWT, MongoDB, LiveKit, AWS, and AI credentials in environment configuration or a production secret manager.
- Validate authentication and authorization on every protected REST and WebSocket path.
- Issue short-lived, least-privilege LiveKit tokens server-side after meeting authorization succeeds.
- Configure explicit CORS origins, rate limits, request-size limits, and safe error responses without stack traces.
- Validate meeting state, invitation status, blocked state, and role on the backend for every sensitive operation.
- Add security tests for forged user IDs/roles, unauthorized analytics, WebSocket access, token expiry, and invitation bypass attempts.
- Treat external AI inputs and model outputs as untrusted; do not allow model text or prompts to override authorization or host controls.

## 10. Privacy Architecture

- Show clear AI monitoring consent before visual engagement analysis and allow users to continue without it.
- Never activate camera, microphone, recording, or AI monitoring silently.
- Prefer local engagement processing and send metrics rather than frames.
- Treat camera-off as `UNAVAILABLE`, not distracted or low.
- Avoid raw video and raw audio persistence by default; document any exception and retention period.
- Restrict individual engagement analytics to authorized hosts/administrators and avoid exposing private scores to peers.
- Use neutral, probabilistic moderation and engagement language throughout the UI and notifications.

## 11. Testing Strategy

- Backend unit tests for services, validation, password/token handling, meeting state, moderation, scoring, and analytics.
- Backend integration tests for MongoDB-backed routes, authentication, invitation flows, authorization, WebSockets, and error handling.
- Frontend component and state tests for authentication, meeting controls, consent, media permission failures, connection states, chat, and host actions.
- AI tests for feature extraction, score bounds, weights, temporal smoothing, thresholds, camera-off behavior, toxicity classification, and failure paths.
- End-to-end tests for register, login, create, invite, accept, join, video/audio controls, screen sharing, chat, moderation, engagement, analytics, leave, and end meeting.
- Run lint, type checks, builds, backend tests, startup/health checks, and container validation at the phase gates.

## 12. Deployment Strategy

### Local

- Use Docker Compose for the FastAPI service and a local MongoDB service.
- Run the Vite development server separately or in a documented frontend container.
- Provide `.env.example` with non-secret placeholders for API, MongoDB, JWT, LiveKit, CORS, AI, and runtime settings.

### Production

- Deploy the frontend to Vercel or AWS static hosting and the FastAPI service to an AWS managed container platform or equivalent.
- Use MongoDB Atlas with restricted network access, least-privilege credentials, backups, and required indexes.
- Use LiveKit Cloud or a separately secured LiveKit deployment; keep API secrets backend-only.
- Terminate HTTPS at the production edge, support secure WebSockets, centralize structured logs, and add health/readiness checks.
- Validate Docker builds, Compose configuration, environment variables, security checks, smoke tests, and rollback procedures before deployment.

The exact AWS service selection remains open until expected traffic, budget, region, and operational ownership are known. This is intentionally deferred rather than introducing infrastructure prematurely.

## 13. Open Decisions Before Production

- Production hosting choice and expected scale/cost target.
- LiveKit Cloud versus self-hosted LiveKit.
- JWT refresh/revocation strategy and session lifetime.
- Notification delivery requirements beyond in-app notifications.
- Model choice, language coverage, retention periods, and human review workflow for moderation.
- Browser support and accessibility target level.
- Operational monitoring, incident response, and data deletion workflow.

## 14. Phase 0 Exit Criteria

- `AGENTS.md` has been read and used as the controlling specification.
- Repository inspection is complete: only `AGENTS.md` existed before this plan.
- Target architecture, structure, stack, phases, data model, APIs, AI, security, privacy, testing, and deployment strategy are documented.
- No application implementation or production dependency installation has been performed.
- Phase 1 is blocked pending approval of this plan.
