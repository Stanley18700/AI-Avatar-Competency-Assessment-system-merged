# NurseMind AI Re-Merge Requirements

Use this document as the source prompt/specification when asking another AI agent to recreate or re-merge this system in a different folder.

## Ready-To-Paste AI Prompt

You are re-merging a full-stack application named **NurseMind AI**. Recreate the final merged system with the same behavior, architecture, routes, data model, environment setup, and deployment assumptions described below.

The target system is an AI-powered nurse cognitive competency assessment platform. It has a React/Vite frontend in `client`, an Express/TypeScript backend in `server`, Prisma for persistence, role-based authentication, Gemini-based AI scoring and voice chat, Azure Speech talking avatar integration, analytics, reviewer approval, reporting, and individual development plan (IDP) features.

Preserve the existing project shape:

```text
nursemind-ai/
  package.json
  .env.example
  render.yaml
  vercel.json
  DEPLOYMENT.md
  TEST_ASSESSMENT_FLOW.md
  client/
    package.json
    vite.config.ts
    tailwind.config.js
    src/
  server/
    package.json
    tsconfig.json
    prisma/
      schema.prisma
      seed.ts
    src/
      index.ts
      lib/prisma.ts
      middleware/
      routes/
      services/
      utils/
      validators/
```

Build the final result so that:

1. The frontend runs with `npm run dev` inside `client` on port `5173`.
2. The backend runs with `npm run dev` inside `server` on port `3001`.
3. Root scripts proxy common commands into `client` and `server`.
4. Frontend API calls use `VITE_API_BASE_URL` when present, `/api` in local development, and can fall back to `https://nursemind-ai-api.onrender.com/api` for deployed Render API recovery.
5. Local Vite dev server proxies `/api` to `http://localhost:3001`.
6. Authentication uses JWT bearer tokens stored in `localStorage`.
7. Server CORS allows `CLIENT_URL` and comma-separated `CLIENT_URLS`.
8. Do not commit real secrets. Only provide `.env.example`.

## Product Requirements

NurseMind AI supports three roles:

- `ADMIN`: manage users, departments, competency rubrics, case bank, analytics, summary results, and can access reviewer workflows.
- `REVIEWER`: review AI-scored assessments, adjust scores, approve sessions, view summary results, and edit IDP records.
- `NURSE`: start assessments, perform self-assessment, answer case scenarios by text or voice conversation, view results, and view IDP.

Core workflows:

1. Login with email/password.
2. Nurse starts a case-based assessment.
3. Nurse completes self-scoring against AI-assessed competency criteria.
4. Nurse submits either a text response or a voice-chat conversation transcript.
5. Backend evaluates the transcript with Gemini against the expected criteria IDs.
6. AI scores are validated, stored, and used to create final scores and gaps against standard levels.
7. Reviewer can edit scores, add feedback, create version history, and approve the assessment.
8. System generates analytics, reports, summary results, and IDP data.

Assessment statuses must be preserved:

```text
IN_PROGRESS -> SELF_ASSESSED -> AI_SCORED -> REVIEWED -> APPROVED
```

If AI evaluation fails, status becomes:

```text
AI_FAILED
```

## Frontend Requirements

Use React 19, Vite 6, TypeScript, Tailwind CSS, React Router, Axios, Lucide icons, Recharts, and Microsoft Cognitive Services Speech SDK.

Required client routes:

- `/login`
- `/` and `/dashboard`
- `/users` for `ADMIN`
- `/departments` for `ADMIN`
- `/rubrics` for `ADMIN`
- `/analytics` for `ADMIN`
- `/summary-results` for `ADMIN` and `REVIEWER`
- `/cases` for `ADMIN` and `REVIEWER`
- `/reviews` for `ADMIN` and `REVIEWER`
- `/reviews/:sessionId` for `ADMIN` and `REVIEWER`
- `/my-assessments` for `NURSE`
- `/assessment/:id` for `NURSE`
- `/idp/:sessionId` for `NURSE`, `REVIEWER`, and `ADMIN`

