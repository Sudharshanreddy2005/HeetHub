# AGENTS.md

# AI Secure Meeting Platform

## 1. PURPOSE OF THIS FILE

This file contains the mandatory instructions, architecture, product requirements, security rules, privacy requirements, AI requirements, coding standards, and development workflow for AI coding agents working on this repository.

This file is the primary project specification.

Before making any code changes, the coding agent MUST:

1. Read this file.

2. Inspect the existing repository structure.

3. Understand what has already been implemented.

4. Reuse existing functionality where possible.

5. Follow the architecture and technology decisions in this file.

6. Follow all security and privacy requirements.

7. Test changes before considering a task complete.

8. Update documentation when important architecture or behavior changes.

Do not rebuild existing functionality without a clear reason.

Do not make major architectural changes without explaining why they are necessary.

---

# 2. PROJECT NAME

AI Secure Meeting

## Product Description

AI Secure Meeting is a privacy aware, AI powered video conferencing platform.

It combines:

* Real time video conferencing

* Private user based meeting access

* AI based visual engagement estimation

* Abusive language detection

* Chat moderation

* Voice moderation

* Host controls

* Meeting analytics

* Notifications

* Privacy controls

The project is NOT intended to be a simple Zoom clone.

The main purpose is to add an intelligent AI and security layer to online meetings.

---

# 3. CORE PROBLEMS

The platform addresses three major real world problems.

## Problem 1: Low meeting engagement

In large online meetings, hosts cannot easily determine whether participants are showing visual engagement.

The system estimates visual engagement using measurable signals such as:

* Face presence

* Eye gaze

* Head pose

* Face orientation

* Face visibility

* Temporal consistency

The system MUST NOT claim that it knows whether a participant is actually paying attention.

Use:

"Visual Engagement Estimation"

instead of:

"Perfect Focus Detection"

---

## Problem 2: Unauthorized meeting access

Traditional meetings often depend on links that can be forwarded.

This application should primarily use authenticated users and participant invitations.

Meeting flow:

```text

User Registration

        ↓

Unique Username

        ↓

Host Creates Meeting

        ↓

Host Selects Participants

        ↓

Invitation

        ↓

Participant Accepts

        ↓

Authorization Check

        ↓

Join Meeting

```

Users who are not authorized must not be able to join private meetings.

---

## Problem 3: Abusive communication

Participants may use abusive or toxic language through:

* Chat

* Microphone

The system should detect potentially abusive content and assist the host with moderation.

AI moderation is an assistant.

The host or authorized administrator should remain in control.

---

# 4. CORE PRODUCT PRINCIPLES

Always prioritize:

```text

1. Security

2. Privacy

3. Reliability

4. Accuracy

5. User Experience

6. Additional Features

```

Never sacrifice security or privacy just to make a feature work quickly.

---

# 5. TECHNOLOGY STACK

## Frontend

Use:

* React

* Vite

* TypeScript preferred

* Tailwind CSS

* LiveKit client SDK

* WebSocket where required

## Backend

Use:

* Python

* FastAPI

* Pydantic

* JWT authentication

* WebSocket

## Database

Use:

* MongoDB

* MongoDB Atlas for production

Do not introduce SQL unless there is a strong technical requirement.

## AI

Use only what is necessary.

Preferred technologies:

* Python

* OpenCV

* MediaPipe

* scikit-learn

* PyTorch

* Hugging Face Transformers

* Whisper or equivalent speech recognition

## Infrastructure

Use:

* Docker

* Docker Compose for local development

* AWS for deployment

* MongoDB Atlas

* LiveKit Cloud or self hosted LiveKit

---

# 6. ARCHITECTURE

The target architecture is:

```text

                         React Frontend

                              |

              +---------------+---------------+

              |               |               |

              v               v               v

           LiveKit         REST API       WebSocket

              |               |               |

              v               v               v

           WebRTC          FastAPI        Real Time

                                             Events

                              |

               +--------------+--------------+

               |              |              |

               v              v              v

            MongoDB       AI Services      Auth

                              |

                    +---------+---------+

                    |                   |

                    v                   v

              Engagement AI       Moderation AI

                    |                   |

              +-----+-----+       +-----+-----+

              |     |     |       |           |

             Face  Gaze  Pose    Chat        Voice

```

