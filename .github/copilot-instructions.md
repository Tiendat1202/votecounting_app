<!-- .github/copilot-instructions.md - tailored guidance for AI coding agents -->
# Copilot instructions for this repository

Purpose: help an AI contributor quickly understand architecture, developer workflows, and integration points so edits are safe and productive.

- Big picture:
  - **Frontend**: Vite + React + TypeScript in `frontend/`. UI uploads images and calls backend APIs (see [frontend/src/api.ts](frontend/src/api.ts)).
  - **Backend (Node/TS)**: Express + TypeORM in `backend/src/`. Main entry: [backend/src/index.ts](backend/src/index.ts). Important services: `backend/src/services/aiService.ts` (AI integration) and `backend/src/services/voteService.ts` (vote persistence and result handling).
  - **AI service (Python)**: Python FastAPI app living under `AI/` and a small wrapper `ai_backend.py` at repo root. Run the Python AI backend with `python AI/run_ai.py` or `python ai_backend.py` for the standalone wrapper.

- Data flow and integration patterns (concrete):
  - Clients upload images to `POST /api/uploads/:sessionId` (see [backend/src/index.ts](backend/src/index.ts)). The Node backend stores images under `backend/uploads` and then calls `AI` via `AIService.processAndWait()`.
  - `AIService` calls the Python backend at `AI_BACKEND_URL` (env var). The Python app exposes `/api/process` (sync) and `/api/batches` (async batch). See [backend/src/services/aiService.ts](backend/src/services/aiService.ts) and [ai_backend.py](ai_backend.py).
  - The Python processor expects files and returns structured `parsed` results (candidate info, confidence). The Node backend saves these into the database (TypeORM entities under `backend/src/entities/`).

- Environment and runtime notes:
  - Key env vars: `AI_BACKEND_URL` (Node -> Python AI), `AI_PROCESSOR` and `GOOGLE_API_KEY` (used by `ai_backend.py`).
  - Default local AI backend URL: `http://localhost:8000`.
  - To run AI locally: `python AI/run_ai.py` (uses `backend.app` inside `AI/backend`). To run the root FastAPI wrapper: `python ai_backend.py`.

- Project-specific conventions to follow:
  - Ballot types are named `trust` or `surplus` (look for these literals in `backend/src` and the `AI` code). Preserve these when adding endpoints or fields.
  - The Python AI processor function signature used by `ai_backend.py` expects `process_ballot(tmp_path, ballot_type, batch_name, filename)` (see import in `ai_backend.py` and `AI/backend/ballot_processor.py`). Keep wrapper compatibility when changing processors.
  - Uploads: only image MIME types allowed (`image/png|jpeg|webp`) — enforced by multer in `backend/src/index.ts`. Maintain these checks unless adding explicit support for other formats.

- Where to look for examples and edits:
  - Upload handling + async AI processing: [backend/src/index.ts](backend/src/index.ts) (search `upload.array` and `aiService.processAndWait`).
  - AI client + polling logic: [backend/src/services/aiService.ts](backend/src/services/aiService.ts).
  - Python AI wrapper and endpoints: `ai_backend.py` (root) and `AI/run_ai.py`.
  - Prompt files and AI models: `AI/prompt/` and `app/prompts/` (text prompts used by processors).

- Safe-change checklist for AI-related edits:
  1. If you change the AI API shape, update `backend/src/services/aiService.ts` and `ai_backend.py` together.
  2. If you add fields to AI `parsed` results, update TypeORM entities or the places where `parsed` is consumed (e.g., `VoteService.processAndSaveVote`).
  3. Keep `AI_PROCESSOR` fallback (mock vs real) in mind — it is used for local development/testing in `ai_backend.py`.

- Quick commands (local dev):
  - Start AI backend (Python): `python AI/run_ai.py` or `python ai_backend.py`.
  - Start Node backend: in `backend/` run `npm install` then `npm run dev` (or `npm start` per package scripts).
  - Frontend: in `frontend/` run `npm install` then `npm run dev` (Vite default on :5173).

If anything here is unclear or you want more examples (tests, database seeding, or how prompts are versioned), tell me which area to expand and I'll iterate.
