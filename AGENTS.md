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

- **Web app** (Next.js, SSR/SSG). **Members only** (see §15): a visitor who is not signed in sees the home page, the sign-in and account-recovery pages and nothing else; every other page needs a learner account. The `/api/v1` content endpoints are still readable without one (§6).
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
| Caching         | Next.js Data Cache (`unstable_cache`) + tag revalidation on publish (Payload hooks); ISR for pages      |
| Styling         | Tailwind CSS v4                                                                                         |
| Testing         | Vitest (`pg` is a dev dependency only, used by the integration-test harness)                            |
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
│        │  ├─ (frontend)/          public site (site), sign-in/sign-up without navbar (auth)
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
- `emailVerified` — stored as Payload's own `_verified` field (Payload's `verify` flow sets it); the API exposes it as `emailVerified`. Accounts made by the first-user screen, by an admin, or through Google are verified from the start; accounts that sign up through the public API are not until they use the emailed link.
- A signed-in non-admin can never change their own `email` or `_verified` (a `beforeChange` hook restores them), so an account cannot be pointed at someone else's address and later linked to that person's Google sign-in.
- Access: learners can read/update self (never their own `role`); admins full access.
- Admins are `Users` with `role: 'admin'`. Payload admin panel access is gated on `role === 'admin'`. There is no separate `Admins` collection and only one editorial role in v1.
- The first account ever created becomes an admin; every later one is a `learner`.
- Deleting a user first deletes their `AnswerEvents` and `RefreshTokens` (a `beforeDelete` hook, because the foreign keys are nulled once the row is gone).

### `Domains`

The canonical taxonomy for organizing everything (e.g., Cardiology, Pharmacology, Pathology).

- `name` (required)
- `slug` (unique, required)
- `description`
- `parent` (self-relation, optional — supports sub-domains; max depth 2, enforced on save)
- `order` (number, for display)
- No drafts: taxonomy is public as soon as it is saved. Cannot be deleted while topics, sub-domains, lectures, papers or videos use it.

### `Topics`

Finer-grained categorization for flashcards and questions.

- `name`, `slug` (unique), `domain` (relation → Domains, required), `order`
- No drafts. Cannot be deleted while flashcards or questions use it.
- Moving a topic to another domain updates the denormalized `domain` on its flashcards and questions directly in the database (no validation, no new versions).

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
- `embedUrl` (YouTube or Vimeo only, validated on publish and normalized on save to `youtube-nocookie.com/embed/<id>` or `player.vimeo.com/video/<id>`; any other host is rejected, so only vetted providers are ever put in an iframe)
- `provider` — `youtube` | `vimeo` | `other` (derived from `embedUrl`; `other` is reserved and not accepted yet)
- `providerVideoId` (derived; the API builds the YouTube thumbnail from it when no `thumbnail` is uploaded)
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
- `firstAttemptKey` (hidden, unique, nullable text: `<user>:<question>` on a first attempt, null otherwise. The unique constraint is what makes two simultaneous first submissions record one first attempt and one repeat.)
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