---

# 7. ARCHITECTURAL RULES

The application must follow separation of concerns.

Frontend:

```text

UI

State

API calls

WebRTC/LiveKit

Client side AI

```

Backend:

```text

Authentication

Authorization

Business logic

Meeting management

Database

Notifications

Moderation

Analytics

```

AI:

```text

Preprocessing

Feature extraction

Model inference

Scoring

Evaluation

```

Do not mix all functionality into one file or one service.

---

# 8. REPOSITORY STRUCTURE

Preferred structure:

```text

/

├── AGENTS.md

├── README.md

├── ARCHITECTURE.md

├── API.md

├── PRIVACY.md

├── SECURITY.md

├── AI_MODEL.md

├── .env.example

├── .gitignore

│

├── frontend/

│   ├── src/

│   ├── public/

│   ├── package.json

│   └── AGENTS.md

│

├── backend/

│   ├── app/

│   │   ├── auth/

│   │   ├── users/

│   │   ├── meetings/

│   │   ├── participants/

│   │   ├── notifications/

│   │   ├── chat/

│   │   ├── moderation/

│   │   ├── analytics/

│   │   └── core/

│   ├── tests/

│   ├── requirements.txt

│   └── AGENTS.md

│

├── ai/

│   ├── engagement/

│   │   ├── face_detection/

│   │   ├── gaze_detection/

│   │   ├── head_pose/

│   │   └── scoring/

│   │

│   ├── moderation/

│   │   ├── toxicity/

│   │   └── speech_to_text/

│   │

│   ├── tests/

│   └── AGENTS.md

│

├── docker/

└── docker-compose.yml

```

The exact structure may evolve, but separation between frontend, backend, and AI must remain.

---

# 9. DEVELOPMENT PHASES

Do not attempt to build every feature at once.

Follow this order.

## Phase 1: Project Setup

Implement:

* React

* Vite

* Tailwind

* FastAPI

* MongoDB

* Docker

* Environment configuration

* Basic health checks

---

## Phase 2: Authentication

Implement:

* Registration

* Login

* Logout

* Password hashing

* JWT

* User profile

* Username

* Authentication middleware

---

## Phase 3: User System

Implement:

* User search

* Username lookup

* Profile

* User status

* Roles

---

## Phase 4: Meeting Management

Implement:

* Create meeting

* Schedule meeting

* Edit meeting

* Cancel meeting

* Meeting history

* Meeting status

Meeting states:

```text

SCHEDULED

LIVE

ENDED

CANCELLED

```

---

## Phase 5: Invitations

Implement:

* Select participants

* Send invitations

* Accept invitation

* Decline invitation

* Invitation status

* Notifications

Invitation states:

```text

PENDING

ACCEPTED

DECLINED

REMOVED

BLOCKED

```

---

## Phase 6: Video Conferencing

Use LiveKit/WebRTC.

Implement:

* Camera

* Microphone

* Mute

* Camera toggle

* Participant grid

* Screen sharing

* Connection status

* Leave meeting

* Host controls

Do not implement a custom video streaming protocol.

---

## Phase 7: Private Meeting Security

Implement:

* Authenticated meeting access

* Participant validation

* Host authorization

* Role checks

* Blocked participant checks

* Meeting state validation

* Secure WebSocket authentication

Never trust frontend authorization.

---

## Phase 8: Real Time Chat

Implement:

* Meeting chat

* WebSocket communication

* System messages

* Host announcements

* Message history

---

## Phase 9: Chat Moderation

Implement:

```text

Message

   ↓

Toxicity Model

   ↓

Toxicity Score

   ↓

Moderation Decision

```

Possible results:

```text

SAFE

WARNING

BLOCK

```

Keep thresholds configurable.

---

## Phase 10: Voice Moderation

Implement:

```text

Microphone

   ↓

Speech to Text

   ↓

Transcript

   ↓

Toxicity Detection

   ↓

Moderation

```

Prefer temporary processing.

Do not permanently store raw audio by default.

---

## Phase 11: Engagement Detection

