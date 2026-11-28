# Rudd — WhatsApp AI Appointment Agent

SaaS platform that lets business owners connect their WhatsApp and Google Calendar so an AI agent can handle bookings and lead qualification automatically.

## Stack

- **Next.js 15** (App Router) — dashboard + webhooks + API in one deploy
- **Clerk** — auth + multi-tenant organizations
- **Neon Postgres + Drizzle** — serverless DB with type-safe queries
- **Inngest** — durable async functions (AI + calendar work runs here, not in webhook handlers)
- **Groq / OpenAI Chat Completions** — function calling for availability, booking and handoff; Whisper for voice notes
- **Meta WhatsApp Cloud API** — direct, no third-party wrapper
- **Google Calendar API** — free/busy + event management

## Getting Started

### Prerequisites

- Node.js 22+
- pnpm 9+ (`npm i -g pnpm@9`)
- A Meta App with WhatsApp product enabled
- A Clerk application
- An OpenAI account
- A Neon database

### Setup

```bash
cp apps/web/.env.example apps/web/.env.local
# fill in the required values (production refuses to start without them)

pnpm install
export DATABASE_URL=...           # drizzle-kit and the seed script read it from the shell
pnpm --filter @rudd/db migrate    # apply migrations in packages/db/migrations
npx inngest-cli@latest dev        # in another terminal: local Inngest Dev Server
pnpm dev                          # starts Next.js on http://localhost:3000
```

**Local Postgres instead of Neon:** when `DATABASE_URL` points at `localhost`, the app uses the standard `pg` driver, so a plain local Postgres works. Leave the Clerk keys unset in development to skip sign-in (the dashboard uses the first tenant). Integration tests in `*.integration.test.ts` run only against a localhost database.

After changing `packages/db/schema.ts`, run `pnpm --filter @rudd/db generate` and commit the new migration; CI fails if the schema and migrations disagree.

### Expose the Webhook Locally

Use [Cloudflare Tunnel](https://developers.cloudflare.com/cloudflare-one/connections/connect-networks/do-more-with-tunnels/trycloudflare/) (no account needed):

```bash
cloudflared tunnel --url http://localhost:3000
```

Copy the `https://...trycloudflare.com` URL.

### Register with Meta

1. Go to [Meta App Dashboard](https://developers.facebook.com) → your app → WhatsApp → Configuration
2. Under **Webhook**, click **Edit**
3. Callback URL: `https://<your-tunnel-url>/api/webhook`
4. Verify token: the value you set for `WHATSAPP_VERIFY_TOKEN` in `.env`
5. Click **Verify and Save**, then subscribe to the **messages** field

### Running Checks

```bash
pnpm test          # vitest (unit)
pnpm typecheck
pnpm lint
```

CI (`.github/workflows/ci.yml`) runs all three plus a migration drift check and a production build.

## How Conversations Flow

1. Meta posts to `/api/webhook`; the signature is verified and the message is queued in Inngest.
2. The Inngest function runs separate, independently retried steps: resolve tenant → transcribe voice note (if any) → store inbound message → generate reply → send → record.
3. The agent only offers times computed from the business's working hours, timezone, existing appointments and Google Calendar free/busy.
4. When the AI escalates, an owner escalates, or an owner replies from the dashboard, the AI pauses for that conversation until someone clicks **Resume AI**, reopens or resolves it.

## Appointment Reminders

Enable in **Settings → Reminders**. An Inngest cron checks every 15 minutes and messages customers the configured number of hours before their appointment. Inside WhatsApp's 24-hour window a normal message is sent; outside it, an approved template is required. Create a **Utility** template in Meta Business Manager with three body variables:

```
Hi {{1}}, this is a reminder of your appointment at {{2}} on {{3}}. Reply to this message to reschedule or cancel.
```

`{{1}}` customer name, `{{2}}` business name, `{{3}}` date and time.

## LeadHunter Outbound API

`POST /api/outbound/lead` with `Authorization: Bearer $LEADHUNTER_API_KEY`:

```json
{
  "name": "Sara",
  "phone": "+201001234567",
  "template": { "name": "intro_offer", "language": "ar" },
  "leadData": { "source_campaign": "nov" }
}
```

WhatsApp only delivers free-form text within 24 hours of the customer's last message, so cold leads need an approved `template`. `message` (free text) is accepted when that window is open; otherwise the API returns `422 template_required`.

## Project Structure

```
apps/web/          Next.js app (dashboard + API)
packages/db/       Drizzle schema + migrations
packages/shared/   Zod types shared across packages
CLAUDE.md          Rules for AI-assisted development
```

## Environment Variables

See `apps/web/.env.example` for the full list with descriptions.
