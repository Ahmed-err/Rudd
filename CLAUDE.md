# CLAUDE.md — Project Rules

## Stack
- **Next.js 15** (App Router, RSC) · **TypeScript strict** · **pnpm** workspaces
- **Drizzle + Neon Postgres** · **Clerk** (auth + orgs) · **Inngest** (async) · **shadcn/ui + Tailwind**
- **OpenAI Assistants API** (threads + function calling) · **Meta WhatsApp Cloud API** (direct)

## Code Style
- Arrow functions everywhere; no `function` declarations except for `async function` Next.js route handlers where required.
- Strict TypeScript: `noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`, `noImplicitOverride`. Zero `any`.
- Zod is the single source of truth for all runtime shapes: API payloads, env vars, OpenAI tool schemas. Derive TS types from Zod (`z.infer`).
- Server-only modules must have `import "server-only"` at the top. Never import server code into client components.
- No default exports except for Next.js page/layout/route files (required by the framework).
- Functional React components with explicit return types. No class components.
- Keep comments to a minimum — only add them when the WHY is non-obvious.

## Multi-tenancy Rules
- Every DB table has a `tenant_id` column referencing `tenants.id`.
- All queries must be scoped with `withTenant(tenantId)` helper from `packages/db`.
- Never query without a tenant scope — this is a hard rule to prevent data leaks.
- `tenantId` is always derived from the authenticated Clerk org, never from request body/params.

## Async / Reliability Rules
- WhatsApp webhook handlers must return `200` in <500ms. Enqueue to Inngest immediately; do all AI/calendar/DB work inside the Inngest function.
- Use Inngest `step.run()` boundaries for every distinct external call (OpenAI, GCal, WhatsApp send). Each step retries independently.
- Use `wa_message_id` as idempotency key to prevent double processing of Meta retries.
- Never use `setTimeout` or polling loops inside Next.js route handlers.

## Security Rules
- Verify `X-Hub-Signature-256` on every POST to `/api/webhooks/whatsapp` using timing-safe comparison.
- Verify Clerk webhook signature on every POST to `/api/webhooks/clerk`.
- Google + WhatsApp access/refresh tokens are stored AES-GCM encrypted using `ENCRYPTION_KEY`; use `server/crypto.ts`.
- Validate all env vars at startup via `lib/env.ts` (Zod). App must crash early if required vars are missing.
- Never log tokens, secrets, or PII.

## Directory Map
```
apps/web/src/
  app/                  Next.js App Router (pages, layouts, route handlers)
  components/ui/        shadcn/ui primitives (auto-generated, do not hand-edit)
  features/             Feature modules (conversations, appointments, settings)
  server/               Server-only code: agent, whatsapp, calendar, inngest, crypto
  lib/                  Shared utilities safe for both server + edge (env, utils)
packages/db/            Drizzle schema, migrations, client
packages/shared/        Zod schemas and TS types shared across packages
```

## Testing
- Unit tests with **Vitest**. Place test files adjacent to source: `foo.ts` → `foo.test.ts`.
- Critical pure functions that must have tests: signature verification, token encryption/decryption, all Zod schemas.
- E2E with **Playwright** for the booking flow.

## Commands
```bash
pnpm dev              # start Next.js dev server
pnpm test             # run vitest
pnpm typecheck        # tsc --noEmit across all packages
pnpm lint             # biome lint
```