- **Credential check:** `/api/v1/auth/login` calls Payload's Local API `login` (email/password) to verify credentials and email verification. We do not use the token Payload returns for learners. Payload counts failures and locks an account for 10 minutes after 5 wrong passwords. It checks the password before the verification flag, so an unconfirmed account is never revealed to someone who does not know its password.
- **Access tokens:** we sign them ourselves with `jose`, HS256, `JWT_SECRET`, TTL **15 minutes**. Claims: `sub` (user id), `role`, `aud` (`web` | `mobile`), `iat`, `exp`.
- **Payload integration:** a custom Payload auth strategy on `Users` verifies our access token (from the `access_token` cookie or an `Authorization: Bearer` header) and sets `req.user`, so Payload access functions and our route handlers see the same user.
- **Refresh tokens:** opaque random 32-byte values, stored only as SHA-256 hashes in `RefreshTokens`. TTL **7 days** (web) and **30 days** (mobile).
- **Rotation:** every refresh revokes the old token and issues a new one in the same `familyId`, in one database transaction, with a single `UPDATE ... WHERE revoked_at IS NULL` (written with the drizzle table, not Payload's `update({ where })`, which reads before it writes) so that of two simultaneous requests exactly one rotates. If a revoked token is presented again, revoke the whole family (token theft signal).
- **Duplicate-refresh grace:** a token rotated less than 10 seconds ago (`REFRESH_REUSE_GRACE_SECONDS`) is not treated as theft: browsers fire parallel requests that all refresh with the same cookie when the access token has just expired. Inside the window it mints a new _access_ token only, never a new refresh token, and only while the family still has a live token (a logout in between still wins). Older reuse revokes the family.
- **Google OAuth:** authorization-code flow with PKCE (S256), `state` and `nonce`, kept in a 10-minute httpOnly cookie scoped to `/api/v1/auth/google`. Exchange the code at Google's token endpoint, verify the ID token with `jose` against Google's JWKS (RS256 only, issuer, audience, expiry, `nonce`, and `email_verified` must be true), then find the user by `googleSub`, else link by email, else create a confirmed learner (provider `google`, random unusable password). Linking to an account that was never confirmed replaces its password and revokes its sessions, so whoever registered the address first loses access; an address already linked to a different Google account is refused. Mobile uses the same verification with a native-obtained ID token (`POST /api/v1/auth/google/mobile`), accepting `GOOGLE_CLIENT_ID` and `GOOGLE_MOBILE_CLIENT_IDS` as audiences. Every failure on the browser flow ends on `/sign-in?error=...`, never raw JSON. `returnTo` must be a same-site path.
- **Admins:** Payload native auth at `/admin` with `PAYLOAD_SECRET`. `JWT_SECRET` and `PAYLOAD_SECRET` are different values.

### Transport

1. **Web** — `access_token` and `refresh_token` as httpOnly, `Secure`, `SameSite=Lax` cookies. The refresh cookie is scoped to `/api/v1/auth`. A third, non-httpOnly cookie `signed_in=1` (no secret, lives as long as the refresh cookie) lets the header show "Account" or "Sign in" without a request, so public pages stay static.
   - **Page refresh (decided):** because the refresh cookie is invisible outside `/api/v1/auth`, Next's `proxy.ts` (Next 16's middleware) cannot refresh by itself. For pages that need a signed-in user (matcher in `src/proxy.ts`, today `/account`) it checks the access token's signature and, if it is missing or expired, redirects to `GET /api/v1/auth/refresh?next=<path>`. That endpoint rotates the cookies and redirects back, or to `/sign-in?next=<path>` when there is nothing to renew. `next` must be a same-site path. The same proxy keeps signed-in visitors off the guest pages (`/sign-in`, `/sign-up`, `/forgot-password`): a valid access token sends them to `?next=` or `/account`; an expired one with the `signed_in` hint goes through the refresh endpoint first, and a visit that already carries `?next=` is left alone so a failed refresh cannot loop. Client components get the same effect from `packages/api-client`, whose `refresh` option renews once (shared by concurrent requests) on a 401 and retries.
2. **Mobile** — `Authorization: Bearer <accessToken>`; refresh token stored in the OS secure store and sent in the body of `POST /api/v1/auth/refresh`.

### Rules

