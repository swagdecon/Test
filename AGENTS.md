# AGENTS.md

## Cursor Cloud specific instructions

**PodFlow Scheduler** is a single Next.js 16 application (App Router) — no microservices, no Docker, no database. All state is persisted client-side in browser `localStorage`.

### Running the app

See `README.md` for standard commands (`npm run dev`, `npm run build`, `npm run lint`). The dev server runs on port **3000**.

### Routes

- `/` — Landing page (marketing, features, pricing)
- `/app` — Main dashboard with all features (sidebar navigation)
- `/api/subscription/checkout` — Stripe checkout (falls back to demo mode)
- `/api/calendar/import` — ICS import proxy

### Environment variables

Copy `.env.example` → `.env.local`. Only `NEXT_PUBLIC_APP_URL=http://localhost:3000` is needed for local dev. Stripe keys are optional — the app falls back to **demo upgrade mode** when they are absent.

### Gotchas

- The project uses **npm** (lockfile: `package-lock.json`). Do not use pnpm or yarn.
- There are no automated tests in the repository; validation is done via lint (`npm run lint`) and build (`npm run build`).
- Next.js 16 with Turbopack is used for dev builds; hot reload is fast and reliable.
- The dashboard uses `localStorage` key `podflow.scheduler.v2` (different from v1 used by the legacy `SchedulerApp.tsx`).
- AI features (episode planning, guest research, co-host simulator, trending topics) use deterministic template-based generation — no external AI API is required.