Required frontend modules/features:

- `AuthContext` stores `token` and `user` in `localStorage`.
- `LanguageContext` supports Thai and English locale switching.
- Shared API client in `client/src/lib/api.ts`.
- Layout shell/header/sidebar navigation based on role.
- Assessment page with self-assessment, response, evaluating, and results steps.
- Voice chat panel with Azure Speech recognition, Azure talking avatar support, and fallback behavior.
- Admin pages for users, departments, rubrics, cases, analytics, and summary results.
- Reviewer pages for pending reviews and review detail.
- IDP page with editable reviewer/admin fields.

Styling requirements:

- Tailwind theme should use medical blue and AI indigo colors.
- Thai font support should use `Noto Sans Thai`.
- Keep the existing clean healthcare dashboard style with cards, badges, modals, and responsive layouts.

## Backend Requirements

Use Express 4, TypeScript, Prisma, Zod, JWT, bcryptjs, CORS, dotenv, multer, `@google/generative-ai`, and `@react-pdf/renderer`.

Server entry point:

- Load `.env`.
- Configure CORS from `CLIENT_URL` and `CLIENT_URLS`.
- Accept JSON payloads up to `50mb`.
- Register request logger and error handler.
- Serve health endpoints:
  - `/health`
  - `/api/health`
  - `/health/dependencies`
  - `/api/health/dependencies`

Required API route groups:

- `/api/auth`
- `/api/users`
- `/api/departments`
- `/api/competencies`
- `/api/cases`
- `/api/assessments`
- `/api/reviews`
- `/api/reports`
- `/api/analytics`
- `/api/idp`
- `/api/audio`
- `/api/azure`

Important endpoints to preserve:

- `POST /api/auth/login`
- `GET /api/auth/me`
- `GET/POST/PATCH/DELETE /api/users`
- `GET/POST/PATCH/DELETE /api/departments`
- `POST /api/departments/:id/clinical-issues`
- `GET /api/competencies`
- `GET /api/competencies/ai-assessed`
- `POST /api/competencies/groups`
- `POST /api/competencies/criteria`
- `PATCH /api/competencies/criteria/:id`
- `PUT /api/competencies/standards`
- `GET/POST/PATCH/DELETE /api/cases`
- `GET /api/assessments/my`
- `GET /api/assessments`
- `GET /api/assessments/:id`
- `POST /api/assessments/start`
- `POST /api/assessments/:id/self-score`
- `POST /api/assessments/:id/submit`
- `POST /api/assessments/:id/chat`
- `POST /api/assessments/:id/submit-conversation`
- `GET /api/reviews/pending`
- `GET /api/reviews/:sessionId`
- `POST /api/reviews/:sessionId/score`
- `POST /api/reviews/:sessionId/approve`
- `GET /api/reviews/:sessionId/history`
- `GET /api/reports/:sessionId`
- `GET /api/idp/:sessionId`
- `POST /api/idp/:sessionId`
- `POST /api/audio/synthesize`
- `GET /api/azure/speech-token`
- `GET /api/azure/ice-token`
- `GET /api/analytics/summary`
- `GET /api/analytics/competency-by-category`
- `GET /api/analytics/weaknesses`
- `GET /api/analytics/trends`
- `GET /api/analytics/departments`
- `GET /api/analytics/summary-results`

Auth requirements:

- JWT payload includes `id`, `email`, `role`, `name`, `departmentId`, and `experienceLevel`.
- `authenticate` middleware reads `Authorization: Bearer <token>`.
- `requireRole(...roles)` enforces role-based access.
- Passwords are hashed with bcrypt.

## AI And Voice Requirements

Gemini evaluation:

