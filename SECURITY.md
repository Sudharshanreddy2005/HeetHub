# Security

Phase 1 keeps secrets in environment configuration and provides only an unauthenticated liveness endpoint. No credentials are hardcoded, and no authentication or authorization behavior is claimed until Phase 2.

Phase 5 enforces private meeting authorization on the backend. Meeting lists and details are restricted to the host or participants with an accepted invitation; pending, declined, removed, and blocked participants cannot access meeting metadata or obtain LiveKit tokens. Join, leave, and end operations derive identity from the verified JWT, and only the host can end a meeting.

Meeting response join credentials and invited email addresses are returned only to the authenticated host. Accepted participants receive meeting metadata and participant usernames/statuses without the host's reusable guest-invitation URL, meeting password/code, or other invitee email addresses. Host end marks the meeting ended before disconnecting active remote participants and closing attendance records.

Before production, authenticated WebSockets, additional role controls, production secret management, distributed rate limiting, and broader security testing remain required. LiveKit tokens are short-lived and issued only after the meeting checks succeed.

Phase 6 chat access reuses the same backend meeting authorization. Message writes use the authenticated user identity, validate length, rate-limit per meeting/user, persist before broadcast, and never accept client-supplied sender names or meeting membership.

Phase 7 moderation events and host actions are backend-authorized. Only the host can review events or change participant controls. AI output assists moderation and does not automatically impose a permanent ban.

Chat sender identity and moderation targets are derived from validated server state, never a client role or username. A removed or blocked participant loses chat, meeting-detail, and new-token access. When LiveKit is configured, the backend also requests a room-side disconnect for active removed/blocked participants. Existing LiveKit tokens remain subject to the provider's token-revocation support and their short configured TTL; production deployment should use LiveKit Cloud token revocation or the equivalent self-hosted policy.

Phase 8 voice moderation requires explicit consent in the request in addition to the UI opt-in, and accepts final transcript text only. The endpoint reuses meeting authorization, rejects raw-audio/unknown payload fields, validates configured limits, rate-limits by meeting and authenticated user, and stores no transcript content. The current rate limiter is process-local and must be replaced or coordinated across instances before production.

Phase 10 engagement metrics reuse authenticated meeting membership. The backend derives the submitting user from the JWT, accepts only bounded score/status values, records server time, and allows only the host to read aggregate alert state. The current alert state and metric submission controls are process-local; production multi-instance deployments require shared state and coordinated rate controls.

Phase 11 analytics is protected by the same meeting authorization and an explicit host-role check. It returns derived aggregates and attendance metadata only; participants cannot read the report or individual engagement scores. Analytics are generated from server-owned records, never client-supplied identity or timestamps.

Phase 12 validates scoring configuration before use and rejects invalid weight or threshold configurations. Non-finite or out-of-range visual inputs are treated as unavailable, preventing malformed client-side values from becoming a low-engagement metric. No authorization or LiveKit token behavior is changed.
