# AI model notes

Visual engagement is implemented as a Phase 9 local baseline. Phase 8 adds voice-transcript moderation using the same assistive toxicity architecture as chat. Voice runs on final browser-produced transcript text, never on raw video or audio.

## Phase 9 visual engagement baseline

- **Model:** dependency-free, browser-local rule-based baseline with temporal smoothing.
- **Purpose:** estimate visual engagement from measurable camera signals without claiming to know whether a participant is paying attention.
- **Input:** a downsampled frame from the consenting participant's local LiveKit camera track.
- **Features:** bounded visual proxies for face presence, face visibility, gaze alignment, and head-pose alignment derived from center-region luminance variance. These are engineering proxies, not validated face, gaze, or pose detectors.
- **Weights:** gaze `30%`, head pose `25%`, face presence `20%`, face visibility `15%`, temporal consistency `10%`.
- **Output:** score from `0` to `100` and `HIGH` (`80–100`), `MODERATE` (`50–79`), `LOW` (`0–49`), or `UNAVAILABLE` when camera data is off/unavailable.
- **Processing and retention:** frames are sampled and processed in memory only. No frame, feature, score, or new API request leaves the browser in Phase 9.
- **Limitations:** lighting, camera quality, framing, skin tone, glasses, head angle, background, motion, and device performance can materially affect this proxy. It has no production validation and must not drive high-consequence decisions.

## Phase 10 engagement alert baseline

- **Input:** latest authenticated score/status metric from eligible meeting participants; raw frames are not used.
- **Eligibility:** recent metrics inside the configured stale window with status other than `UNAVAILABLE`.
- **Rule:** calculate `low participants / eligible participants`; trigger only when the rate is strictly greater than `0.50` for at least 30 seconds.
- **Cooldown:** five minutes after an alert trigger by default; values are environment-configurable.
- **Output:** host-only neutral alert with aggregate counts/rate. No individual scores are exposed by this endpoint.
- **Limitations:** stale metrics, browser processing errors, camera conditions, and the unvalidated Phase 9 proxy can affect the estimate. The alert is assistive and must not be treated as proof of attention or used for automatic punishment.

## Phase 12 scoring configuration

- **Weights:** gaze `0.30`, head pose `0.25`, face presence `0.20`, face visibility `0.15`, temporal consistency `0.10`. The centralized configuration validates that every weight is finite, between `0` and `1`, and that the sum is `1`.
- **Thresholds:** `HIGH` at `80` or above, `MODERATE` at `50` through `79`, and `LOW` below `50`; thresholds are centralized and validated.
- **Temporal consistency:** derived from the mean normalized change across recent valid scores, not an artificial delay. Unavailable observations never enter the history.
- **Invalid-input behavior:** non-finite, out-of-range, or no-usable-face-signal features return `UNAVAILABLE` with score `0` and do not submit a low metric.
- **Limitations:** the scoring result remains an unvalidated visual estimate and is not proof of attention or a basis for automatic punishment.

## Phase 8 voice moderation baseline

- **Processing:** browser speech recognition is opt-in and one-shot; the backend receives final transcript text only after authenticated meeting membership and explicit `consent_given` validation.
- **Model:** the configurable toxicity classifier with a conservative lexical fallback; voice warning and block thresholds are independently configurable.
- **Purpose:** identify potentially abusive speech for host review.
- **Output:** score from 0 to 1 and `SAFE`, `WARNING`, or `BLOCK`, with `allowed`, `flagged`, or `blocked` action metadata.
- **Retention:** raw audio is never accepted by the API. Transcript content is not stored or logged; only minimum moderation metadata is retained in `moderation_events`.
- **Failure behavior:** unsupported browser speech recognition reports an unavailable state; model failures use the lexical fallback and are logged without user content; unavailable moderation configuration returns `503`.
- **Limitations:** browser/provider speech recognition can misrecognize accents, languages, names, and context. Toxicity results are probabilistic and must not be treated as proof or used for automatic punishment. Browser providers may process audio under their own privacy policies.

## Phase 7 chat moderation baseline

- **Model:** scikit-learn TF-IDF word/bi-gram features with balanced logistic regression, augmented by a conservative lexical safety signal.
- **Purpose:** identify potentially abusive chat content for host review.
- **Input:** normalized chat text.
- **Output:** score from 0 to 1 and `SAFE`, `WARNING`, or `BLOCK`.
- **Thresholds:** warning defaults to `0.5`; block defaults to `0.8`; both are environment-configurable.
- **Behavior:** ML inference is attempted by default. The lexical signal preserves a block decision for multiple explicit baseline terms. Blocked messages are not stored or broadcast, but the moderation event is retained.
- **Evaluation:** stratified 75/25 holdout over 31 hand-labeled development examples reports precision `0.667`, recall `1.000`, and F1 `0.800` on 8 holdout samples. These numbers are engineering smoke-test metrics, not production evidence.
- **Dataset:** curated in-repository development phrases, 15 potentially abusive and 16 normal examples; no external dataset or license is claimed.
- **Limitations:** this corpus is too small and narrow for deployment. The model can miss context, sarcasm, spelling variation, reclaimed language, multilingual content, and new phrasing, and can create false positives. It is not a claim that a user is abusive.
- **Next evaluation:** replace this seed corpus with a properly licensed, representative dataset and human-reviewed evaluation set before production use. Report confusion matrix, precision, recall, F1, and subgroup/language limitations.