- Use `GEMINI_API_KEY`, falling back to `GOOGLE_CLOUD_API_KEY` if present.
- Configurable model list through `GEMINI_MODELS`.
- Default models: `gemini-2.5-flash,gemini-2.0-flash,gemini-2.0-flash-lite`.
- Build a strict evaluation prompt from criteria, case information, and transcript.
- Require JSON output with:
  - `criteriaScores`: array of `{ criteriaId, score, reasoning? }`
  - `strengths`
  - `weaknesses`
  - `recommendations`
  - `confidenceScore`
- Validate with Zod.
- Reject missing criteria IDs, invented criteria IDs, and scores outside `1..5`.
- Attempt JSON extraction/repair for markdown-wrapped or slightly malformed model output.

Voice chat:

- Gemini generates Thai spoken conversation prompts for nurse assessment.
- Keep the conversation short, professional, and Thai-dominant.
- Maximum AI turns should be 4.
- Allow fallback scripted Thai prompts if Gemini is not configured.
- Detect Thai completion phrases such as "จบแล้ว", "ไม่มีเพิ่มเติม", "ครบถ้วนแล้ว", and similar.

Azure integration:

- Browser must not receive long-lived Azure keys.
- Backend exposes short-lived Azure Speech token via `/api/azure/speech-token`.
- Backend exposes ICE relay credentials via `/api/azure/ice-token`.
- Required environment variables:
  - `AZURE_SPEECH_KEY`
  - `AZURE_SPEECH_REGION`

Audio:

- Provide an audio synthesize endpoint for text-to-speech behavior.
- Preserve optional Google Cloud speech/TTS-related configuration where present.

## Data Model Requirements

Use Prisma models for:

- `User`
- `Department`
- `CompetencyGroup`
- `CompetencyCriteria`
- `StandardLevel`
- `DepartmentClinicalIssue`
- `Case`
- `AssessmentSession`
- `Transcript`
- `SelfScore`
- `AIScore`
- `ReviewerScore`
- `FinalScore`
- `ScoreVersionHistory`
- `Report`
- `IndividualDevelopmentPlan`

Important domain rules:

- User roles are string values: `ADMIN`, `NURSE`, `REVIEWER`.
- Experience levels are string values: `LEVEL_1` through `LEVEL_5`.
- Competency group types are `CORE`, `FUNCTIONAL`, `SPECIFIC`, and `MANAGERIAL`.
- `CORE` competencies exist but are not AI-assessed.
- AI-assessed groups are functional, specific, and managerial.
- Seed data should create 11 AI-assessed criteria:
  - 4 functional criteria
  - 2 specific criteria
  - 5 managerial criteria
- Standard levels should map `LEVEL_1..LEVEL_5` to standard scores `1..5`.
- `Case.reasoningIndicators`, `Case.linkedCriteriaIds`, AI scores, category scores, reviewer scores, IDP items, and version history values are stored as JSON strings in the database.
- Final score gap is calculated as `score - standardLevel`.
- Weighted total is the average of criteria scores rounded to two decimals.

Database note:

- The current schema file may use SQLite locally, while deployment documentation expects Render PostgreSQL. In the re-merge, choose the provider that matches the target environment. For Render PostgreSQL, set Prisma datasource provider to `postgresql`; for local SQLite, keep `sqlite` and use a SQLite `DATABASE_URL`.

## Seed Data Requirements

Seed must create:

- Departments:
  - General Medicine Department
  - Health Screening Unit
  - Surgical Ward
- Competency groups:
  - Core Competency, not AI-assessed
  - Functional Competency, AI-assessed
  - Specific Competency (Key Clinical Issues), AI-assessed
  - Managerial Competency, AI-assessed
- Standard levels for all active criteria and all experience levels.
- Sample users with password `password123`:
  - `admin@nursemind.ai`
  - `nurse1@nursemind.ai`
  - `nurse2@nursemind.ai`
  - `reviewer@nursemind.ai`
- Sample Thai/English clinical cases with reasoning indicators and linked AI criteria.

