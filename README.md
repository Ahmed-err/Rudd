# Rudd — WhatsApp AI Appointment Agent

SaaS platform that lets business owners connect their WhatsApp and Google Calendar so an AI agent can handle bookings and lead qualification automatically.

## Stack

- **Next.js 15** (App Router) — dashboard + webhooks + API in one deploy
- **Clerk** — auth + multi-tenant organizations
- **Neon Postgres + Drizzle** — serverless DB with type-safe queries
- **Inngest** — durable async functions (AI + calendar work runs here, not in webhook handlers)
- **OpenAI Assistants API** — per-conversation threads + function calling
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
cp .env.example .env
# fill in all values in .env

pnpm install
pnpm dev          # starts Next.js on http://localhost:3000
```

### Expose the Webhook Locally

Use [Cloudflare Tunnel](https://developers.cloudflare.com/cloudflare-one/connections/connect-networks/do-more-with-tunnels/trycloudflare/) (no account needed):

```bash
cloudflared tunnel --url http://localhost:3000
```

Copy the `https://...trycloudflare.com` URL.

### Register with Meta

1. Go to [Meta App Dashboard](https://developers.facebook.com) → your app → WhatsApp → Configuration
2. Under **Webhook**, click **Edit**
3. Callback URL: `https://<your-tunnel-url>/api/webhooks/whatsapp`
4. Verify token: the value you set for `WHATSAPP_VERIFY_TOKEN` in `.env`
5. Click **Verify and Save**, then subscribe to the **messages** field

### Running Tests

```bash
pnpm test          # vitest (unit)
```

## Project Structure

```
apps/web/          Next.js app (dashboard + API)
packages/db/       Drizzle schema + migrations
packages/shared/   Zod types shared across packages
CLAUDE.md          Rules for AI-assisted development
```

## Environment Variables

See `.env.example` for the full list with descriptions.
