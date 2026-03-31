# ShowPrep Implementation Status

This document reflects the code currently present in this repository.

## At a Glance

- **Backend API:** Core GraphQL modules are present and compile.
- **Frontend app:** Main pages and auth UX are present and compile.
- **Auth:** YouTube/Google OAuth login flow is implemented.
- **Gaps:** Several UI/processing features are still placeholders or partially wired.

---

## Implemented Features

### Authentication and User Session

- YouTube/Google OAuth login URL generation (`youtubeLoginAuthUrl`) is implemented.
- OAuth callback endpoint is implemented and issues JWT for login flow.
- Frontend callback route stores token and redirects (`/auth/callback`).
- Auth state/provider is implemented and fetches `me` with stored token.
- Header auth widget supports:
  - unauthenticated sign-in button
  - authenticated avatar menu
  - logout

### User and Profile

- User GraphQL queries/mutations implemented:
  - `me`
  - `user(id)`
  - `updateProfile`
  - `subscribe` / `unsubscribe` / `isSubscribed`
- Profile page route exists at `/u/[id]`.

### YouTube Integration

- OAuth link flow and login flow in backend service/controller are implemented.
- Subscription sync mutation (`syncYouTubeSubscriptions`) is implemented.
- Transcript fetch helper (`youtube-transcript`) exists.
- Recent uploads fetch logic from subscriptions exists.

### Content API and Feed

- Article and gencast queries by slug are implemented.
- View increment mutations and visibility toggles are implemented.
- Unified feed query with filter/sort/search/cursor exists.
- Hot articles/hot gencasts queries exist.

### Voting and Comments API

- Voting API supports create/update/remove vote and user vote lookup.
- Comments API supports create and list by target (article/gencast/user profile), with replies.

### AI and Media Services

- Venice service implemented for:
  - article summary generation
  - headline image generation
  - gencast script generation
  - TTS for Venice voices
- ElevenLabs service implemented for:
  - voice creation
  - TTS
- Storage service implemented for:
  - buffer/image/audio upload
  - signed URL generation
- Scheduler exists for periodic hot-score recalculation.

### Frontend Pages Present

- `/` home
- `/feed`
- `/article/[slug]`
- `/gencast/[slug]`
- `/u/[id]`
- `/settings`
- `/privacy`
- `/terms`
- `/auth/callback`

### Reusable UI Component Added

- `apps/web/src/components/streaming-progress-message.tsx` added as a reusable AnimatePresence + motion component for streaming/progress message transitions (fade in from bottom, fade out to top).

---

## Partial / Stubbed / Missing

### Processing Pipeline (Stub)

- `apps/api/src/modules/processing/processors/video-processing.processor.ts` contains a TODO placeholder for the main ingestion/generation pipeline:
  - YouTube sync
  - transcript processing
  - Venice generation
  - TTS
  - S3 upload orchestration

### Frontend Settings (Mostly Placeholder)

- Settings page currently displays static sections.
- "Link YouTube" button is present but not wired to `youtubeAuthUrl` flow.
- No full account/settings management UI beyond basic text.

### Frontend Profile Content Section (Placeholder)

- Profile page currently states:
  - "Articles and gencasts will appear here."
- No list/tab rendering of user content yet.

### Frontend Voting/Comments UX (Missing)

- Article and gencast detail pages display content/media, but no interactive vote controls or comments ("Cope") UI is wired in.
- Backend APIs exist, but frontend integration is incomplete.

### Voice Management UX (Missing)

- Backend has voice list/delete and service-level custom voice creation support.
- Frontend does not yet provide complete voice upload/create/delete management flows.

### Auth Module Cleanup (Legacy Artifacts)

- `apps/api/src/modules/auth/dto/auth.input.ts` and `apps/api/src/modules/auth/models/auth.model.ts` remain in tree, but login/register mutation flow is no longer used.

### Avatar Reliability (Operational Note)

- Backend now caches avatar thumbnails via storage during login flow.
- Existing users may still need to sign in again to refresh stored avatar URL if previous value is stale/missing.

---

## Suggested Next Priorities

1. Implement real processing worker pipeline in `video-processing.processor.ts`.
2. Wire settings actions (link/sync/unlink YouTube, voice management).
3. Add frontend vote/comment components to article/gencast pages.
4. Populate profile page with actual user articles/gencasts.
5. Remove legacy unused auth DTO/model files after final verification.

