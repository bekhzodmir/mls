<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

# Binor project conventions

Binor is a professional PropTech platform for realtors in Tashkent (see `docs/` and the
master document). The product source of truth is the Binor Master Document v1.1; section
numbers like §12.4 in comments refer to it.

## Stack

- Next.js 16.3 App Router (Turbopack), React 19.2, TypeScript strict, Tailwind CSS 4.3.
- `src/proxy.ts` (not `middleware.ts`) does locale routing. All routes live under
  `src/app/[locale]/…`; `[locale]` is the root layout segment (`ru` | `uz`).
- `params` / `searchParams` are Promises. Use the global `PageProps<'/[locale]/…'>` /
  `LayoutProps<…>` helpers (run `npx next typegen` after adding a route).
- Get the locale in server code with `getLocale()` from `@/i18n/server` (wraps
  `next/root-params`). Client components receive `locale` as a prop.

## i18n

- RU and UZ (Latin) at full parity. Never hard-code user-visible text in components.
- Each feature owns a namespace file in `src/i18n/messages/<feature>.ts` built with
  `defineMessages({ ru, uz })`; the Uzbek object must have exactly the Russian keys.
- Domain enum labels are shared in `src/i18n/messages/domain.ts` — reuse, don't duplicate.
- Uzbek Latin orthography: use ‘ (U+2018) in o‘ / g‘ and ’ (U+2019) for the tutuq belgisi
  (e’lon, ob’yekt, ta’mir). Follow the RU↔UZ glossary in master document §42.4.
- Format money with `formatMoney`, dates with `src/i18n/format.ts` (Asia/Tashkent).

## Domain rules (do not violate)

- Property ≠ Listing ≠ Advertisement/TelegramListing (§10.1).
- Money is integer minor units + currency (`src/lib/domain/money.ts`); no float prices.
- Unknown is a value: never invent missing data; show "Неизвестно / Noma’lum".
- A "verified" badge names exactly one checked fact with method and source.
  `unavailable` (registry did not answer) is never shown as verified (§16.4, §38.2).
- Commission splits (50/50, 70/30, 80/20, custom) are between realtors, not a Binor fee.
- Matches are explained by reasons, never by a bare score (§12.4). Use
  `MatchReasons` / `summarizeMatch` from `src/components/domain/match-explanation.tsx`.
- Publish only [ПУБЛИЧНО] facts on the public site (`src/lib/site.ts`). Internal S4
  metrics (500+ users, 120 deals, $150 average, 75% retention), market-share estimates
  and pricing hypotheses must NOT be shown (§41 D3, D4, D9).
- The workspace runs on seeded, clearly fictional demo data; "now" is frozen via
  `src/lib/clock.ts` so SSR and hydration match.

## UI

- Mobile-first (375–430px first), one-thumb: touch targets ≥ 44px (`h-11`, `size-11`).
- Design tokens are in `src/app/globals.css`: surfaces `bg-bg`, `bg-surface`,
  `bg-surface-muted`, `text-fg`, `text-fg-muted`, `border-border`; `bg-primary`;
  semantic `*-success-*`, `*-warning-*`, `*-danger-*`, `*-info-*`; radius `rounded-sm|md|lg|xl`
  = 8/12/16/24px; type scale `text-display|h1|h2|body|small|caption`.
- Never convey state by colour alone: badges carry an icon and text.
- Reuse primitives from `src/components/ui/*` and domain badges from
  `src/components/domain/*`. Every list has an empty state (§23.1).
- Icons: `lucide-react`.

## Checks

`npm run typecheck`, `npm run lint`, `npm test`, `npm run build`.
