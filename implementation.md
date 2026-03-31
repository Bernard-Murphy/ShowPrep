# ShowPrep Implementation Status

This document reflects the code currently present in this repository.

## At a Glance

- **Backend API:** Core GraphQL modules compile; harvesting, processing, embeddings, and generation pipeline is implemented.
- **Frontend app:** Main pages compile; onboarding, settings actions, voting/comments, profile content, and progress streaming are wired.
- **Providers:** OpenAI (`gpt-5.4-mini`) and Voyage (`voyage-3-lite`) are integrated in active processing paths.
- **Remaining work:** Migrations must be applied in local/dev DB, and there are still quality/ops gaps (tests, production hardening).

---

## Implemented Features

### Authentication and User Session

- YouTube/Google OAuth login URL generation (`youtubeLoginAuthUrl`) is implemented.
- OAuth callback endpoint is implemented and issues JWT for login flow.
- Frontend callback route stores token and redirects to onboarding (`/auth/callback` -> `/onboarding`).
- Auth state/provider is implemented and fetches `me` with stored token.
- Auth widget supports:
  - unauthenticated sign-in button
  - authenticated avatar menu
  - logout
- SSE-compatible auth cookie (`showprep_token`) is maintained from auth state for progress streaming.

### User and Profile

- User GraphQL queries/mutations implemented:
  - `me`
  - `user(id)`
  - `updateProfile`
  - `subscribe` / `unsubscribe` / `isSubscribed`
- Profile page route at `/u/[id]` now renders:
  - user content counts
  - subscribe/unsubscribe action
  - user articles and gencasts lists
  - profile comments section

### YouTube Integration

- OAuth link flow and login flow in backend service/controller are implemented.
- Subscription sync mutation (`syncYouTubeSubscriptions`) is implemented.
- Subscription selection APIs implemented:
  - `youtubeSubscriptions`
  - `setYouTubeSubscriptionSelection(channelIds)`
- Unlink YouTube mutation (`unlinkYouTube`) is implemented.
- Transcript fetch helper (`youtube-transcript`) is implemented.
- Harvest-scoped recent uploads retrieval supports:
  - lookback window (`MAX_HARVEST_LOOKBACK_DAYS`)
  - per-channel limit (`MAX_HARVEST_PER_CHANNEL`)
  - per-user limit (`MAX_HARVEST_PER_USER`)
  - selected channel filtering
  - dedupe against existing `ProcessedVideo`

### Processing / Harvest Pipeline

- Real queue-backed processing pipeline is implemented in `video-processing.processor.ts`.
- Processing flow includes:
  1. sync subscriptions
  2. collect recent candidate videos
  3. hybrid non-informational filtering (heuristics + OpenAI fallback)
  4. transcript fetch
  5. transcript chunking and Voyage embeddings
  6. article generation
  7. gencast script + ElevenLabs TTS generation
  8. global outline generation
  9. persistence and completion/failure handling
- Processing jobs are persisted and exposed via GraphQL:
  - `startHarvest`
  - `processingJob`
  - `latestProcessingJob`

### Embeddings and Vector Storage

- Voyage embedding service (`voyage-3-lite`) is implemented with:
  - chunking
  - token-aware batching
  - parallel embedding workers
  - retry/backoff for transient failures
  - split-on-failure fallback
- Pgvector-backed storage is implemented for transcript chunks (`VideoEmbeddingChunk`).
- Filter decision audit table is implemented (`VideoFilterDecision`).

### Content Generation and Media

- OpenAI service is implemented and used for:
  - article summaries
  - podcast/gencast script generation
  - harvest outline generation
  - fallback informational-content classification
- ElevenLabs service is used for TTS in gencast generation.
- Storage service handles audio/image uploads and signed URLs.
- `Gencast.harvestOutline` is persisted.

### Progress Streaming

- SSE endpoint is implemented: `/api/processing/jobs/:jobId/stream`.
- Streaming progress messages are emitted by processing stages.
- Progress events are persisted (`ProcessingProgressEvent`) and replayed on reconnect.
- Frontend uses `streaming-progress-message.tsx` via `HarvestProgressStream`.

### Content API and Feed

- Article and gencast queries by slug are implemented.
- View increment mutations are wired from detail pages.
- Visibility toggles are implemented.
- Unified feed query with filter/sort/search/cursor exists.
- Hot articles/hot gencasts queries exist.
- User content listing queries are implemented:
  - `userArticles(userId, limit)`
  - `userGencasts(userId, limit)`

### Voting and Comments

- Voting API supports create/update/remove vote and user vote lookup.
- Comments API supports create and list by target (article/gencast/user profile), including replies.
- Frontend voting controls and comment sections are wired on:
  - article page
  - gencast page
  - profile page

### Settings and Onboarding UI

- Onboarding page (`/onboarding`) implemented for:
  - subscription sync
  - channel selection
  - harvest kickoff
  - live progress display
- Settings page now wires:
  - Link YouTube
  - Sync subscriptions
  - Unlink YouTube
  - channel selection save
  - voice listing
  - custom voice creation
  - custom voice deletion

### Frontend Pages Present

- `/`
- `/feed`
- `/article/[slug]`
- `/gencast/[slug]`
- `/u/[id]`
- `/settings`
- `/onboarding`
- `/privacy`
- `/terms`
- `/auth/callback`

### Cleanup Completed

- Removed legacy unused auth artifacts:
  - `apps/api/src/modules/auth/dto/auth.input.ts`
  - `apps/api/src/modules/auth/models/auth.model.ts`

---

## Partial / Operational Gaps

### Database Migration State (Local Dev)

- New migrations exist for harvest/embeddings/progress persistence.
- If local DB was previously created outside migration history, Prisma may report drift and request reset.
- Local environments may need reset or a fresh DB before `prisma migrate dev` succeeds.

### Production Hardening

- Integration/end-to-end tests for the full pipeline are not yet present.
- Recurring harvest orchestration policy (scheduler-driven vs user-triggered) is not fully defined.
- SSE auth currently uses cookie/header patterns suitable for browser clients, but still needs full production security review (cookie flags, CSRF posture, token lifetime handling).

### AI/Media Scope

- Legacy Venice module remains in repository for backward compatibility/older pathways, but new processing path uses OpenAI + Voyage + ElevenLabs.
- Headline image generation strategy is not finalized in the new pipeline path.

---

## Suggested Next Priorities

1. Stabilize DB migration workflow across environments (drift-safe dev bootstrap and deployment runbook).
2. Add integration tests for harvest, filtering, embedding, generation, and SSE replay flow.
3. Finalize recurring harvest strategy and schedule policy.
4. Finalize image-generation strategy for generated articles/gencasts.
5. Add operational monitoring/alerts for queue failures, provider errors, and long-running jobs.