## Environment Variables

Provide `.env.example` with:

```env
DATABASE_URL="postgresql://user:password@localhost:5432/nursemind_ai"
JWT_SECRET="your-secret-key-change-in-production"
JWT_EXPIRES_IN="24h"
GEMINI_API_KEY="your-gemini-api-key"
GOOGLE_CLOUD_PROJECT_ID="your-project-id"
GOOGLE_CLOUD_CREDENTIALS="path-to-credentials.json"
AZURE_SPEECH_KEY="your-azure-speech-key"
AZURE_SPEECH_REGION="southeastasia"
ENCRYPTION_KEY="32-byte-hex-key-for-aes-256-cbc"
ENCRYPTION_IV="16-byte-hex-iv"
PORT=3001
NODE_ENV=development
CLIENT_URL="http://localhost:5173"
CLIENT_URLS="http://localhost:5173"
VITE_API_BASE_URL="http://localhost:3001/api"
```

Do not include real `.env` secrets in the re-merged output.

## Package Scripts

Root `package.json`:

- `dev:server`: `cd server && npm run dev`
- `dev:client`: `cd client && npm run dev`
- `build:server`: `cd server && npm run build`
- `build:client`: `cd client && npm run build`
- `db:migrate`: `cd server && npx prisma migrate dev`
- `db:seed`: `cd server && npx prisma db seed`
- `db:studio`: `cd server && npx prisma studio`

Server `package.json`:

- `dev`: `tsx watch src/index.ts`
- `build`: `tsc`
- `start`: `node dist/index.js`
- `db:push`: `prisma db push`
- `db:deploy`: `prisma migrate deploy`
- `db:migrate`: `prisma migrate dev`
- `db:seed`: `prisma db seed`
- `db:studio`: `prisma studio`
- `db:generate`: `prisma generate`

Client `package.json`:

- `dev`: `vite`
- `build`: `tsc -b && vite build`
- `preview`: `vite preview`

## Deployment Requirements

Render backend:

- Service name: `nursemind-ai-api`
- Root directory: `server`
- Build command: `npm ci --include=dev && npm run build && npx prisma generate`
- Start command: `npm run db:push && npm run start`
- Health check path: `/health`
- Database: Render PostgreSQL named `nursemind-ai-db`

Vercel frontend:

- Preferred root directory: `client`
- Build command: `npm run build`
- Output directory: `dist`
- Required variable: `VITE_API_BASE_URL=https://<render-service>.onrender.com/api`
- If using root-level `vercel.json`, preserve SPA fallback and `/api/:path*` rewrite to the Render API.

## Verification Checklist

After re-merge:

1. Install dependencies in root, `client`, and `server` as needed.
2. Configure `.env` from `.env.example`.
3. Generate Prisma client and push/migrate the database.
4. Seed the database.
5. Start backend at `http://localhost:3001`.
6. Start frontend at `http://localhost:5173`.
7. Confirm `/health`, `/api/health`, `/health/dependencies`, and `/api/health/dependencies`.
8. Log in as `nurse1@nursemind.ai` / `password123`.
9. Start an assessment, complete self-scores, submit a response, and confirm AI scoring.
10. Log in as `reviewer@nursemind.ai` / `password123`.
11. Review, adjust, save, and approve the assessment.
12. Confirm final scores, gaps, IDP, analytics, and summary results display correctly.
13. Run `npm run build` in both `client` and `server`.

## Important Preservation Notes

- Keep Thai language content and bilingual labels intact.
- Keep role protections on both frontend routes and backend endpoints.
- Keep AI output validation strict; do not accept invented criteria.
- Keep version history when reviewer scores change.
- Keep short-lived token design for Azure Speech; never expose Azure keys to the browser.
- Keep health endpoints available with and without `/api` prefix.
- Keep local and deployed API URL behavior compatible with Vite, Vercel, and Render.