- **Never** expose `JWT_SECRET` or `PAYLOAD_SECRET` to the client.
- All `/api/v1/me/*` routes, all `/api/v1/questions/*` routes (counts included) and every content route (domains, topics, lectures, papers, videos, flashcards) require auth: a missing or invalid token is a `401`. Only `/auth/*` (sign-in, registration, recovery) and `/health` are open (§15).
- Logout revokes the refresh token family for that device.
- `DELETE /api/v1/me` deletes the account, its `AnswerEvents` and its `RefreshTokens` (App Store account-deletion requirement). Accounts with a password (`provider: 'email'`) must send it to confirm, and a wrong guess counts towards the lockout. Google-only accounts have no password to confirm.
- **No account enumeration:** register and forgot-password answer `202 { ok: true }` whether or not the address has an account; a wrong password and an unknown address give the same `401 invalid_credentials`. Register for an unconfirmed address re-sends the link and changes nothing else; for a confirmed address it does nothing.
- **Reasons:** auth failures carry `error.details.reason`: `invalid_credentials`, `email_not_verified`, `account_locked`, `invalid_token`, `token_reused`, `google_unavailable`. Clients may react to them; messages are not a contract.
- **CSRF:** cookie-authenticated state-changing routes refuse `Sec-Fetch-Site: cross-site` and a foreign `Origin`, and require `Content-Type: application/json` (a cross-site form cannot send it). Requests with neither header (mobile, curl, server calls) pass because they carry no ambient cookies. Bodies are capped at 16 KB.
- Resetting a password revokes every refresh token of the account and confirms the address.
- The access token's `role` claim is informational. Every request re-reads the user, so deleting or demoting an account takes effect at once.
- **Rate limits (Phase 7):** `src/server/rate-limit.ts` holds every rule in `RATE_RULES`. Per client IP: login (10 per 5 minutes), register and forgot-password (5 per hour), reset-password and verify-email (10 per 15 minutes), refresh (120 per minute), Google sign-in (20 per 10 minutes). Per email address in the body, so one mailbox cannot be flooded from many IPs: register and forgot-password (3 per hour). Per signed-in user: the answer endpoint (60 per minute), account deletion (5 per 15 minutes) and a general cap of 240 requests per minute inside `requireUser`, so a real account cannot be used to scrape the content. Payload's own credential routes (`POST /api/cms/users/login`, `forgot-password`, `reset-password`, `unlock`, `first-register`, `verify/*`) are limited to 10 per 5 minutes per IP in `proxy.ts`, which is matched on `/api/cms/users/:path*` for that purpose. Over a limit is `429 rate_limited` with `Retry-After` and `details.retryAfterSeconds`; browser redirects (Google, the refresh redirect) land on `/sign-in` instead of showing JSON. Limits count requests, including failures, and apply whether or not an account exists, so they reveal nothing about who has one.
- **Rate-limit store:** Upstash Redis through `@upstash/ratelimit` (sliding window), required on Vercel preview and production. Keys are SHA-256 hashes, so neither IPs nor emails are stored there. Without Upstash variables (local development) a per-process in-memory window is used, which is only correct for one server. Limits are off under `NODE_ENV=test`; tests switch them on with `rateLimitTesting`. If Redis is unreachable the request is let through and the error is logged (fail open: a limiter outage must not take sign-in down). The client address is `x-real-ip`, else the first `x-forwarded-for` entry; Vercel sets both at its edge, so a caller cannot choose its own, but behind any other proxy they are only as trustworthy as that proxy.
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
- Pagination: cursor-based for lists (`?cursor=...&limit=20`), max `limit=100`. Lists return `{ data: T[], nextCursor: string | null }`. Cursors are opaque keyset cursors (the sort values of the last item plus its id), so pages stay correct while content changes; a malformed cursor, or one made for a different sort order, is a `400`. Domains and topics are small and bounded, so they return everything with `nextCursor: null`.
- List sort orders: lectures and videos by `updatedAt` descending, papers by title, flashcards by `createdAt`, domains and topics by `order` then name. Every sort ends with `id` as a tiebreaker.
- All request bodies and query params validated with **Zod schemas from `packages/shared`**. Never trust `req.body` shapes.
- All handlers return typed responses (types derived from Zod schemas).
- Errors: use the `ApiError` helper. HTTP codes: `400` validation, `401` unauth, `403` forbidden, `404` not found, `429` rate-limited, `500` server.
- **Rich text** is returned as `{ html: string }` rendered on the server with Lexical's HTML converter. Raw Lexical JSON is not part of the contract.
- **Mobile-specific shapes**: mobile clients pass `?client=mobile`; the API returns lighter payloads. Today that means flashcard lists omit `back` (the web shape includes it); fetch it per card from `GET /flashcards/:id/back`. Lecture and paper lists never include bodies or abstracts for any client, and the video list leaves out `description` (a `VideoSummary`; the detail endpoint returns the full `Video`). The mobile app does not exist yet, so the video list shape was changed before any client depended on it. If a shape diverges meaningfully, prefer a dedicated endpoint (e.g., `/api/v1/mobile/flashcards`). Returning lecture bodies "in chunks" is not built.
- A slug or id that is malformed or unknown, or whose document is a draft, is a `404`, never a `400`.

### Endpoints (v1)

