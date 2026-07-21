# WebinarJam Dynamic Registration

A modern, responsive Next.js app that registers users for a WebinarJam webinar. It
fetches schedules live from the WebinarJam API, localizes session times to the
visitor's timezone, offers an always-available "Just In Time" slot, cleans up any
prior signups for the same email, and shows the user their personal join link.

## Stack

- Next.js 15 (App Router) + React 19 + TypeScript
- Tailwind CSS
- Lucide icons
- Deployed on Vercel

## How it works

All WebinarJam calls run server-side (`src/lib/webinarjam.ts`) so the API key is
never exposed to the browser. The client talks only to our own API routes:

| Route | Method | Purpose |
|-------|--------|---------|
| `/api/webinar` | GET | Fetch webinar details + `schedules[]` |
| `/api/register` | POST | Unsubscribe the email from prior schedules, then register |

### WebinarJam endpoints used (verified against the live API)

- `POST /webinarjam/webinar` — returns `webinar.schedules[]` as `{ schedule, date, comment }`
- `POST /webinarjam/register` — returns `user.live_room_url`, `user.thank_you_url`
- `POST /webinarjam/registrants` — paginated list, used to map an email to its `lead_id`
- `POST /webinarjam/unsubscribe` — **requires `lead_id`, not email**; returns HTTP 204 (soft unsubscribe)

Because unsubscribe keys on `lead_id`, the "remove by email" cleanup lists
registrants first, resolves matching `lead_id`s, and unsubscribes each. This is
best-effort: a cleanup failure never blocks a new registration.

### "Just In Time" slot

`src/lib/schedule.ts` synthesizes a `jit` option pinned to the next quarter-hour
(at least ~5 minutes out) rendered in the user's timezone. On submit, the JIT
choice maps to the first real schedule id so WebinarJam accepts it.

### Timezones

The visitor's zone is auto-detected via
`Intl.DateTimeFormat().resolvedOptions().timeZone`, with a manual dropdown
override. Schedule wall-clock times (given in the webinar's own timezone) are
converted to the selected zone for display.

## Environment variables

Create `.env.local` (see `.env.local.example`):

```bash
WEBINARJAM_API_KEY=your-api-key
WEBINARJAM_WEBINAR_ID=1
```

> **Note on Webinar ID:** the original spec referenced webinar ID `2`, but that
> ID does not exist on the connected account — the only live webinar is ID `1`.
> `WEBINARJAM_WEBINAR_ID` is configurable and defaults to `2` in code; set it to
> `1` (as in the example) for a working demo, or to whatever webinar you target.

## Local development

```bash
npm install
cp .env.local.example .env.local   # then fill in your key
npm run dev                          # http://localhost:3000
```

Quality checks:

```bash
npm run typecheck   # tsc --noEmit
npm run lint        # next lint
npm run build       # production build
```

## Deploy to Vercel

### Option A — Dashboard

1. Push this repo to GitHub.
2. Import it at [vercel.com/new](https://vercel.com/new).
3. Under **Settings → Environment Variables**, add:
   - `WEBINARJAM_API_KEY`
   - `WEBINARJAM_WEBINAR_ID`
4. Deploy.

### Option B — CLI

```bash
npm i -g vercel
vercel link
vercel env add WEBINARJAM_API_KEY production
vercel env add WEBINARJAM_WEBINAR_ID production
vercel --prod
```

## Project structure

```
src/
  app/
    api/
      webinar/route.ts     # GET webinar details
      register/route.ts    # POST unsubscribe + register
    layout.tsx
    page.tsx
    globals.css
  components/
    RegistrationForm.tsx   # form, timezone, dynamic schedules + JIT
    SuccessCard.tsx        # confirmation + personal link + copy button
    Toast.tsx              # toast provider / hook
  lib/
    webinarjam.ts          # server-side API client
    schedule.ts            # timezone + JIT schedule builder
    countryCodes.ts        # phone country codes
    utils.ts               # cn() helper
```