Start with a baseline system.

Use:

* MediaPipe

* OpenCV

* Face landmarks

* Head pose

* Gaze estimation

Do not immediately train a complicated deep learning model.

First create a working rule based baseline.

---

## Phase 12: Engagement Scoring

Calculate:

```text

Engagement Score =

    Gaze Score

    +

    Head Pose Score

    +

    Face Presence Score

    +

    Face Visibility Score

    +

    Temporal Consistency

```

Initial example weighting:

```text

Gaze: 30%

Head Pose: 25%

Face Presence: 20%

Face Visibility: 15%

Temporal Consistency: 10%

```

Weights MUST be configurable.

Score range:

```text

0 to 100

```

Suggested interpretation:

```text

80 to 100 = High

50 to 79  = Moderate

0 to 49   = Low

```

These are initial thresholds, not scientific truth.

---

# 10. PRIVACY RULES

Privacy is a mandatory requirement.

## MUST

The system must:

* Inform users about AI monitoring.

* Obtain consent before AI visual engagement analysis.

* Allow users to disable AI monitoring.

* Prefer local processing.

* Minimize transmitted data.

* Avoid storing raw video.

* Avoid storing raw audio unless explicitly required.

* Clearly document data collection.

* Restrict analytics to authorized users.

## MUST NOT

The system must never:

* Secretly activate cameras.

* Secretly activate microphones.

* Secretly monitor users.

* Store raw video for engagement analysis by default.

* Upload unnecessary camera frames.

* Share private engagement scores with other participants.

* Use engagement scores for automatic punishment.

* Claim that AI knows whether someone is actually paying attention.

---

# 11. LOCAL ENGAGEMENT PROCESSING

Preferred design:

```text

Participant Camera

        ↓

Browser

        ↓

Local AI

        ↓

Face / Gaze / Head Pose

        ↓

Engagement Score

        ↓

Backend

```

The backend should receive metrics rather than raw video.

Example:

```json

{

  "meeting_id": "MEETING_001",

  "user_id": "USER_001",

  "engagement_score": 78,

  "status": "moderate",

  "timestamp": "..."

}

```

Do not send raw video unless a separately documented feature requires it.

---

# 12. AI MONITORING CONSENT

When AI monitoring is enabled for a meeting, the user should see a clear explanation.

Example:

```text

AI Meeting Monitoring

This meeting uses AI to estimate visual engagement using

signals such as face orientation and gaze.

Raw video is not stored for engagement analysis.

You can continue without AI monitoring.

[Allow AI Monitoring]

[Continue Without AI Monitoring]

```

The user must have control over the choice.

---

# 13. CAMERA OFF RULE

If camera is OFF:

```text

Visual Engagement = UNAVAILABLE

```

Do not classify the participant as distracted.

Do not assume:

```text

Camera OFF = Not Paying Attention

```

That assumption is invalid.

---

# 14. ENGAGEMENT ALERT

Calculate:

```text

Low Engagement Rate =

Low Engagement Participants /

Eligible Participants

```

Default threshold:

```text

50%

```

Condition:

```text

if low_engagement_rate > 0.50:

    trigger_host_alert()

```

Do not alert immediately after a single low reading.

Use:

```text

Minimum duration

+

Smoothing

+

Cooldown

```

Example:

```text

Low engagement > 50%

for 30 seconds

        ↓

Alert host

        ↓

5 minute cooldown

```

---

# 15. ENGAGEMENT ALERT LANGUAGE

Use neutral language.

Good:

```text

Meeting Engagement Alert

More than 50% of eligible participants currently

show low visual engagement.

Current engagement: 46%.

Consider changing the meeting format or pace.

```

Bad:

```text

Everyone is ignoring you.

```

The AI provides an estimate, not a fact.

---

# 16. TOXICITY MODERATION

AI moderation is probabilistic.

Never automatically assume an AI prediction is correct.

Use:

```text

Potentially abusive content detected

```

instead of:

```text

User definitely used abusive language

```

The host should have the final decision for meeting level moderation.

---

# 17. MODERATION POLICY

Initial policy:

