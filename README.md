# Binor

Binor is a professional platform for realtors and agencies in Tashkent. It matches one
realtor's properties with another realtor's client requests, turns Telegram listings into
structured offers, and helps partners cooperate on a deal with a verifiable history.

The product source of truth is [`docs/BINOR_MASTER_DOCUMENT.md`](docs/BINOR_MASTER_DOCUMENT.md)
(Russian). Section references such as `§12.4` in the code point to it.

## Stack

- [Next.js 16.3.8](https://nextjs.org) App Router with Turbopack, React 19.2
- [Tailwind CSS 4.3](https://tailwindcss.com) with CSS-first design tokens in `src/app/globals.css`
- TypeScript (strict), ESLint (`eslint-config-next`), [Vitest](https://vitest.dev)
- [lucide-react](https://lucide.dev) icons, Inter via `next/font` (Latin + Cyrillic)

The project started from the official `create-next-app@16.3.8` template (App Router,
TypeScript, Tailwind, ESLint, `src/` directory).

## Getting started

Requires Node.js 20.9 or later.

```bash
npm install
npm run dev          # http://localhost:3000 → redirects to /ru or /uz
```

| Script              | What it does                                   |
| ------------------- | ---------------------------------------------- |
| `npm run dev`       | Development server (Turbopack)                 |
| `npm run build`     | Production build                               |
| `npm start`         | Serve the production build                     |
| `npm run typecheck` | Generate route types, then `tsc --noEmit`      |
| `npm run lint`      | ESLint                                         |
| `npm test`          | Vitest unit tests                              |

### Environment variables

| Variable               | Purpose                                                                      |
| ---------------------- | ---------------------------------------------------------------------------- |
| `NEXT_PUBLIC_SITE_URL` | Canonical origin for metadata, sitemap and hreflang. Defaults to `https://binor.uz`. |
| `TELEGRAM_BOT_TOKEN`   | Enables `POST /api/telegram/auth` (Mini App `initData` validation). Without it the route answers `503 telegram_auth_not_configured`. |

## What is in the app

Everything lives under a locale segment: `/ru/…` (Russian) and `/uz/…` (Uzbek, Latin).
`src/proxy.ts` redirects locale-less URLs using the `NEXT_LOCALE` cookie, then
`Accept-Language`, then Russian.

**Public site** — `/`, `/how-it-works`, `/about`, `/contacts`, `/faq`, with per-locale
metadata, hreflang alternates, `sitemap.xml`, `robots.txt`, Open Graph image and JSON-LD.
It states only facts the master document marks as public; internal metrics, tariffs and
market-share estimates are deliberately left out (§41).

**Sign-in** — `/{locale}/login` validates Telegram Mini App `initData` on the server; the
phone + code path is a demo (SMS is not connected). `/{locale}/onboarding` is a five-step
wizard. No session is created yet.

**Workspace (demo)** — `/{locale}/app`, a mobile-first realtor workspace:

| Area | Routes |
| --- | --- |
| Today | `/app` action feed, `/app/search`, `/app/notifications`, `/app/tasks`, `/app/more` |
| CRM | `/app/leads`, `/app/clients`, `/app/requirements/new` (natural-language request editor), `/app/requirements/[id]` (shortlist) |
| Inventory | `/app/properties` (list / by district), `/app/properties/[id]` (Property vs Listing), `/app/properties/new` (duplicate check) |
| Matching | `/app/matches`, `/app/matches/[id]` — explained by reasons, never a bare score |
| Telegram Radar | `/app/radar`, `/app/radar/[id]` (raw vs parsed with confidence), `/app/radar/import` (listing copilot) |
| MLS | `/app/mls` (shared base, my listings, buyer requests), `/app/mls/cooperation` (versioned commission terms) |
| Transactions | `/app/viewings` (agenda, conflicts, feedback), `/app/offers` (negotiation history), `/app/deals` (pipeline, stage guards, documents, 3-working-day MLS deadline) |
| Calls | `/app/calls` (missed and unknown numbers first), `/app/calls/[id]` (recording consent, AI summary as a draft), `/app/calls/timeline` |
| Owners & documents | `/app/owners`, `/app/contracts` (required clauses, consent of every right holder), `/app/consents`, `/app/verification` and `/app/verification/request` |
| Team & network | `/app/team`, `/app/team/routing` (lead routing simulator), `/app/partners`, `/app/audit` (append-only journal); `?demoRole=team_lead\|agency_owner\|agency_admin` previews the manager view |

The workspace runs on a seeded, clearly fictional dataset (`src/lib/data/seed-*.ts`) behind
an async repository (`src/lib/data/repository.ts`) that a real backend can replace.
"Now" is frozen in `src/lib/clock.ts` so demo dates and hydration are deterministic.
Demo actions (accept, reject, save…) use local state and say that nothing is persisted.

## Project layout

```text
src/
  app/[locale]/(site)/   public site
  app/[locale]/app/      workspace screens
  app/api/telegram/auth/ Telegram Mini App initData validation
  components/            ui primitives, domain badges, site and workspace components
  i18n/                  locale config, formatting (Asia/Tashkent), RU/UZ message namespaces
  lib/domain/            domain model and pure business logic (see below)
  lib/data/              demo seed and repository
  proxy.ts               locale routing
docs/                    product master document
```

Domain modules in `src/lib/domain/` are framework-free and unit-tested:

- `types.ts` — canonical model: Property ≠ Listing ≠ TelegramListing, Match, Cooperation, Deal
- `money.ts` — exact integer minor-unit money, USD/UZS formatting, explicit FX conversion
- `matching.ts` — hard filters, weighted soft criteria, confidence bands, reasons, reverse matching
- `requirement-parser.ts`, `post-parser.ts` — RU/UZ natural-language and Telegram post parsing with per-field confidence; currency, area and floor are never guessed
- `dedup.ts` — multi-signal duplicate candidates; merging is always a human decision
- `commission.ts` — split presets with explicit roles, validation, exact split, immutable term versions
- `lifecycle.ts` — listing, deal, cooperation and offer transitions with explicit unmet prerequisites
- `permissions.ts` — the §19 role matrix: scopes, grants, mandatory audit and who can grant access
- `routing.ts` — lead routing rules with an explainable step-by-step trace
- `contracts.ts` — contract status, required clauses, right-holder consent and signature rules
- `freshness.ts`, `working-days.ts`, `phone.ts`, `geo.ts`

## Conventions

See [`AGENTS.md`](AGENTS.md): Next.js 16 specifics, RU/UZ parity and Uzbek orthography,
domain rules, design tokens and accessibility requirements (44px touch targets, no
colour-only state).

## Deploy

The app deploys to [Vercel](https://vercel.com/new) as a standard Next.js project. Set
`NEXT_PUBLIC_SITE_URL` and, when the Telegram login should work, `TELEGRAM_BOT_TOKEN`.
