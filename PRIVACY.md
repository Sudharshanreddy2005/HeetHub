# Privacy

The implemented meeting room requests camera, microphone, and screen-sharing access only after the participant presses the corresponding control. LiveKit transports media directly; the backend does not receive, record, or store raw video or audio.

Phase 7 processes submitted chat text for moderation and stores the accepted message's moderation decision plus a moderation event. Blocked text is not persisted as a chat message. The classifier is an assistive signal and host-facing warning, not an automated finding or punishment.

Host microphone controls use LiveKit room administration to mute an active audio track; they do not capture, replay, export, or store it. Voice moderation is optional and disabled until the participant explicitly opts in. The browser performs one-shot speech recognition and submits only final transcript text with `consent_given: true`; the backend requires that consent, verifies meeting membership, rate-limits requests, and stores only decision/score/action metadata for host review. Raw audio and transcript content are not accepted for persistence. Browser speech providers may process microphone audio under their own policies, which is disclosed before opt-in. Participants can stop or disable the flow at any time.

Phase 9 visual engagement estimation is optional and disabled until the participant explicitly opts in. It analyzes a downsampled copy of the participant's own LiveKit camera track locally in the browser. The current dependency-free baseline uses bounded visual proxies for face presence/visibility, gaze, and head orientation, with temporal smoothing. No camera frames, extracted features, or scores are uploaded or stored. When the camera is off or unavailable, the result is `UNAVAILABLE`, never low engagement. The estimate is not proof of attention and is not used for automatic punishment. Participants can disable estimation at any time.

Phase 10 sends only the consenting participant's current score/status metric to the backend so the host can receive an aggregate alert. Raw frames never leave the browser. `UNAVAILABLE` camera states are excluded from eligible-participant calculations rather than treated as low engagement. Only the host can read the aggregate alert, which contains counts and rate, not peer-visible individual scores. Alerts use neutral probabilistic language and do not trigger automatic punishment.

Phase 11 exposes derived analytics only to the meeting host. The report contains attendance timestamps, duration, aggregate engagement counts/extrema from the latest retained metrics, and moderation outcome counts. It contains no raw camera frames, audio, transcripts, or peer-visible individual engagement scores. Engagement values remain estimates and are not proof of attention.

Phase 12 changes only the local score calculation: validated weights and thresholds are applied to Phase 9's in-memory visual proxies and recent valid observations. Camera frames remain local, and invalid or unavailable camera data produces `UNAVAILABLE` rather than a low score. Phase 10 continues to receive only the permitted score/status metric.

Later engagement work must obtain explicit consent before AI monitoring, prefer local processing, send metrics rather than raw video, and treat camera-off as unavailable rather than as low engagement.

Personal settings are persisted in the browser under `meethub.preferences`. Camera and microphone entry defaults remain off/on-safe (`camera_on_entry: false`, `mute_on_entry: true`). Visual engagement and voice moderation consent are separate preferences and remain opt-in. Device labels may be unavailable until the browser grants media permission.

The current backend has no settings contract for waiting rooms, join-before-host, persistent participant permissions, noise suppression, or HD quality overrides. Those controls are shown as unsupported rather than persisted as ineffective switches. Speaker selection is used only when the browser exposes `HTMLMediaElement.setSinkId()`.