```text

Violation 1

    ↓

Warning

Violation 2

    ↓

Block message + warning

Violation 3

    ↓

Temporary mute

Violation 4

    ↓

Remove participant

```

The thresholds must be configurable.

Do not permanently ban a user automatically based only on AI output.

---

# 18. MODERATION DASHBOARD

Host should see:

```text

Participant

Violation count

Violation type

Severity

Latest event

Current action

```

Host actions:

* Warn

* Mute

* Unmute

* Disable chat

* Remove

* Block

---

# 19. DATABASE

Use MongoDB.

Required collections:

```text

users

meetings

meeting_participants

notifications

messages

moderation_events

focus_events

meeting_analytics

```

---

# 20. USER DOCUMENT

Example:

```json

{

  "_id": "USER_001",

  "username": "sudharshan",

  "email": "user@example.com",

  "password_hash": "...",

  "role": "participant",

  "created_at": "...",

  "updated_at": "..."

}

```

Never store plaintext passwords.

---

# 21. MEETING DOCUMENT

Example:

```json

{

  "_id": "MEETING_001",

  "title": "AI Project Discussion",

  "host_id": "USER_001",

  "scheduled_at": "...",

  "status": "scheduled",

  "created_at": "..."

}

```

---

# 22. PARTICIPANT DOCUMENT

Example:

```json

{

  "meeting_id": "MEETING_001",

  "user_id": "USER_002",

  "role": "participant",

  "invitation_status": "accepted",

  "joined_at": "...",

  "left_at": "..."

}

```

---

# 23. FOCUS DOCUMENT

Example:

```json

{

  "meeting_id": "MEETING_001",

  "user_id": "USER_002",

  "engagement_score": 78,

  "status": "moderate",

  "timestamp": "..."

}

```

Do not store raw camera frames.

---

# 24. MODERATION DOCUMENT

Example:

```json

{

  "meeting_id": "MEETING_001",

  "user_id": "USER_002",

  "type": "toxic_message",

  "severity": "high",

  "score": 0.91,

  "action": "blocked",

  "timestamp": "..."

}

```

---

# 25. API RULES

Use a consistent API structure.

Recommended:

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

Example:

```text

POST /api/auth/register

POST /api/auth/login

GET /api/users/search

POST /api/meetings

GET /api/meetings

GET /api/meetings/{id}

PUT /api/meetings/{id}

DELETE /api/meetings/{id}

POST /api/meetings/{id}/invite

POST /api/meetings/{id}/join

POST /api/meetings/{id}/leave

GET /api/meetings/{id}/analytics

POST /api/moderation/message

```

The exact endpoints may evolve.

Keep them consistent.

---

# 26. WEBSOCKET RULES

Use WebSocket for:

* Meeting events

* Chat

* Notifications

* Real time moderation events

Example:

```text

/ws/meetings/{meeting_id}

/ws/chat/{meeting_id}

/ws/notifications

```

Every private WebSocket connection must be authenticated.

Every meeting WebSocket connection must verify meeting membership.

---

# 27. SECURITY RULES

Implement:

* Password hashing

* JWT authentication

* Authorization middleware

* Role based permissions

* Meeting membership validation

* WebSocket authentication

* Input validation

* Rate limiting

* CORS configuration

* Secure environment variables

* Database access control

* Error handling

Never trust:

```text

Frontend role

Frontend user ID

Frontend permissions

Frontend meeting membership

```

The backend must determine permissions.

---

# 28. SECRETS

Never hardcode:

```text

JWT_SECRET

MongoDB URI

LiveKit API keys

LiveKit secrets

AWS credentials

AI API keys

```

Use:

```text

.env

```

Provide:

```text

.env.example

```

Never commit the real `.env`.

---

# 29. FRONTEND PAGES

Minimum pages:

```text

Landing

Login

Register

Dashboard

Profile

User Search

Create Meeting

Meeting Invitations

Upcoming Meetings

Meeting Room

Meeting History

Meeting Analytics

Notifications

Moderation Dashboard

Settings

```

---

# 30. MEETING ROOM

Meeting room should support:

```text

Video

Audio

Mute

Camera toggle

Screen share

Participants

Chat

Host controls

Leave meeting

Connection status

```

