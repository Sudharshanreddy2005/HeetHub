# AI Secure Meeting

AI Secure Meeting is a privacy-aware, authenticated video-conferencing prototype with private invitations, backend-issued LiveKit access, meeting chat, AI-assisted chat moderation, consented temporary voice-transcript moderation, visual-engagement estimates, host alerts, and host analytics. The current source includes engagement scoring; system-wide integration and production acceptance remain incomplete, and production deployment has not started.

## Architecture

The project uses a React/Vite frontend and a modular FastAPI backend. The backend owns configuration, authentication, meeting authorization, chat persistence, moderation decisions, host controls, and the MongoDB connection lifecycle. LiveKit handles media transport; the backend issues short-lived room tokens only after validating meeting access. MongoDB is included for local development, but basic health testing does not require a running database.

```text
Browser (React + Vite)
        |
        v
FastAPI backend ----> MongoDB
```

## Technology stack

- Frontend: React, TypeScript, Vite, Tailwind CSS, ESLint, Vitest
- Backend: Python, FastAPI, Pydantic Settings, Uvicorn, Motor
- Local infrastructure: Docker Compose and MongoDB

## Prerequisites

- Node.js 20 or newer and npm
- Python 3.11 or newer
- Docker Desktop (only required for the container workflow)

## Environment variables

Copy `.env.example` to `.env` only when local configuration is needed. The example contains placeholders only. Set a strong, randomly generated `JWT_SECRET` before using authentication, and configure `LIVEKIT_API_KEY`, `LIVEKIT_API_SECRET`, and `LIVEKIT_URL` before joining video rooms. The backend uses `MONGODB_URI` and `MONGODB_DATABASE`; if `MONGODB_URI` is empty, the API still starts and `/health` remains available.

## Start the frontend

```powershell
cd frontend
npm install
npm run dev
```

Open <http://localhost:5173>.

## Start the backend

```powershell
cd backend
python -m venv .venv
.\.venv\Scripts\Activate.ps1
python -m pip install -r requirements.txt
python -m uvicorn app.main:app --reload
```

The health endpoint is available at <http://localhost:8000/health> and returns `{"status":"ok"}`.

Authentication endpoints are available at `/auth/register`, `/auth/login`, and `/auth/me` when `JWT_SECRET` is configured. Authenticated meeting, invitation, chat, host-only moderation, and consented voice moderation endpoints are available under `/meetings`. The `/meetings/{meeting_id}` browser route connects to LiveKit after the backend grants access.

## Tests and quality checks

Frontend:

```powershell
cd frontend
npm run lint
npm test -- --run
npm run build
```

Backend:

```powershell
cd backend
python -m pytest
```

## Docker

```powershell
docker compose up --build
```

The frontend is available at <http://localhost:5173>, the API at <http://localhost:8000>, and MongoDB on its local container network. Stop the services with `docker compose down`.

## Current scope and privacy

Chat messages and moderation decisions/events are stored in MongoDB. `SAFE` and `WARNING` messages remain visible; `BLOCK` messages are not persisted as chat content. Host controls can disable chat, remove or block a participant, and apply a temporary microphone restriction. When LiveKit is configured, active microphone tracks are muted and remove/block actions disconnect the participant. Voice moderation is an explicit, optional browser speech-recognition flow: only final transcript text is submitted after backend-validated consent, and transcript content and raw audio are not persisted. Browser speech providers may process audio under their own policies. The classifier is a small development baseline, not production-ready moderation.
# HeetHub
