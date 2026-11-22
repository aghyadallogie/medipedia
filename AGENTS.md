# AGENTS.md

> Project constitution for AI coding agents (and humans) working on this codebase.
> Read this file fully before making changes. When in doubt, follow this document
> over your own preferences. If something here is wrong or outdated, propose an
> edit to this file rather than silently deviating.

---

## 1. Project Overview

An education platform for medical/clinical learners combining:

- **Lectures** — curated, continuously updated text + image content, organized by domain.
- **Flashcards** — Anki-style, organized by topic, using spaced repetition (client-side SM-2).
- **Questions** — UWorld/USMLE Step 1-style vignettes with per-answer-choice explanations, citations, and per-user performance analytics by domain. **Login required to read or answer.** Web ships a **tutor-mode** question bank in v1.
- **Paper Archive** — landmark papers with admin-written "spark notes" summaries and citation metadata.
- **Video Log** — curated, vetted embedded video catalog organized by domain.

**Clients:**

- **Web app** (Next.js, SSR/SSG, SEO-friendly). Lectures, papers, videos, domains and flashcards are public; questions and analytics require a learner account.
- **Mobile app** (built later, separate repo) — consumes the same App API via `packages/api-client`.

**Admins** author and publish content through **Payload CMS** embedded in the Next.js app at `/admin`.

---

## 2. Tech Stack (locked)