Host should have additional controls.

---

# 31. UI RULES

Use:

* React

* Tailwind

* Responsive layout

* Consistent spacing

* Accessible controls

* Clear states

* Loading indicators

* Error states

* Empty states

Do not copy Zoom's exact interface.

Create an original design.

Avoid unnecessary animations.

---

# 32. ERROR HANDLING

Handle:

```text

Camera permission denied

Microphone permission denied

Network failure

WebRTC failure

AI failure

Speech recognition failure

Database failure

Unauthorized access

Meeting expired

Invitation expired

Blocked user

```

Never show stack traces to end users.

Use clear messages.

---

# 33. TESTING

Every important feature must be tested.

Backend tests:

```text

Authentication

Authorization

Meetings

Invitations

Participants

Moderation

Analytics

```

Frontend tests:

```text

Components

Meeting state

Permission handling

Error handling

```

AI tests:

```text

Feature extraction

Engagement scoring

Thresholds

Toxicity classification

```

Integration tests:

```text

Register

Login

Create meeting

Invite participant

Accept invitation

Join meeting

Send chat

Moderate message

Leave meeting

End meeting

Generate analytics

```

---

# 34. AI MODEL RULES

Do not add AI models just to make the project look advanced.

Every model must have a purpose.

Document:

```text

Model

Purpose

Input

Output

Dataset

Training

Evaluation

Limitations

Thresholds

False positives

False negatives

```

---

# 35. DATASET RULES

For public datasets:

Document:

```text

Dataset name

Source

License

Number of samples

Labels

Features

Limitations

```

Check the license before using a dataset.

Do not download random datasets without understanding their license and purpose.

---

# 36. ENGAGEMENT MODEL DEVELOPMENT

Start simple.

First build:

```text

MediaPipe

+

OpenCV

+

Rule based scoring

```

Then evaluate.

Only after establishing a baseline should you consider:

```text

Logistic Regression

Random Forest

XGBoost

Neural Network

```

Use the simplest model that performs adequately.

---

# 37. MODEL EVALUATION

For classification:

```text

Accuracy

Precision

Recall

F1

Confusion Matrix

```

For continuous prediction:

```text

MAE

RMSE

Correlation

```

Do not report only accuracy.

---

# 38. AI LIMITATIONS

The engagement system can be affected by:

* Lighting

* Camera quality

* Camera position

* Glasses

* Face angle

* Device performance

* Network quality

* Different environments

* Different physical conditions

The AI output must be treated as an estimate.

Do not make high consequence decisions based solely on engagement scores.

---

# 39. ACCESSIBILITY

Support:

* Keyboard navigation

* Accessible labels

* Screen readers

* Good contrast

* Captions where possible

* Clear camera status

* Clear microphone status

* Accessible errors

---

# 40. LOGGING

Use structured logs.

Useful events:

```text

User login

Meeting created

Participant invited

Participant joined

Participant left

Moderation event

Meeting ended

AI error

WebRTC error

```

Never log:

```text

Passwords

JWT secrets

API keys

Raw private video

Raw private audio

```

---

# 41. CODE QUALITY

MUST:

* Use meaningful names.

* Keep functions focused.

* Separate concerns.

* Reuse components.

* Validate inputs.

* Handle errors.

* Keep configuration centralized.

* Keep AI code modular.

* Write tests.

* Update documentation.

MUST NOT:

* Put everything in one file.

* Duplicate logic unnecessarily.

* Hardcode secrets.

* Bypass authorization.

* Disable security checks to make tests pass.

* Create unnecessary abstractions.

* Add dependencies without justification.

---

# 42. DEPENDENCY RULES

Before installing a dependency:

1. Check whether the project already has a suitable package.

2. Prefer stable and maintained packages.

3. Avoid unnecessary dependencies.

4. Consider package size and security.

5. Document important new dependencies.

Do not add a large framework for a small feature.

---

# 43. GIT RULES

Use meaningful commit messages.

Examples:

```text

feat: add user authentication

feat: add private meeting invitations

feat: integrate LiveKit

feat: add chat moderation

feat: add engagement scoring

fix: handle camera permission error

fix: validate meeting membership

refactor: separate meeting service

```