- Content (sign-in required, §15): `GET /domains`, `GET /domains/:slug`, `GET /topics`, `GET /lectures`, `GET /lectures/:slug`, `GET /papers`, `GET /papers/:slug`, `GET /videos`, `GET /videos/:slug`, `GET /flashcards?topic=&domain=`, `GET /flashcards/:id/back`, `GET /questions/stats` (counts per domain/topic only). `GET /health` is open.
- Auth: `POST /auth/register`, `POST /auth/login`, `POST /auth/logout`, `POST /auth/refresh`, `POST /auth/verify-email`, `POST /auth/forgot-password`, `POST /auth/reset-password`, `GET /auth/google`, `GET /auth/google/callback`, `POST /auth/google/mobile`, and `GET /auth/refresh?next=` (browser page navigations only, see §5; not part of the mobile contract).
- Authenticated: `GET /me`, `PATCH /me`, `DELETE /me`, `GET /me/analytics`, `GET /me/questions/next?domains=&topics=&filter=unused|incorrect|all`, `GET /questions/:id`, `POST /questions/:id/answer`.
  - `next` takes comma-separated slugs. A domain includes its sub-domains; `domains` and `topics` together must both match; an unknown slug matches nothing. `filter` defaults to `unused` (never answered); `incorrect` means the latest answer to the question was wrong. It returns `{ question, remaining }` with a random matching question, or `question: null`. The pool is chosen in memory from ids only, which is fine at the target scale (§15).
  - `POST .../answer` takes `{ selectedLabel }`, returns the verdict, every explanation, the citations and `isFirstAttempt`, and writes an `AnswerEvent`. A label the question does not have is a `400`. A draft, unknown or malformed question id is a `404`.
  - `GET /me/analytics` returns `totals` (all attempts, distinct questions answered, correct, accuracy or null), `byDomain` (top-level domains with sub-domains rolled in, first attempts only) and `weakest` (up to three lowest-accuracy domains with at least 10 first attempts).

**Answer submission flow (critical):**
`GET /questions/:id` and `GET /me/questions/next` must **never** include `choices[].isCorrect`, `choices[].explanation` or `overallExplanation`. Only `POST /questions/:id/answer` returns the verdict + explanations, and it also writes an `AnswerEvent`. Do not leak correctness in any GET payload, even to authenticated users (prevents cheating via network inspection). An integration test asserts this for every GET route.

---

## 7. Caching Strategy

**Principle: the site is members-only (§15), so nothing is cached at a shared edge. Content is cached in Next.js's Data Cache on the server and served as `private, no-store` over HTTP.**

- **Decision (Phase 3): `unstable_cache`, not `'use cache'`.** Next 16.4's bundled docs keep `unstable_cache` as the supported cache for non-`fetch` data and say to keep using it for data that should survive deployments. `'use cache'` needs Cache Components, which means restructuring every page around Suspense and is untested next to Payload's admin in the same app; its entries also do not carry over between deployments. Revisit when Payload documents Cache Components support. `revalidateTag` takes a profile in Next 16: the hooks call `revalidateTag(tag, { expire: 0 })`.
- **Public content reads** (`lectures`, `papers`, `videos`, `flashcards`, `domains`, `topics`, `questions/stats`, sitemap) all go through `cachedQuery()` in `src/server/cache.ts`, used by `src/server/public-queries.ts`. Both the web pages and the `/api/v1` handlers call these functions, so there is one set of queries and one set of tags.
  - Each query is tagged: `content` (everything), its collection (`lectures`), its item (`lecture:<slug>`, `flashcard:<id>`), and `domain:<slug>` / `topic:<slug>` when filtered. Lists and details that embed domain names also carry `domains` (and `topics`), so a rename refreshes them. Tag names come from `src/server/cache-tags.ts`, shared with the publish hooks, and an integration test checks that what a publish invalidates is what the queries are tagged with.
  - `revalidate: 3600` on every cached query and page is only a safety net for a missed invalidation.
  - Response headers: every `/api/v1` response is `Cache-Control: private, no-store`, because every content route needs a signed-in user (§15). A `public, s-maxage` policy existed while content was open and was removed with it; bring it back only together with a public route.
