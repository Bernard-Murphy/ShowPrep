# Showprep

Show prep for podcasters: link YouTube, get article summaries and daily audio recaps.

- **API:** NestJS + GraphQL (Apollo) + Prisma + BullMQ — `apps/api`
- **Web:** Next.js 14 + Tailwind + ShadCN-style UI — `apps/web`

---

## Environment variables

| Variable                  | Where | Required          | Description                                                       |
| ------------------------- | ----- | ----------------- | ----------------------------------------------------------------- |
| `DATABASE_URL`            | API   | Yes               | PostgreSQL connection string                                      |
| `REDIS_URL`               | API   | Yes (for jobs)    | Redis connection, e.g. `redis://localhost:6379`                   |
| `JWT_SECRET`              | API   | Yes               | Secret for signing JWTs (use a long random string)                |
| `PORT`                    | API   | No                | API port (default `4000`)                                         |
| `CORS_ORIGIN`             | API   | No                | Allowed frontend origin (default `http://localhost:3000`)         |
| `YOUTUBE_CLIENT_ID`       | API   | For YouTube       | OAuth 2.0 Client ID from Google Cloud                             |
| `YOUTUBE_CLIENT_SECRET`   | API   | For YouTube       | OAuth 2.0 Client Secret                                           |
| `YOUTUBE_REDIRECT_URI`    | API   | For YouTube       | Callback URL (must match API base + `/api/auth/youtube/callback`) |
| `VENICE_API_KEY`          | API   | For AI            | Venice AI API key (text/image/TTS)                                |
| `ELEVENLABS_API_KEY`      | API   | For custom voices | ElevenLabs API key                                                |
| `S3_ENDPOINT`             | API   | For uploads       | S3-compatible endpoint (e.g. MinIO or AWS)                        |
| `S3_BASE_URL`             | API   | For uploads       | Public base URL for static files; uploads return `S3_BASE_URL/key`|
| `S3_BUCKET`               | API   | For uploads       | Bucket name                                                       |
| `S3_ACCESS_KEY`           | API   | For uploads       | Access key                                                        |
| `S3_SECRET_KEY`           | API   | For uploads       | Secret key                                                        |
| `S3_REGION`               | API   | No                | Region (default `us-east-1`)                                      |
| `PROCESS_LIMIT`           | API   | No                | Max videos to process per run (default `100`)                     |
| `NEXT_PUBLIC_GRAPHQL_URL` | Web   | Yes               | Full GraphQL URL (e.g. `http://localhost:4000/graphql`)           |

---

## YouTube configuration

1. Go to [Google Cloud Console](https://console.cloud.google.com/).
2. Create or select a project → **APIs & Services** → **Credentials**.
3. **Create credentials** → **OAuth client ID**.
4. Application type: **Web application**.
5. Add **Authorized JavaScript origins**:
   - Dev: `http://localhost:3000` and `http://localhost:4000`
   - Prod: `https://your-frontend-domain.com` and `https://your-api-domain.com`
6. Add **Authorized redirect URIs**:
   - Dev: `http://localhost:4000/api/auth/youtube/callback` (or your API base + `/api/auth/youtube/callback`).
   - Prod: `https://your-api-domain.com/api/auth/youtube/callback`.
7. Copy **Client ID** and **Client secret** into `YOUTUBE_CLIENT_ID` and `YOUTUBE_CLIENT_SECRET`.
8. Enable **YouTube Data API v3** for the project: **APIs & Services** → **Library** → search “YouTube Data API v3” → Enable.
9. Set `YOUTUBE_REDIRECT_URI` to the exact redirect URI you added (same as in the table above).

---

## Development setup

1. **Clone and install**

   ```bash
   cd showPrep
   npm install
   ```

2. **Start infrastructure**

   ```bash
   docker compose up -d
   ```

   Starts Postgres (5432), Redis (6379), MinIO (9000/9001).

3. **API**
   - Copy `apps/api/.env.example` to `apps/api/.env` and set at least `DATABASE_URL`, `JWT_SECRET`, `REDIS_URL`. For local DB: `postgresql://showprep:showprep@localhost:5432/showprep`.
   - Generate Prisma client and run migrations:
     ```bash
     cd apps/api && npx prisma generate && npx prisma migrate dev
     ```
   - Seed default voices (optional): `npm run db:seed`
   - Start API: `npm run dev` (from repo root: `npm run dev:api`).

4. **Web**
   - Copy `apps/web/.env.local.example` to `apps/web/.env.local` and set `NEXT_PUBLIC_GRAPHQL_URL=http://localhost:4000/graphql`.
   - Start web: `npm run dev` (or `npm run dev:web` from root).

5. Open **http://localhost:3000**; GraphQL at **http://localhost:4000/graphql**.

---

## Production deployment

- **API:** Run Nest in production mode (`npm run build` then `node dist/main` or `npm run start:prod`). Use a process manager (e.g. systemd, PM2). Set all env vars in the table above; use a real Postgres and Redis instance and a strong `JWT_SECRET`. For YouTube, use your production redirect URI.
- **Web:** Build with `npm run build` and serve with `npm run start` (or your platform’s Node server). Set `NEXT_PUBLIC_GRAPHQL_URL` to your production API GraphQL URL.
- **Database:** Run migrations with `npx prisma migrate deploy` in `apps/api` against the production `DATABASE_URL`. Run seed once if you need default voices.
- **Storage:** Use a production S3 bucket (e.g. AWS S3) and set `S3_*`, including `S3_BASE_URL` for public file URLs.
- **Security:** Use HTTPS, restrict CORS via `CORS_ORIGIN`, and never commit `.env` or `.env.local` (see `.gitignore`).