Never commit:

```text

.env

secrets

credentials

private certificates

```

---

# 44. DOCUMENTATION

Maintain:

```text

README.md

ARCHITECTURE.md

API.md

AI_MODEL.md

PRIVACY.md

SECURITY.md

```

Update documentation when important behavior changes.

---

# 45. FEATURE DEVELOPMENT WORKFLOW

When asked to implement a feature:

## Step 1

Read AGENTS.md.

## Step 2

Inspect the existing code.

## Step 3

Identify affected files.

## Step 4

Understand existing architecture.

## Step 5

Check whether the functionality already exists.

## Step 6

Create a small implementation plan.

## Step 7

Implement incrementally.

## Step 8

Run relevant tests.

## Step 9

Fix errors.

## Step 10

Review security.

## Step 11

Review privacy.

## Step 12

Update documentation if necessary.

## Step 13

Summarize what changed.

Do not blindly modify unrelated files.

---

# 46. BUG FIX WORKFLOW

When fixing a bug:

```text

1. Reproduce

2. Identify root cause

3. Implement minimal correct fix

4. Test

5. Check regression

6. Document if necessary

```

Do not hide errors.

Do not solve bugs by disabling validation.

---

# 47. ARCHITECTURE CHANGE RULE

If a requested feature requires changing a major architectural decision:

First determine whether the existing architecture can support it.

If not, explain:

```text

Current architecture

Problem

Proposed architecture

Reason

Tradeoffs

```

Then make the change only when justified.

---

# 48. DO NOT OVERENGINEER

The goal is a working product.

Do not build:

* Microservices unnecessarily

* Complex event buses unnecessarily

* Multiple databases unnecessarily

* Custom video protocols

* Complex AI pipelines before a baseline exists

Prefer a modular monolith initially.

Separate services only when there is a real reason.

---

# 49. MVP REQUIREMENTS

The first working MVP must contain:

```text

✓ Registration

✓ Login

✓ Username

✓ Create meeting

✓ Select participants

✓ Meeting invitation

✓ Accept invitation

✓ Private meeting access

✓ Video

✓ Audio

✓ Screen sharing

✓ Chat

✓ Host controls

```

Do not start with advanced AI.

First make the meeting system reliable.

---

# 50. AI MVP REQUIREMENTS

After the meeting platform works:

```text

✓ Face detection

✓ Head pose

✓ Basic gaze estimation

✓ Engagement score

✓ Meeting engagement calculation

✓ Host alert

✓ Chat toxicity detection

✓ Basic moderation

```

Then implement:

```text

Voice toxicity detection

Advanced analytics

ML based engagement model

```

---

# 51. HOST DASHBOARD

The host should eventually see:

```text

Meeting

Participants

Live Engagement

Moderation

Chat

Analytics

Controls

```

Example:

```text

AI Project Discussion

Participants: 42

Engagement: 72%

High: 25

Moderate: 10

Low: 7

Moderation Events: 2

[Analytics]

[Moderation]

[End Meeting]

```

---

# 52. POST MEETING ANALYTICS

Show:

```text

Meeting Duration

Total Participants

Average Engagement

High Engagement %

Moderate Engagement %

Low Engagement %

Peak Engagement

Lowest Engagement

Moderation Events

Blocked Messages

Warnings

Muted Users

Removed Users

```

---

# 53. FUTURE FEATURES

Possible future features:

```text

AI meeting summary

Automatic action items

Automatic captions

Multilingual translation

Speaker identification

Smart polls

Question detection

Sentiment analysis

Meeting quality score

Noise detection

Noise suppression

Attendance analytics

Calendar integration

LMS integration

Mobile application

Enterprise administration

```

Do not implement these until the core platform is stable.

---

# 54. PROJECT SUCCESS CRITERIA

The project succeeds when:

## Video

Participants can communicate reliably using audio and video.

## Security

Only authorized users can enter private meetings.

## Engagement

The system estimates visual engagement using local AI.

## Alert

The host receives an alert when low engagement exceeds the configured threshold.

## Moderation

Potentially abusive chat messages can be detected and moderated.

## Voice

