# Architecture

Phase 1 establishes a modular monolith boundary:

- `frontend/` contains the React application and browser-facing presentation.
- `backend/app/` contains FastAPI application setup, configuration, and database lifecycle code.
- `ai/` is reserved for later local engagement and moderation modules; no AI behavior is implemented in Phase 1.

The API remains independently startable when MongoDB is unavailable. MongoDB connection failures are logged and exposed through the database connection state, while the basic `/health` endpoint stays available for startup checks.

Phase 4 adds LiveKit as the media transport. FastAPI verifies the JWT, meeting membership, accepted invitation, and meeting state before issuing a short-lived room token. The browser connects with that server-issued token; it never creates authorization tokens itself.

Phase 6 uses the existing LiveKit room for real-time chat delivery. The backend remains authoritative: it validates membership and content, applies the rate limit, stores the message in MongoDB, and then broadcasts the accepted message on the `meeting-chat` data topic. The browser loads history from the backend and uses LiveKit data events for updates.

Phase 7 inserts a backend moderation step before chat persistence. TF-IDF/logistic-regression inference is combined with a conservative lexical fallback to return `SAFE`, `WARNING`, or `BLOCK`. `SAFE` and `WARNING` messages are persisted before delivery; `BLOCK` produces only a moderation event. Host controls are authorized on the backend and persisted with the participant record. When LiveKit is configured, the backend calls its room-administration API to mute active microphone tracks and disconnect removed or blocked participants. A temporary mute also removes microphone publishing from a newly issued room token. No raw media passes through this path.

Phase 8 adds an optional browser speech-recognition flow. After explicit participant consent, the browser submits only a final transcript to an authenticated meeting endpoint. The backend verifies membership, validates consent and transcript size, applies an in-memory per-user rate limit, classifies the temporary text using the moderation service, and stores only decision metadata. LiveKit remains the media transport and raw audio never enters the application API.

Phase 9 adds a consent-gated local estimator to the meeting room. It attaches only the local camera track, downsamples frames in memory, derives bounded visual proxy features, applies the documented rule-based weights and temporal smoothing, and renders the estimate locally. Camera-off returns `UNAVAILABLE`; frames, features, and scores are not sent to the backend or persisted. This phase does not add a backend API.

Phase 10 adds two authenticated meeting endpoints. Participants submit only their local estimate score/status to `/meetings/{meeting_id}/engagement`; the backend upserts the latest metric in `focus_events` and never receives camera frames. The host polls `/meetings/{meeting_id}/engagement-alert`; the backend ignores stale or `UNAVAILABLE` metrics, calculates the low-engagement rate among eligible metrics, and applies the configured threshold, minimum duration, and cooldown before returning a neutral alert.

Phase 11 derives a host-only report at `/meetings/{meeting_id}/analytics`. It combines server-recorded participant join/leave fields, latest score/status metrics, and moderation event metadata into duration, attendance, engagement distribution/extrema, and moderation outcome aggregates. No raw media, transcript, or individual peer-visible scores are added.

Phase 12 centralizes the local scoring weights and interpretation thresholds in the frontend engagement scoring module. The scorer validates the weights sum to one, clamps finite component inputs to the documented range, derives temporal consistency from recent valid observations, and returns `UNAVAILABLE` for invalid or unusable visual signals. Phase 9 remains local and Phase 10 receives only score/status metrics.
