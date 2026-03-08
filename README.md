# PodFlow Scheduler

Full-featured podcast scheduling app built with Next.js:

- **Paid subscription tier** (Free vs Pro) with Stripe Checkout support
- **Calendar integrations** for Google / Outlook / Apple via ICS import
- **Native in-app calendar** to visualize release and production events
- **Notification functionality** (browser reminders + email/SMS preference controls)
- **Customization options** (theme, timezone, week start, compact mode, defaults)

## Tech stack

- Next.js 16 (App Router)
- TypeScript
- Tailwind CSS
- Stripe SDK
- date-fns

## Run locally

```bash
npm install
npm run dev
```

Open `http://localhost:3000`.

## Environment variables

Copy `.env.example` to `.env.local`:

```bash
cp .env.example .env.local
```

Then set values:

```bash
NEXT_PUBLIC_APP_URL=http://localhost:3000
STRIPE_SECRET_KEY=sk_test_...
STRIPE_PRICE_PRO_MONTHLY=price_...
STRIPE_PRICE_PRO_YEARLY=price_...
```

If Stripe variables are missing, checkout automatically falls back to **demo upgrade mode** so you can still test the Pro feature flow.

## API routes

- `POST /api/subscription/checkout`  
  Creates a Stripe Checkout session (or returns demo mode).
- `POST /api/calendar/import`  
  Server-side ICS fetch proxy (avoids browser CORS limits for calendar feed imports).

## Notes

- Current app state is persisted in browser localStorage (`podflow.scheduler.v1`).
- ICS export is supported for all scheduled podcast episodes.
- Browser notifications require user permission in the active browser session.