- **Pages**: index pages are static (`revalidate = 3600`); detail pages use an empty `generateStaticParams` and `dynamicParams`, so each is rendered on first request and then cached as ISR. Pages never read `searchParams`, which keeps them static. List pages render the first page on the server and later pages load in the browser through `packages/api-client`.
- **On publish**: a Payload `afterChange` hook (and `afterDelete`) on each content collection calls tag revalidation for the item-level tag and the collection-level tag. No manual cache busting.
- **Known staleness (only if a public policy returns):** tag revalidation updates the Data Cache and pages immediately, but API responses already cached at Vercel's edge via `s-maxage` can stay stale for up to `s-maxage` (60s). This is accepted.
- **Question reads require auth**, so `GET /questions/:id` and `GET /me/questions/next` are `private, no-store`, as is everything else under `/api/v1` except the open auth routes.
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
- Lectures, flashcards, questions, papers and videos use drafts (`versions: { drafts: true }`); domains and topics do not. The **public API only ever reads published content**: non-admin `access.read` returns `{ _status: { equals: 'published' } }`, and the custom API layer queries with `draft: false`. Version history (`readVersions`) is admin-only.
- Use Payload **hooks** for side effects (revalidation, denormalization, derived fields). No side effects in React components.
- **Schema changes go through migrations, never dev push.** `createConfig()` sets `push: false`. After changing a collection run `pnpm --filter @medipedia/web migrate:create <name>`, review the SQL, commit it, then `pnpm --filter @medipedia/web migrate`. Payload refuses to migrate a database that dev push has touched (it records a `dev` row in `payload_migrations`), so keep dev servers on `push: false`.
- Local API calls from scripts, seeds and bulk jobs pass `context: { disableRevalidate: true }` so the revalidation hooks stay quiet outside a Next.js request.
- The Payload config is built by `createConfig()` in `src/config.ts` (`payload.config.ts` only calls it) so tests can build it against another Postgres schema.

### Styling & UI

- Tailwind CSS (v4) for the web app.
- No component library in v1; build minimal primitives. Do not add one without updating §2.
- Medical disclaimer in the site footer; Terms and Privacy pages before public launch.
- Mobile styling is out of scope here (separate repo).
- **Page transitions (decided):** a CSS entrance on the page container (`animate-page-in`: 8px rise and a fade from 55%, 240 ms, compositor-only). Not the View Transitions API / React `<ViewTransition>`: React holds the commit until images in the new page load (up to 800 ms) and freezes the page meanwhile, which makes navigation slower, not smoother. Revisit only if that behaviour changes.

### Testing

- Unit tests (`pnpm test`, `*.test.ts`) with **Vitest** for `packages/shared` (schemas), SM-2, hooks, access functions and server utilities. They never touch a database.
- Integration tests (`pnpm test:int`, `*.int.test.ts`) run against a real Postgres (`DATABASE_URL`): the harness in `src/test/harness.ts` creates a throwaway schema, builds Payload against it and drops it afterwards, so it is safe to run against a dev database. CI runs them against a Postgres service container.
- Required integration tests: no GET route leaks question correctness; Payload REST (`/api/cms/questions`) does not return protected fields to non-admins; refresh rotation and reuse detection; publish hooks call revalidation.
- `src/collections/collections.test.ts` pins the security-relevant collection settings (field-level access, admin-only versions, server-only collections). If it fails, a refactor weakened a rule.
- **No tests for Payload collections' internals** — trust Payload; test our code.
- E2E with Playwright is deferred to v2.

### Formatting and line endings

- Run Prettier from the **repo root** (`pnpm format`, `pnpm format:check`). It reads `.prettierignore` only from the directory it runs in, so running it inside `apps/web` reformats generated files (`importMap.js`, `src/migrations/`, `payload-types.ts`) that must stay as Payload writes them.
- `.gitattributes` pins LF everywhere (`* text=auto eol=lf`), so Windows checkouts and Linux CI agree.

### Commit & PR conventions

- Conventional Commits (`feat:`, `fix:`, `chore:`, `docs:`, `refactor:`).
- Small PRs. One concern per PR. Update `AGENTS.md` when an architectural decision changes.

---

## 11. Environment Variables

