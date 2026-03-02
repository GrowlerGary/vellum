# Vellum

A progressive web app for tracking movies, TV shows, books, audiobooks, and video games — with multi-user support, ratings, AI suggestions, and automatic scrobbling.

## Features

- **Track 5 media types** — Movies, TV Shows, Books, Audiobooks, Video Games
- **Status tracking** — Want to Consume / In Progress / Completed / Dropped
- **Ratings** — Half-star ratings (0.5–5 stars)
- **Public profiles** — Per-entry privacy controls; public profiles are shareable
- **Custom lists** — Organise items into named lists
- **Metadata search** — Federated search across TMDB (movies/TV), IGDB (games), Hardcover (books/audiobooks)
- **AI Suggestions** — Personalised recommendations powered by Anthropic Claude, OpenAI, or Ollama
- **Auto-scrobbling** — Webhook receivers for Trakt, Audiobookshelf, and Stremio
- **Admin panel** — Invite-only accounts, admin can create and manage users
- **PWA** — Installable to home screen (iOS/Android/Desktop)

## Quick Start

### 1. Configure docker-compose.yml

All environment variables are declared inline in `docker-compose.yml` with comments marking each as **REQUIRED** or **OPTIONAL**. At minimum, change the required values:

- `AUTH_SECRET` — generate with `openssl rand -base64 32`
- `AUTH_URL` — set to your public URL in production (leave `http://localhost:3000` for local use)
- `ADMIN_EMAIL` / `ADMIN_PASSWORD` / `ADMIN_USERNAME` — credentials for the first admin account

### 2. Start with Docker Compose

```bash
docker compose up -d
```

Database migrations run automatically on startup. Then seed the admin user once:

```bash
docker compose exec app npm run db:seed
```

Visit [http://localhost:3000](http://localhost:3000) and log in with your admin credentials.

### 3. Local development

For local dev, copy `.env.example` and fill in your values:

```bash
cp .env.example .env
```

Then:

```bash
# Start only the database via Docker
docker compose up db -d

# Install dependencies
npm install

# Generate Prisma client
npm run db:generate

# Apply migrations
npm run db:migrate

# Seed admin user
npm run db:seed

# Start dev server
npm run dev
```

## API Keys

| Service | Purpose | Where to get it |
|---|---|---|
| TMDB | Movie & TV metadata | [themoviedb.org/settings/api](https://www.themoviedb.org/settings/api) |
| IGDB | Video game metadata | [dev.twitch.tv/console](https://dev.twitch.tv/console) (create app) |
| Hardcover | Books & audiobooks | [hardcover.app/account/api](https://hardcover.app/account/api) |
| Anthropic | AI suggestions | [console.anthropic.com](https://console.anthropic.com) |
| OpenAI | AI suggestions (alternative) | [platform.openai.com](https://platform.openai.com) |
| Ollama | AI suggestions (local, no cost) | Run `ollama serve` locally |

## Scrobble Setup

Each webhook URL is shown in **Settings** after you log in.

### Trakt
1. Go to trakt.tv/settings/apps and add a webhook
2. URL: `https://yourdomain.com/api/scrobble/trakt?userId=<your-user-id>`
3. Set `TRAKT_WEBHOOK_SECRET` in `docker-compose.yml` (or `.env` for local dev)

### Audiobookshelf
1. In ABS → Settings → Notifications, add a webhook
2. URL: `https://yourdomain.com/api/scrobble/audiobookshelf?userId=<your-user-id>`
3. Enable event: `media_progress_updated`

### Stremio
Stremio lacks native webhooks. Use the Trakt addon in Stremio and rely on the Trakt scrobble endpoint, or use a community webhook addon with the `/api/scrobble/stremio` endpoint.

## AI Configuration

Set `AI_PROVIDER` to one of:
- `anthropic` — Claude (requires `ANTHROPIC_API_KEY`)
- `openai` — GPT-4o (requires `OPENAI_API_KEY`, optionally `OPENAI_MODEL`)
- `ollama` — Local LLM (requires `OLLAMA_BASE_URL` and `OLLAMA_MODEL`)

## Stack

- **Next.js 15** (App Router) + TypeScript
- **PostgreSQL** + Prisma 5 ORM
- **NextAuth v5** — credentials provider, JWT sessions
- **Tailwind CSS** + Radix UI primitives
- **@ducanh2912/next-pwa** — installable PWA shell
- **Docker Compose** — portable self-hosted deployment

## Database Scripts

```bash
npm run db:generate  # Generate Prisma client
npm run db:migrate   # Apply migrations to connected database
npm run db:push      # Push schema directly (dev only, no migration)
npm run db:seed      # Create admin user from ADMIN_* env vars
npm run db:studio    # Open Prisma Studio GUI
```