Potentially abusive speech can be detected through speech to text and toxicity analysis.

## Analytics

The host can view meeting engagement and moderation analytics.

## Privacy

Raw video is not stored for engagement analysis by default.

## User Control

Users can control:

```text

Camera

Microphone

AI Monitoring

```

---

# 55. DEFINITION OF DONE

A feature is complete only when:

```text

✓ Code implemented

✓ Frontend completed

✓ Backend completed where required

✓ API validated

✓ Authorization implemented

✓ Error handling implemented

✓ Loading states implemented

✓ Tests added

✓ Security reviewed

✓ Privacy reviewed

✓ Documentation updated where necessary

```

Do not say a feature is complete if it has not been tested.

---

# 56. CODING AGENT BEHAVIOR

The coding agent MUST:

1. Read AGENTS.md before development.

2. Inspect the repository before changing code.

3. Follow existing conventions.

4. Reuse existing components and services.

5. Keep changes focused.

6. Test implementations.

7. Check security.

8. Check privacy.

9. Avoid unnecessary dependencies.

10. Explain important decisions.

11. Keep configuration centralized.

12. Keep AI models modular.

13. Keep thresholds configurable.

14. Never expose secrets.

15. Never bypass authentication.

16. Never bypass authorization.

17. Never secretly access camera or microphone.

18. Never store raw video for AI analysis by default.

19. Never treat AI predictions as absolute truth.

20. Never make unrelated changes.

---

# 57. RESPONSE FORMAT FOR CODING AGENT

When completing a development task, provide a concise summary:

```text

Implemented:

- Feature 1

- Feature 2

- Feature 3

Files changed:

- file/path

- file/path

Testing:

- Test command

- Result

Notes:

- Important architectural decision

- Any limitation

```

Do not provide unnecessary explanations.

---

# 58. WHEN REQUIREMENTS ARE AMBIGUOUS

If the requirement is genuinely ambiguous:

1. Inspect the existing project.

2. Check whether the answer can be inferred from this file.

3. Prefer the least destructive implementation.

4. Ask for clarification only when necessary.

Do not stop development for minor ambiguities that can be safely resolved from existing architecture.

---

# 59. FINAL PRODUCT VISION

The final application should provide:

```text

Private Meetings

        +

Real Time Video

        +

Secure User Access

        +

AI Visual Engagement Estimation

        +

Toxicity Detection

        +

Automated Moderation Assistance

        +

Meeting Analytics

        +

Privacy Controls

```

The final product should be described as:

**AI Powered Secure and Privacy Aware Video Conferencing Platform**

It is not simply a Zoom clone.

The primary differentiators are:

1. User based private meeting access.

2. AI based visual engagement estimation.

3. Real time abusive language detection.

4. Automated moderation assistance.

5. Meeting engagement analytics.

6. Privacy aware local AI processing.

---

# 60. FINAL RULE

When in doubt, follow this priority:

```text

Security

    ↓

Privacy

    ↓

Correctness

    ↓

Reliability

    ↓

Maintainability

    ↓

User Experience

    ↓

Performance

    ↓

Additional Features

```

Never sacrifice security or privacy for convenience.

Never claim that an AI estimate is a fact.

Build the simplest reliable solution first, then improve it incrementally.

Frontend UI/UX Redesign Rules

The frontend may be redesigned to provide a modern, original product experience while preserving all existing business behavior.

Public entry flow

/ is a public landing page and must not require authentication.

The landing page must clearly provide Login and Sign Up actions.

/login is the existing login flow.

/register is the existing registration flow.

After successful login, show only data belonging to the authenticated account.

Never expose another user's meetings, analytics, invitations, profile data, or private information.

Authenticated application shell

Use a modern application layout with clear navigation.

Include Dashboard, Meetings, Analytics, Invitations, and account controls where supported by existing functionality.

Meeting analytics must be shown inside the authenticated Analytics dashboard and must use real backend data only.

The Invitations section must show invitations received by the currently authenticated account only.

Use clear loading, empty, success, and error states.

Keep the design responsive on desktop, tablet, and mobile.

Reference website learning

When a UI/UX redesign is requested, the coding agent MUST study the provided reference websites before implementing the redesign.