Validated at boot in `env.ts` (also imported by `next.config.ts`, so a bad env fails the build). A variable stays optional in `env.ts` until the phase that first uses it, then becomes required: Phase 1 needs `DATABASE_URL`, `DATABASE_URL_UNPOOLED`, `PAYLOAD_SECRET` and `NEXT_PUBLIC_SITE_URL`; `BLOB_READ_WRITE_TOKEN` is optional locally, where uploads fall back to `apps/web/media`, and required on Vercel preview and production (`VERCEL_ENV`); Phase 4 makes `JWT_SECRET` (at least 32 characters, different from `PAYLOAD_SECRET`) required everywhere, and `RESEND_API_KEY` and `EMAIL_FROM` required on Vercel preview and production; locally, without them, emails are written to the server console.

| Variable                    | Purpose                                                                                             |
| --------------------------- | --------------------------------------------------------------------------------------------------- |
| `DATABASE_URL`              | Neon pooled connection string (runtime)                                                             |
| `DATABASE_URL_UNPOOLED`     | Neon direct connection string (migrations)                                                          |
| `PAYLOAD_SECRET`            | Payload's own signing secret (admin panel)                                                          |
| `JWT_SECRET`                | Learner access-token signing secret (different from `PAYLOAD_SECRET`)                               |
| `BLOB_READ_WRITE_TOKEN`     | Vercel Blob storage                                                                                 |
| `GOOGLE_CLIENT_ID`          | Google OAuth                                                                                        |
| `GOOGLE_CLIENT_SECRET`      | Google OAuth (set both or neither; without them Google sign-in is off)                              |
| `GOOGLE_MOBILE_CLIENT_IDS`  | Comma-separated native-app client IDs accepted by `/auth/google/mobile`                             |
| `RESEND_API_KEY`            | Transactional email                                                                                 |
| `EMAIL_FROM`                | Sender address for transactional email                                                              |
| `NEXT_PUBLIC_SITE_URL`      | Canonical site URL (SEO, OAuth redirect, email links)                                               |
| `NEXT_PUBLIC_CONTACT_EMAIL` | Optional. Public address for privacy requests, shown on `/terms` and `/privacy` (set before launch) |

Required from Phase 7:

| Variable                   | Purpose                                                                           |
| -------------------------- | --------------------------------------------------------------------------------- |
| `UPSTASH_REDIS_REST_URL`   | Rate-limit store (set both or neither; required on Vercel preview and production) |
| `UPSTASH_REDIS_REST_TOKEN` | Rate-limit store                                                                  |

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
- Media uploads via Vercel Blob (local disk in development when no token is set).
- Dev seed script with sample content for every type (`pnpm seed`; refuses to run in production).
- Zod schemas in `packages/shared` for every content DTO.
- **Exit:** every content type can be authored and published in admin; tests confirm revalidation fires and `/api/cms/questions` never returns protected fields to non-admins.
- **Done:** all of the above, verified by unit and integration tests. Not yet exercised by hand: authoring in the admin UI and a real Vercel Blob upload.

### Phase 3 — Public Web App & Read API

- Domains/topics index pages.
- Lectures, Papers, Videos list + detail pages (SSR/SSG with tag caching).
- SEO: metadata per page, sitemap, robots, JSON-LD.
- Public read API (`/api/v1/...`) for domains, topics, lectures, papers, videos, flashcards and question stats, with mobile-friendly shapes and server-rendered rich-text HTML.
- `packages/api-client` created with methods for every endpoint built so far.
- **Done:** all of the above. Pages: `/`, `/lectures`, `/papers`, `/videos`, `/domains` and their detail pages, plus `sitemap.xml` and `robots.txt`. Verified by unit tests, by integration tests that run the real route handlers and the typed client against Postgres, by a production build, and by looking at the pages in a browser.
- **Not built (decided):** no topic pages (topics group flashcards and questions, which come in Phases 5 and 6); a domain page lists only content assigned directly to that domain, not its sub-domains' content; no search; no Terms or Privacy pages yet (added in Phase 7); no custom 404 for URLs outside any route group.

### Phase 4 — Learner Auth

