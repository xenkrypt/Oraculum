# Oraculum

Oraculum is an autonomous AI talent-finding agent for everyday people. This repository is the base architecture scaffold: Next.js App Router, TypeScript, TailwindCSS, Supabase Auth, Supabase Postgres tables, and route handlers for the core data lifecycle.

## Architecture

- `app/` contains the App Router pages and API route handlers.
- `components/` contains small client components for auth status, login/signup, and starting a session.
- `lib/supabase/` contains browser and server Supabase clients.
- `lib/api.ts` contains shared API auth and validation helpers.
- `lib/types/database.ts` contains lightweight Supabase table types.
- `supabase/migrations/0001_initial_schema.sql` defines the database schema, seed challenge definitions, indexes, triggers, and row-level security policies.

The current backend uses Next.js Route Handlers instead of a separate Express app. This keeps the first stage simple while still giving the frontend typed HTTP endpoints.

## Data Model

The migration creates:

- `users`: public profile row linked to `auth.users`.
- `sessions`: each challenge run for a user.
- `challenge_definitions`: reusable challenge metadata and JSON config.
- `challenge_responses`: raw per-challenge user answers.
- `talent_profiles`: generated Thinking Style Map scores and summary text.
- `future_paths`: generated recommended paths and 90-day roadmap metadata.
- `user_events`: timestamped memory log for the future Shadow Twin agent.

Row-level security restricts user-owned records to `auth.uid()`. Challenge definitions are readable by authenticated users when active.

## API Routes

- `POST /api/sessions`: create an authenticated challenge session.
- `GET /api/sessions`: list the authenticated user's sessions.
- `POST /api/challenge-responses`: store a raw challenge response.
- `GET /api/challenge-responses?session_id=...`: fetch responses for a session.
- `POST /api/talent-profile`: upsert a profile for a session.
- `GET /api/talent-profile?session_id=...`: fetch a profile.
- `POST /api/future-paths`: upsert recommended paths for a session.
- `GET /api/future-paths?session_id=...`: fetch recommended paths.
- `POST /api/user-events`: append a Shadow Twin memory event.
- `GET /api/user-events?session_id=...&limit=50`: fetch recent events.

AI integration is intentionally not implemented yet. The comments in the talent profile and future paths routes mark where later scoring, synthesis, and LLM-backed generation can write structured outputs.

## Local Setup

1. Install dependencies:

```bash
npm install
```

2. Create a Supabase project and copy `.env.example` to `.env.local`:

```bash
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
```

3. Run the SQL in `supabase/migrations/0001_initial_schema.sql` using the Supabase SQL editor or Supabase CLI.

4. Start the app:

```bash
npm run dev
```

5. Open `http://localhost:3000`, sign up or sign in, then create a session from `/challenges`.
"# Oraculum" 