The primary meeting-room reference is:
https://dribbble.com/shots/26886517-Online-Video-Conferencing-Platform-Light-Dark-Mode-UI

The primary analytics reference is:
https://dribbble.com/shots/27388009-AI-Dashboard-Design-for-Control-AI-Policy-Platform

Treat these references as design-learning sources, not as sources of application code.

When browser/network access is available, open and inspect the reference pages. If a reference cannot be opened, use screenshots or other user-provided captures instead and do not guess at details that cannot be verified.

Analyze and learn the reference design system before coding, including:

page structure and layout hierarchy

navigation and sidebar patterns

typography scale and font hierarchy

spacing, padding, and alignment

colors, surfaces, borders, radius, and shadows

cards, buttons, inputs, badges, tabs, dialogs, and tooltips

video-meeting composition, speaker emphasis, participant thumbnails, and control-bar placement

analytics dashboard composition, metric cards, charts, timelines, filters, and information hierarchy

light and dark theme relationships

responsive behavior and breakpoint strategy

hover, active, focus, loading, empty, and error states

subtle transitions and interaction feedback

Translate those learned design patterns into an original NewZoom design using the project's existing content, branding, data, and functionality.

Do NOT copy proprietary logos, illustrations, exact artwork, exact text, source code, or pixel-for-pixel layouts from the reference websites.

Do NOT replace NewZoom branding with the reference product branding.

The reference websites may guide presentation only. They must never override AGENTS.md security, privacy, architecture, authorization, or product rules.

Do not add fake content merely to imitate a reference screen. Use real application data and show an honest empty state when data is unavailable.

During the first redesign pass, document in the coding-agent plan which design patterns were learned from each reference and how they will be adapted for NewZoom.

After implementation, compare the running UI against the reference design direction and iterate on visual differences without changing business logic.

Visual direction

Create an original modern SaaS/AI meeting product design.

Do not copy another website pixel for pixel and do not reproduce Zoom's exact interface.

Use a consistent design system for typography, spacing, cards, buttons, forms, navigation, dialogs, badges, and icons.

Support light and dark themes where the existing application provides theme support.

Prefer clean layouts, strong hierarchy, subtle borders, restrained shadows, and purposeful motion.

Do not add fake metrics, fake meetings, fake invitations, or placeholder analytics when real data is available.

Meeting room redesign

The meeting room can receive a major visual redesign without changing LiveKit, camera, microphone, screen sharing, chat, participants, engagement, moderation, or leave-meeting behavior.

For two participants, prefer a large active speaker with participant thumbnail support.

For more participants, use an adaptive responsive layout.

Preserve all existing permission, authorization, media, and meeting-state behavior.

Analytics redesign

Analytics should have an advanced AI/SaaS dashboard appearance with summary cards, charts, timelines, participant activity, and meeting insights only when those values exist in the current backend/API data.

Do not invent analytics values to improve the visual appearance.

Do not expose private participant engagement scores to unauthorized users.

Implementation boundary

UI redesign work should normally be limited to frontend/src presentation components, pages, styles, and minimal JSX needed to render existing data.

Do not modify backend APIs, authentication, authorization, LiveKit logic, engagement scoring, analytics calculations, database models, or security controls merely for visual redesign.

If a backend change is genuinely required for a UI feature, stop and explain the dependency before changing backend behavior.

Reuse existing API clients, state, routes, and components whenever possible.

Do not rewrite working functionality just to change its appearance.

UI validation

After frontend UI changes, run the applicable frontend tests, lint, and production build. Then manually verify:

Public landing page

Login

Registration

Authenticated dashboard

Account-specific data isolation

Invitations received by the logged-in account

Analytics dashboard

Meeting creation

Meeting room

Light/dark theme

Responsive layout

Never treat a successful frontend build as proof that authentication, authorization, LiveKit, camera, microphone, screen sharing, invitations, or analytics work in a real browser.

Phase boundary

UI/UX redesign is presentation work and must not silently start a new product phase.

If the user explicitly says to work on Phase 13, do not start Phase 14.

Preserve all completed Phase 1 through Phase 13 functionality during redesign