- Start with a spike that proves the custom Payload auth strategy + `jose` access tokens + refresh rotation end to end.
- Email/password registration with verification, login, logout, forgot/reset password (Resend).
- Google OAuth (web flow + mobile ID-token endpoint).
- Cookies on web, Bearer on mobile; `proxy.ts` plus a refresh redirect on web (see §5).
- `/api/v1/me` (`GET`, `PATCH`, `DELETE`) and `/api/v1/auth/*`.
- Refresh token rotation, family revocation and reuse detection.
- Web: sign-up, sign-in, forgot/reset password, email confirmation and account pages.
- **Done:** all of the above. Pages: `/sign-up`, `/sign-in`, `/forgot-password`, `/reset-password`, `/verify-email`, `/account`. Verified by unit tests, by integration tests that call the real route handlers against Postgres (registration through deletion, rotation and reuse detection, CSRF, Google with a mocked token endpoint and signed ID tokens), and by walking the flow in a browser (sign-up, confirm, sign-in, rename, wrong-password and correct-password deletion, expired-session redirect).
- **Not exercised:** a real Resend delivery and a real Google sign-in (no credentials configured locally).

### Phase 5 — Question Bank & Analytics

- `GET /api/v1/questions/:id` and `GET /api/v1/me/questions/next` (auth required, no correctness).
- `POST /api/v1/questions/:id/answer` with verdict + explanations; writes `AnswerEvents` with denormalized `domain`/`topic` and `isFirstAttempt`.
- `GET /api/v1/me/analytics`: per-domain accuracy (first attempts, rolled up to top-level domains), counts answered, weakest domains (minimum 10 answered).
- Web: tutor-mode practice UI (choose domains/topics and filter, answer, see explanations, next) and an analytics page.
- **Exit:** integration test proves no GET route leaks correctness.
- **Done (API):** all four endpoints, the shared schemas and the `packages/api-client` methods (`questions.get`, `questions.answer`, `me.nextQuestion`, `me.analytics`), covered by unit tests and by `questions-api.int.test.ts` against Postgres (32 tests, including the no-leak sweep as learner and admin, a race on the first attempt, filters, and analytics roll-up).
- **Done (practice page):** `/practice` (login required: `proxy.ts` matcher plus a server-side check, `noindex`). A client component walks a tutor-mode session through `packages/api-client`: a setup screen (top-level domains with sub-domains rolled in, topics under the chosen domains, and the `unused` / `incorrect` / `all` filter, with counts from the cached question stats), then one question at a time (choose, submit, see the verdict, every choice's explanation, the overall explanation and sources, next). Letters pick a choice, Enter submits and moves on. A repeat answer says it does not change accuracy. A 401 sends the learner to `/sign-in?next=/practice`. Option building lives in `apps/web/src/lib/practice.ts` (unit tested); the Practice nav link has `prefetch: false` because a signed-out prefetch would be redirected through the refresh endpoint. Source links are only clickable for `http(s)` URLs. Verified in the browser as a signed-in learner (filters, wrong and right answers, keyboard, empty state, the `incorrect` filter, repeat note, phone width).
- **Done (analytics page):** `/practice/analytics` (server-rendered; covered by the `/practice/:path*` proxy matcher plus a server-side check; `noindex`; linked from `/practice`). It calls `getAnalytics` directly and shows totals (accuracy, distinct questions answered, all answers), the weakest domains (a note explains the 10-answer minimum when there are none yet), and a bar per top-level domain, weakest first, coloured by band (under 60%, 60 to 79%, 80% and over). Formatting helpers are in `apps/web/src/lib/analytics.ts` (unit tested). Verified in the browser at desktop and phone width with the totals and one domain; the weakest-domains cards were not seen with real data because the sample content has too few questions to reach 10 answers in a domain. **Phase 5 is complete.**

### Phase 6 — Flashcards (web UI)

- Flashcard study UI on web using local IndexedDB state + in-house SM-2.
- Reveal endpoint (`/api/v1/flashcards/:id/back`).
- "Saved in this browser" notice. No server sync.
- **Done:** all of the above. Pages: `/flashcards` (topics that have published cards, grouped by domain, with card counts) and `/flashcards/[topic]` (study session). The study page is a client component: it loads every card of the topic through `packages/api-client` (web shape, so `back` is already in the list and the reveal endpoint is not called on web; it stays for mobile), reads review state from IndexedDB and runs the session. Code lives in `apps/web/src/lib/flashcards/` (`sm2.ts`, `session.ts`, `store.ts`), covered by unit tests; the integration suite covers the new topics query and the sitemap. Verified by walking a session in the browser (reveal, grade, re-queue, finish, reload, reset, phone width).
- **Decisions:** due dates are local calendar days (`"YYYY-MM-DD"`), not timestamps. The four buttons map to SM-2 quality 1, 3, 4 and 5 (Again, Hard, Good, Easy). A missed card restarts at one day with its ease unchanged (SM-2) and comes back after four other cards in the same session. At most 20 new cards start per session; due reviews are never limited. If IndexedDB is unavailable the session runs on an in-memory store and says progress will be lost. Not built: study-ahead of cards that are not due, per-domain study pages, card search.

### Phase 7 — Hardening

- Rate limiting (Upstash) on auth endpoints and the answer endpoint.
- **Done (rate limiting):** all of the above plus the general per-user cap and Payload's admin credential routes; see §5 for the rules and behaviour. Covered by unit tests (`rate-limit.test.ts`, the proxy and `http` tests, the env rules) and by integration tests that call the real handlers (sign-in, mail flooding, registration, answers). **Not exercised:** a real Upstash database (the Redis path is the library's own and was not run here); set the two variables and watch a `429` on the eleventh bad sign-in from one address before relying on it. Rule values are a first guess to tune once there is traffic.
- CORS for mobile only if needed (native apps don't trigger CORS; if a future hybrid does, allowlist precisely).
- Versioned API guarantees documented; `packages/api-client` interface frozen for mobile.
- Security review; Terms, Privacy and medical disclaimer in place.
- **Done (Terms and Privacy):** static `/terms` and `/privacy`, open to signed-out visitors (both are in `PUBLIC_PAGES`, §15; also in the footer, the sitemap and a consent line on the sign-up form). The wording describes what the app does today: that the site is members-only, the data it stores (account, answer history, hashed sessions), the session cookies and the browser-only flashcard progress, the processors (Vercel, Neon, Resend, Google), retention, account deletion, and a minimum age of 16. The contact address comes from the optional `NEXT_PUBLIC_CONTACT_EMAIL`; until it is set the pages say the address is not published yet. `LEGAL_UPDATED` in `apps/web/src/lib/legal.ts` is the "last updated" date and must be bumped with every wording change. **Before public launch:** set the contact address, have a lawyer review both texts (they were drafted, not legally reviewed, and name no company, address or governing law), and re-read them whenever a provider is added. Upstash, which stores hashed IP addresses and email addresses for rate limiting, is named as a provider.

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

**Members only (decided 2026-11-23, replaces "public content"):** signed-out visitors see only the home page (`/`, a static landing page that asks them to sign up or sign in). `proxy.ts` gates every page that is not in its `PUBLIC_PAGES` set (`/`, `/reset-password`, `/verify-email`, `/terms`, `/privacy`) or `GUEST_PAGES` (`/sign-in`, `/sign-up`, `/forgot-password`), so **a new page is members-only unless it is added to that list**. Its matcher covers every page and skips only `/api`, `/admin`, Next internals and files with an extension. A visitor without the `signed_in` hint cookie goes straight to `/sign-in?next=`; one with the hint goes through the refresh endpoint first. The header shows its links only when the hint cookie says signed in, and the sitemap lists the home page only (members-only pages would just redirect a crawler). **Consequences accepted:** lectures, papers, videos, domains and flashcards are no longer indexable by search engines (their JSON-LD and metadata are now moot for crawlers). **API gated too (decided 2026-11-24):** the `/api/v1` content endpoints (`/lectures`, `/papers`, `/videos`, `/domains`, `/topics`, `/flashcards`, `/questions/stats`) need a signed-in user as well, so content cannot be fetched without an account. A missing or invalid token is a `401` and responses are `private, no-store`; the mobile app sends its Bearer token as it already does for `/me`. `assertCanRead` now receives the user. Open: `/auth/*` and `/health`. Web client components call the API through `webApi()`, which renews an expired session once and retries.

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