| Layer           | Choice                                                                                                  |
| --------------- | ------------------------------------------------------------------------------------------------------- |
| Language        | TypeScript (strict) everywhere                                                                          |
| Web framework   | Next.js (App Router) — pin an exact version inside Payload's supported range                            |
| CMS             | Payload CMS 3, embedded in the Next.js app                                                              |
| Rich text       | Payload Lexical (`@payloadcms/richtext-lexical`)                                                        |
| Database        | Postgres on Neon (Vercel Postgres)                                                                      |
| ORM             | Payload's built-in Drizzle-backed Postgres adapter, `idType: 'uuid'`                                    |
| Media storage   | Vercel Blob via `@payloadcms/storage-vercel-blob` — abstraction kept so S3/R2 is a drop-in later        |
| Hosting         | Vercel                                                                                                  |
| Auth (admins)   | Payload native auth (email/password), `admin` role                                                      |
| Auth (learners) | Payload auth for credential checks + our own token layer (§5)                                           |
| JWT             | `jose` (sign/verify access tokens, verify Google ID tokens)                                             |
| OAuth           | Google only, hand-rolled authorization-code + PKCE flow (no OAuth library)                              |
| Auth transport  | JWT (httpOnly cookies for web, Bearer tokens for mobile)                                                |
| Email           | Resend via `@payloadcms/email-resend` (verification, password reset)                                    |
| Rate limiting   | Upstash Redis (`@upstash/ratelimit`, `@upstash/redis`) — Phase 7                                        |
| Validation      | Zod                                                                                                     |
| Caching         | Next.js Data Cache + tag revalidation on publish (Payload hooks)                                        |
| Styling         | Tailwind CSS v4                                                                                         |
| Testing         | Vitest                                                                                                  |
| Lint/format     | ESLint + Prettier                                                                                       |
| Runtime         | Node.js `^24.22.3` (Payload's minimum; `.nvmrc` pins major 24)                                          |
| Package manager | pnpm 11 (pinned via `packageManager`; build scripts allowlisted in `pnpm-workspace.yaml` `allowBuilds`) |
| Repo layout     | Monorepo (pnpm workspaces + Turborepo)                                                                  |

**Do not introduce new major dependencies** (auth libraries, ORMs, state managers, CSS frameworks, component libraries, etc.) without adding them to this table first. SM-2 and the IndexedDB wrapper are written in-house (small, no dependency).

---

## 3. Monorepo Structure

```
medipedia/
├─ apps/
│  └─ web/                          Next.js + Payload (one Vercel project)
│     └─ src/
│        ├─ app/
│        │  ├─ (frontend)/          public site, QBank UI, flashcards UI
│        │  ├─ (payload)/admin/     Payload admin panel
│        │  ├─ (payload)/api/cms/   Payload REST (moved from /api, see §6)
│        │  └─ api/v1/              App API — the contract for web + mobile
│        ├─ collections/            Payload collection configs
│        ├─ hooks/                  revalidation, denormalization, validation
│        ├─ server/                 auth, assertCanRead, ApiError, queries, serializers
│        ├─ migrations/             committed Payload migrations
│        ├─ env.ts                  the only place that reads process.env
│        └─ payload.config.ts
├─ packages/
│  ├─ shared/                       Zod schemas, enums, DTO types, constants
│  ├─ api-client/                   typed fetch client for /api/v1/*
│  └─ config/                       shared tsconfig, eslint, prettier presets
├─ turbo.json
├─ pnpm-workspace.yaml
└─ AGENTS.md
```

**Rules:**

- `packages/shared` has **no runtime dependencies on Next.js or Payload**. It is pure types/schemas/constants (Zod is allowed).
- `packages/api-client` depends only on `packages/shared` and a `fetch` implementation.
- The mobile app (future) will consume `packages/api-client` unchanged.
- **Never** import Payload collections or server-only code from `packages/*` or client components.
- `packages/api-client` grows alongside the endpoints: every new `/api/v1` endpoint lands with its client method in the same PR, and web client components call the API through it.

---

## 4. Domain Model (Payload Collections)

All collections use Payload's field types. Timestamps (`createdAt`, `updatedAt`) are enabled on every collection.

**Identifiers:** all primary keys are **UUIDs** (`idType: 'uuid'` on the Postgres adapter — decided before the first migration, do not change). Slugs are the public identifier for content that has a page (lectures, papers, videos, domains, topics). Flashcards and questions have no slug; they are addressed by UUID.

**Publishing:** every content collection uses Payload **drafts/versions** (`versions: { drafts: true }`) instead of a hand-made `status` field. Payload's `_status` (`draft` | `published`) is the publish state, and version history provides the "continuously updated" audit trail. Scheduled publishing is allowed.

### `Users` (learners and admins)

- `email` (unique, required)
- `password` (Payload auth; empty for Google-only accounts)
- `name`
- `provider` — `email` | `google`
- `googleSub` (string, unique, nullable — Google account ID)
- `role` — `learner` (default) | `admin`
- `emailVerified`
- Access: learners can read/update self (never their own `role`); admins full access.
- Admins are `Users` with `role: 'admin'`. Payload admin panel access is gated on `role === 'admin'`. There is no separate `Admins` collection and only one editorial role in v1.

### `Domains`

The canonical taxonomy for organizing everything (e.g., Cardiology, Pharmacology, Pathology).

- `name` (required)
- `slug` (unique, required)
- `description`
- `parent` (self-relation, optional — supports sub-domains; max depth 2)
- `order` (number, for display)

### `Topics`

Finer-grained categorization for flashcards and questions.

- `name`, `slug` (unique), `domain` (relation → Domains, required), `order`

### `Lectures`

- `title`, `slug` (unique), `summary`, `coverImage` (upload → Media)
- `domains` (relation → Domains, hasMany)
- `body` (rich text — Lexical)
- `publishedAt` (date)
- `accessTier` — `free` | `premium` (default `free`; reserved for future gating)
- `lastReviewedAt` (date — "continuously updated" signal)
- `citations` (array: `label`, `url`)
- SEO: `metaTitle`, `metaDescription`

### `Flashcards`

- `front` (plain text + optional inline image upload → Media)
- `back` (rich text)
- `topic` (relation → Topics, required)
- `domain` (relation → Domains — **set by hook from `topic`**, read-only in admin)
- `tags` (array of strings)
- `accessTier`
- **No per-user scheduling fields live here.** Scheduling is client-side (see §9).

### `Questions`

- `vignette` (rich text — the clinical stem)
- `stem` (the actual question)
- `choices` (array, min 2, max 6):
  - `label` (A, B, C, ... — assigned automatically in order)
  - `text`
  - `isCorrect` (boolean — exactly one must be true; enforced by validation)
  - `explanation` (rich text — why this choice is right/wrong)
- `overallExplanation` (rich text)
- `topic` (relation → Topics, required)
- `domain` (relation → Domains — **set by hook from `topic`**, read-only in admin)
- `difficulty` — `easy` | `medium` | `hard`
- `citations` (array: `label`, `url`)
- `accessTier`
- **Field-level access:** `choices.isCorrect`, `choices.explanation` and `overallExplanation` have `access.read` restricted to admins. This protects them on Payload's own REST API too, not just `/api/v1`. The answer endpoint reads them with the Local API and `overrideAccess: true` on the server only.

### `Papers`

- `title`, `slug` (unique)
- `authors` (array of strings)
- `journal`, `year`
- `doi`, `pubmedUrl` (external links)
- `citationCount` (number)
- `leadAuthorHIndex` (number — the lead author's h-index, manually entered)
- `clinicalRelevance` (number 1–5, admin-assigned)
- `abstract` (rich text — the original abstract)
- `sparkNotes` (rich text — admin-written summary)
- `domain` (relation → Domains)
- `accessTier`

### `Videos`

- `title`, `slug` (unique)
- `embedUrl` (YouTube/Vimeo — validated and normalized on save)
- `provider` — `youtube` | `vimeo` | `other` (derived from `embedUrl`)
- `description` (rich text)
- `thumbnail` (upload → Media, optional — falls back to the provider thumbnail)
- `domain` (relation → Domains)
- `durationSeconds` (number)
- `reviewedAt` (date — "vetted/reviewed" signal)
- `reviewedBy` (relation → Users, admins only)
- `accessTier`

### `Media` (Payload upload collection)

- `alt` (required), `caption`
- Storage adapter: Vercel Blob. Interface abstracted so R2/S3 can replace it.

### `AnswerEvents` (learner question attempts)

Written by the API, never edited by users.

- `user` (relation → Users, indexed)
- `question` (relation → Questions, indexed)
- `selectedLabel` (string)
- `isCorrect` (boolean)
- `isFirstAttempt` (boolean — true for the user's first answer to this question; analytics accuracy uses first attempts)
- `domain` (relation → Domains — denormalized for analytics; the top-level domain is resolved at query time)
- `topic` (relation → Topics — denormalized)
- `answeredAt` (date, indexed)
- Composite index on `(user, question)` and `(user, answeredAt)`.
- Access: user reads own; admins read all (aggregate-only for analytics in UI). Deleted with the user (cascade).

### `RefreshTokens`

- `user` (relation → Users, indexed)
- `tokenHash` (string, SHA-256 of the opaque token, unique, indexed)
- `audience` — `web` | `mobile`
- `familyId` (UUID — all rotations of one login share it, for reuse detection)
- `expiresAt` (date)
- `revokedAt` (date, nullable)
- `deviceLabel` (string, optional)
- Access: no public or learner access; server-only.

> **Flashcard review state is intentionally NOT in the DB in v1.** See §9.

---

## 5. Authentication & Authorization

Payload 3 has no built-in OAuth and no rotating refresh tokens, so learner auth is a thin layer we own on top of Payload. The admin panel keeps Payload's native login unchanged.

### Architecture

- **Credential check:** `/api/v1/auth/login` calls Payload's Local API `login` (email/password) to verify credentials and email verification. We do not use the token Payload returns for learners.
- **Access tokens:** we sign them ourselves with `jose`, HS256, `JWT_SECRET`, TTL **15 minutes**. Claims: `sub` (user id), `role`, `aud` (`web` | `mobile`), `iat`, `exp`.
- **Payload integration:** a custom Payload auth strategy on `Users` verifies our access token (from the `access_token` cookie or an `Authorization: Bearer` header) and sets `req.user`, so Payload access functions and our route handlers see the same user.
- **Refresh tokens:** opaque random 32-byte values, stored only as SHA-256 hashes in `RefreshTokens`. TTL **7 days** (web) and **30 days** (mobile).
- **Rotation:** every refresh revokes the old token and issues a new one in the same `familyId`. If a revoked token is presented again, revoke the whole family (token theft signal).
- **Google OAuth:** authorization-code flow with PKCE and `state`. Exchange the code at Google's token endpoint, verify the ID token with `jose` against Google's JWKS, then find or create the user by `googleSub` (or link by verified email). Mobile will use the same verification path with a native-obtained ID token (`POST /api/v1/auth/google/mobile`).
- **Admins:** Payload native auth at `/admin` with `PAYLOAD_SECRET`. `JWT_SECRET` and `PAYLOAD_SECRET` are different values.

### Transport

1. **Web** — `access_token` and `refresh_token` as httpOnly, `Secure`, `SameSite=Lax` cookies. The refresh cookie is scoped to `/api/v1/auth`. Next.js middleware refreshes an expired access token server-side when a valid refresh cookie exists.
2. **Mobile** — `Authorization: Bearer <accessToken>`; refresh token stored in the OS secure store and sent in the body of `POST /api/v1/auth/refresh`.

### Rules

- **Never** expose `JWT_SECRET` or `PAYLOAD_SECRET` to the client.
- All `/api/v1/me/*` routes and all `/api/v1/questions/*` routes require auth. Other public content routes require no auth.
- Logout revokes the refresh token family for that device.
- `DELETE /api/v1/me` deletes the account, its `AnswerEvents` and its `RefreshTokens` (App Store account-deletion requirement).
- Apple Sign-In will be added when the iOS app ships (App Store requirement). Add it to this doc when we do.

### Roles & Access

- `learner`: read public content, read questions, write own `AnswerEvents` via the answer endpoint, read/update own profile, use flashcards (client state).
- `admin`: everything, including Payload admin panel at `/admin` and all collections.
- Enforce access in **both** Payload collection `access` functions (plus field-level access where noted) **and** API route handlers. Never rely on the client.

---

## 6. API Design

### Two API surfaces

1. **Payload's auto-generated REST API** — mounted at **`/api/cms/*`** (`routes.api: '/api/cms'`, with the generated route folder moved to match) so it can never collide with `/api/v1`. Used by the admin panel. Not part of the mobile contract. **GraphQL is disabled** (`graphQL: { disable: true }`).
2. **App API** (custom Next.js route handlers under `app/api/v1/`) — used by the web app _and_ mobile. **This is the contract for mobile.**

### App API conventions

- Base path: `/api/v1/*`.
- All responses are JSON: `{ data: T }` or `{ error: { code, message, details? } }`.
- Pagination: cursor-based for lists (`?cursor=...&limit=20`), max `limit=100`. Lists return `{ data: T[], nextCursor: string | null }`.
- All request bodies and query params validated with **Zod schemas from `packages/shared`**. Never trust `req.body` shapes.
- All handlers return typed responses (types derived from Zod schemas).
- Errors: use the `ApiError` helper. HTTP codes: `400` validation, `401` unauth, `403` forbidden, `404` not found, `429` rate-limited, `500` server.
- **Rich text** is returned as `{ html: string }` rendered on the server with Lexical's HTML converter. Raw Lexical JSON is not part of the contract.
- **Mobile-specific shapes**: mobile clients pass `?client=mobile`; the API returns lighter payloads (e.g., flashcards omit `back` until revealed; lecture lists omit `body`). If a shape diverges meaningfully, prefer a dedicated endpoint (e.g., `/api/v1/mobile/flashcards`).

### Endpoints (v1)

- Public: `GET /domains`, `GET /domains/:slug`, `GET /topics`, `GET /lectures`, `GET /lectures/:slug`, `GET /papers`, `GET /papers/:slug`, `GET /videos`, `GET /videos/:slug`, `GET /flashcards?topic=&domain=`, `GET /flashcards/:id/back`, `GET /questions/stats` (public counts per domain/topic only).
- Auth: `POST /auth/register`, `POST /auth/login`, `POST /auth/logout`, `POST /auth/refresh`, `POST /auth/verify-email`, `POST /auth/forgot-password`, `POST /auth/reset-password`, `GET /auth/google`, `GET /auth/google/callback`, `POST /auth/google/mobile`.
- Authenticated: `GET /me`, `PATCH /me`, `DELETE /me`, `GET /me/analytics`, `GET /me/questions/next?domains=&topics=&filter=unused|incorrect|all`, `GET /questions/:id`, `POST /questions/:id/answer`.

**Answer submission flow (critical):**
`GET /questions/:id` and `GET /me/questions/next` must **never** include `choices[].isCorrect`, `choices[].explanation` or `overallExplanation`. Only `POST /questions/:id/answer` returns the verdict + explanations, and it also writes an `AnswerEvent`. Do not leak correctness in any GET payload, even to authenticated users (prevents cheating via network inspection). An integration test asserts this for every GET route.

---

## 7. Caching Strategy

**Principle: public content is cached at the edge aggressively; user-specific and login-gated data is never cached publicly.**

- Use the caching APIs of the pinned Next.js version (on Next 16: `'use cache'` + `cacheTag`, and `revalidateTag` with its current signature). Check the signature when scaffolding; do not copy older examples.
- **Public content reads** (`lectures`, `papers`, `videos`, `flashcards`, `domains`, `topics`, `questions/stats`) use the Data Cache with **tag-based invalidation**.
  - Every fetch of a public resource sets tags like: `lecture:<slug>`, `lectures`, `domain:<slug>`, `content`.
  - Response headers: `Cache-Control: public, s-maxage=60, stale-while-revalidate=300` (tune per resource).
- **On publish**: a Payload `afterChange` hook (and `afterDelete`) on each content collection calls tag revalidation for the item-level tag and the collection-level tag. No manual cache busting.
- **Known staleness:** tag revalidation updates the Data Cache and pages immediately, but API responses already cached at Vercel's edge via `s-maxage` can stay stale for up to `s-maxage` (60s). This is accepted.
- **Question reads require auth**, so `GET /questions/:id` and `GET /me/questions/next` are `private, no-store`. Only aggregate counts (`/questions/stats`) are public.
- **Authenticated responses** (`/api/v1/me/*`, `/api/v1/auth/*`) set `Cache-Control: private, no-store`.
- **Question answer submissions** are never cached.
- **Revalidation granularity**: prefer item-level tags (`lecture:my-slug`) so a single edit doesn't invalidate the whole collection. Collection-level tags (`lectures`) are for index pages only.
- **Do not add a CDN layer** beyond Vercel's built-in edge caching in v1.

---

## 8. Content Access Tiers (forward-compatible)

All content collections have `accessTier: 'free' | 'premium'`. In v1, **all content is `free`** and tier checks are a no-op. The field exists so that gating can be turned on later without a schema migration.

- The API access-control layer has a single function `assertCanRead(user, resource)` — implement tier logic here _only_, not scattered across handlers. (The login requirement for questions is route-level auth, not tier logic.)
- Client code must never assume premium content exists; treat all tiered content uniformly.

---

## 9. Spaced Repetition (Flashcards)

**v1 decision: client-side scheduling, no server sync.** (Confirmed: losing progress across devices is accepted for v1.)

- The web flashcards UI (and later the mobile app) implements **SM-2** locally and persists per-card review state in device storage (IndexedDB on web, SQLite on mobile).
- The web UI shows a clear notice that progress is saved in this browser only.
- The backend **does not** store card review state in v1, so:
  - There is **no** `CardReviewState` collection yet.
  - There are **no** review endpoints yet.
- **Design constraint:** every flashcard returned by the API must include a stable, permanent `id` (UUID) and `updatedAt`. Review state is keyed by `id`. This makes a future migration to server-side sync possible without breaking existing clients.
- **When we add sync later**, the plan is a `CardReviewState` collection keyed by `(user, card)` plus a `POST /api/v1/me/card-reviews/batch` endpoint. Do not build this now; do not design around it beyond stable IDs.

---

## 10. Conventions

### TypeScript

- `strict: true`, `noUncheckedIndexedAccess: true`.
- No `any`. Use `unknown` + Zod parsing at boundaries.
- DTO types are **derived from Zod schemas** (`z.infer<typeof LectureSchema>`), never hand-duplicated.

### Next.js

- App Router only. No `pages/`.
- Server Components by default. `'use client'` only when needed (interactivity, browser APIs).
- Server Components read content through `src/server/` query functions (Payload Local API). Client components call `/api/v1` through `packages/api-client`.
- Route handlers under `app/api/` return `Response`/`NextResponse` objects; no Express-style `res`.
- All env access via a single `env.ts` module validated with Zod at boot. No `process.env` anywhere else.

### Payload

- Collections are defined in `apps/web/src/collections/*.ts` and registered in `payload.config.ts`.
- All content collections use drafts (`versions: { drafts: true }`). The **public API only ever reads published content**: non-admin `access.read` returns `{ _status: { equals: 'published' } }`, and the custom API layer queries with `draft: false`.
- Use Payload **hooks** for side effects (revalidation, denormalization, derived fields). No side effects in React components.

### Styling & UI

- Tailwind CSS (v4) for the web app.
- No component library in v1; build minimal primitives. Do not add one without updating §2.
- Medical disclaimer in the site footer; Terms and Privacy pages before public launch.
- Mobile styling is out of scope here (separate repo).

### Testing

- Unit tests with **Vitest** for `packages/shared` (schemas), SM-2, and server utilities.
- Integration tests for the custom API layer using **Vitest + a test Postgres** (Neon branch or local Postgres in CI).
- Required integration tests: no GET route leaks question correctness; Payload REST (`/api/cms/questions`) does not return protected fields to non-admins; refresh rotation and reuse detection; publish hooks call revalidation.
- **No tests for Payload collections' internals** — trust Payload; test our code.
- E2E with Playwright is deferred to v2.

### Commit & PR conventions

- Conventional Commits (`feat:`, `fix:`, `chore:`, `docs:`, `refactor:`).
- Small PRs. One concern per PR. Update `AGENTS.md` when an architectural decision changes.

---

## 11. Environment Variables

Validated at boot in `env.ts` (also imported by `next.config.ts`, so a bad env fails the build). A variable stays optional in `env.ts` until the phase that first uses it, then becomes required: Phase 1 needs `DATABASE_URL`, `DATABASE_URL_UNPOOLED`, `PAYLOAD_SECRET` and `NEXT_PUBLIC_SITE_URL`; Phase 2 adds `BLOB_READ_WRITE_TOKEN`; Phase 4 adds the auth and email variables.

| Variable                | Purpose                                                               |
| ----------------------- | --------------------------------------------------------------------- |
| `DATABASE_URL`          | Neon pooled connection string (runtime)                               |
| `DATABASE_URL_UNPOOLED` | Neon direct connection string (migrations)                            |
| `PAYLOAD_SECRET`        | Payload's own signing secret (admin panel)                            |
| `JWT_SECRET`            | Learner access-token signing secret (different from `PAYLOAD_SECRET`) |
| `BLOB_READ_WRITE_TOKEN` | Vercel Blob storage                                                   |
| `GOOGLE_CLIENT_ID`      | Google OAuth                                                          |
| `GOOGLE_CLIENT_SECRET`  | Google OAuth                                                          |
| `RESEND_API_KEY`        | Transactional email                                                   |
| `EMAIL_FROM`            | Sender address for transactional email                                |
| `NEXT_PUBLIC_SITE_URL`  | Canonical site URL (SEO, OAuth redirect, email links)                 |

Required from Phase 7:

| Variable                   | Purpose          |
| -------------------------- | ---------------- |
| `UPSTASH_REDIS_REST_URL`   | Rate-limit store |
| `UPSTASH_REDIS_REST_TOKEN` | Rate-limit store |

- **Never** commit secrets. `.env` and `.env*.local` are gitignored; `apps/web/.env.example` lists every variable with no secret values.
- **Never** prefix a secret with `NEXT_PUBLIC_`. Only public config values get that prefix.

---

## 12. Deployment

- **Single Vercel project** for `apps/web` (Next.js + Payload share one deployment).
- **Neon Postgres** via Vercel integration. Use a **branch** for staging and a **branch** for production.
- **Vercel Blob** for media.
- **Preview deployments** on every PR. Preview env points to a Neon preview branch.
- **Migrations**: Payload's Postgres adapter runs migrations against `DATABASE_URL_UNPOOLED`; commit migration files. Do not run destructive migrations on production without a backup branch.
- **CI** (GitHub Actions) runs `pnpm typecheck`, `pnpm lint` and `pnpm test` on every PR. The build fails if typecheck or lint fails.

---

## 13. Build Phases

Each phase is shippable and tested before moving on.

### Phase 0 — Spec

- This document reflects all confirmed decisions.

### Phase 1 — Foundation

- Monorepo scaffold (pnpm + Turborepo), `packages/config`, strict TypeScript, ESLint + Prettier.
- `apps/web` with Next.js + Payload running against Neon Postgres, `idType: 'uuid'`, Payload REST at `/api/cms`, GraphQL disabled.
- `env.ts` with Zod validation and `.env.example`.
- `Users` collection with roles; admin login working; `/admin` gated on `role === 'admin'`.
- `packages/shared` with domain enums and the base response/error/pagination schemas.
- CI and preview deployments on Neon preview branches.
- **Exit:** an admin can log in to `/admin` on a preview deployment.

### Phase 2 — CMS & Content Model

- All collections implemented (§4) with drafts, access controls and field-level access.
- Hooks: domain denormalization, exactly-one-correct validation, choice labels, video URL validation/provider/thumbnail, slug generation, publish → tag revalidation.
- Media uploads via Vercel Blob.
- Dev seed script with sample content for every type.
- Zod schemas in `packages/shared` for every content DTO.
- **Exit:** every content type can be authored and published in admin; tests confirm revalidation fires and `/api/cms/questions` never returns protected fields to non-admins.

### Phase 3 — Public Web App & Read API

- Domains/topics index pages.
- Lectures, Papers, Videos list + detail pages (SSR/SSG with tag caching).
- SEO: metadata per page, sitemap, robots, JSON-LD.
- Public read API (`/api/v1/...`) for domains, topics, lectures, papers, videos, flashcards and question stats, with mobile-friendly shapes and server-rendered rich-text HTML.
- `packages/api-client` created with methods for every endpoint built so far.

### Phase 4 — Learner Auth

- Start with a spike that proves the custom Payload auth strategy + `jose` access tokens + refresh rotation end to end.
- Email/password registration with verification, login, logout, forgot/reset password (Resend).
- Google OAuth (web flow + mobile ID-token endpoint).
- Cookies on web, Bearer on mobile; middleware refresh on web.
- `/api/v1/me` (`GET`, `PATCH`, `DELETE`) and `/api/v1/auth/*`.
- Refresh token rotation, family revocation and reuse detection.
- Web: sign-up, sign-in, account pages.

### Phase 5 — Question Bank & Analytics

- `GET /api/v1/questions/:id` and `GET /api/v1/me/questions/next` (auth required, no correctness).
- `POST /api/v1/questions/:id/answer` with verdict + explanations; writes `AnswerEvents` with denormalized `domain`/`topic` and `isFirstAttempt`.
- `GET /api/v1/me/analytics`: per-domain accuracy (first attempts, rolled up to top-level domains), counts answered, weakest domains (minimum 10 answered).
- Web: tutor-mode practice UI (choose domains/topics and filter, answer, see explanations, next) and an analytics page.
- **Exit:** integration test proves no GET route leaks correctness.

### Phase 6 — Flashcards (web UI)

- Flashcard study UI on web using local IndexedDB state + in-house SM-2.
- Reveal endpoint (`/api/v1/flashcards/:id/back`).
- "Saved in this browser" notice. No server sync.

### Phase 7 — Hardening

- Rate limiting (Upstash) on auth endpoints and the answer endpoint.
- CORS for mobile only if needed (native apps don't trigger CORS; if a future hybrid does, allowlist precisely).
- Versioned API guarantees documented; `packages/api-client` interface frozen for mobile.
- Security review; Terms, Privacy and medical disclaimer in place.

**Out of scope for v1** (explicitly): mobile app itself, Apple Sign-In, payments/gating, server-side flashcard sync, full-text search, timed/block question mode, peer percentile comparisons, content importers, E2E tests, Sentry wiring.

---

## 14. Things Agents Must Not Do

- ❌ Add a dependency not listed in §2 without updating §2 in the same PR.
- ❌ Return `isCorrect` or explanations from any `GET` endpoint, or remove the field-level access that hides them on Payload REST.
- ❌ Import Payload server code into client components or into `packages/*`.
- ❌ Cache authenticated or login-gated responses (`/api/v1/me/*`, `/api/v1/questions/:id`) publicly.
- ❌ Use `process.env` outside `env.ts`.
- ❌ Store refresh tokens in plain text or reuse `PAYLOAD_SECRET` as `JWT_SECRET`.
- ❌ Build mobile app features in this repo — the mobile app is a separate repo consuming `packages/api-client`.
- ❌ Add server-side flashcard review state. Client-side only in v1.
- ❌ Break API response shapes without bumping `/api/v1` to `/api/v2` or adding a `client=mobile` variant.
- ❌ Skip Zod validation on any API input.
- ❌ Change the primary-key type after the first migration.

---

## 15. Decisions & Assumptions

**Confirmed (2026-11-22):**

- Web ships a tutor-mode question bank and analytics page in v1 (no timed blocks).
- Questions require login to read and answer.
- Flashcard progress is local-only in v1.

**Defaults in effect (override by editing this section):**

- **Content:** authored by hand in Payload admin. No importers; a dev seed script only.
- **Papers:** spark notes are admin-written. Citation metadata (`citationCount`, `leadAuthorHIndex`, `doi`, `pubmedUrl`) is manually entered. No external API integration in v1.
- **Videos:** embedded via YouTube/Vimeo URL. No watch-progress tracking in v1.
- **Roles:** one editorial role (`admin`).
- **Analytics:** a learner's own results only; no peer comparison.
- **Scale target:** ~10k DAU, low-thousands of items per content type. Paginated APIs, indexed queries, tag-based caching. No premature scaling.
- **Monetization:** all content free in v1. `accessTier` reserved for future gating; `assertCanRead` is the single gate.
- **Languages:** English only in v1.
- **Search:** none in v1; domain/topic filtering only. Postgres full-text search is the first option when added.
