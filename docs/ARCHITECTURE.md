# Architecture

## Tech Stack

| Layer | Technology | Why |
|-------|-----------|-----|
| Framework | Next.js 16 (App Router) | Mobile-first SSR, easy deployment |
| Pose detection | MediaPipe BlazePose (Lite) | Runs in browser, no server cost, 15+ FPS on mobile |
| Auth | Supabase Auth | Email/password, free tier, built-in |
| Database | Supabase Postgres | RLS for data isolation, free tier |
| Styling | Tailwind CSS | Mobile-first utility classes |
| Charts | Recharts | Lightweight, responsive |
| Deployment | Vercel (planned) | Free tier, instant deploys |

## Data Flow

```
Phone Camera
    |
    v
getUserMedia (640x480, rear camera)
    |
    v
MediaPipe PoseLandmarker (runs in browser via WebGL/WASM)
    |
    +--> 33 body landmarks (x, y, z, visibility)
    |
    +--> Draw stick figure on canvas overlay
    |
    +--> Compute frame metrics (joint angles, symmetry)
    |
    v
On session stop:
    |
    +--> Compute session-level metrics (averages, cadence, step count)
    |
    +--> Save recording to Supabase (metrics + raw frame data as JSONB)
    |
    +--> Consolidate session metrics across all recordings (multi-angle)
```

## Database Schema

Tables are prefixed with `{project}_{env}_` to allow sharing a single Supabase instance across projects and environments.

**Current prefix:** `gait_dev_` (dev), `gait_prod_` (production)

```
gait_dev_patients
    |-- id, name, birth_date, notes
    |
    +-- gait_dev_patient_access (many)
    |       |-- user_id (FK -> auth.users), role (parent/therapist/viewer)
    |
    +-- gait_dev_sessions (many)
            |-- id, label, notes, consolidated metrics
            |
            +-- gait_dev_recordings (many)
                    |-- view_angle, duration, per-angle metrics, frame_data (JSONB)

gait_dev_invitations
    |-- email, patient_id, role, accepted
```

**Row Level Security (RLS):** Every table has RLS enabled. Users can only access data for patients they have a `patient_access` entry for. This is enforced at the database level — even if the app code has a bug, data is isolated.

## Key Design Decisions

### Pose data stored as JSONB, not video
- Raw video is huge (~10MB/min) and raises privacy concerns
- Pose landmark data is ~500KB-1MB per 30-second session
- Landmarks can recreate the stick figure for playback
- Metrics can be recomputed if algorithms improve

### Multi-angle as separate recordings, not synchronized streams
- Simpler implementation — no clock synchronization needed
- Each recording is independently useful
- Session-level metrics are consolidated by averaging across recordings
- Side view provides sagittal plane metrics, front view provides frontal plane metrics

### Table name prefixing over Postgres schemas
- Simpler Supabase RLS configuration
- Works within free tier (single database)
- Environment isolation (dev/prod) without separate projects
- Easy to identify which tables belong to which project

### Environment variable for table prefix
- `NEXT_PUBLIC_TABLE_PREFIX=gait_dev` in dev
- `NEXT_PUBLIC_TABLE_PREFIX=gait_prod` in production
- Single code path, no conditional logic
- Switching environments is a one-line env change

## File Structure

```
src/
├── app/
│   ├── layout.tsx                      # Root layout, PWA meta
│   ├── page.tsx                        # Home: patient list
│   ├── login/page.tsx                  # Auth: sign in
│   ├── signup/page.tsx                 # Auth: create account
│   ├── auth/callback/route.ts          # Supabase auth callback
│   ├── patient/[patientId]/
│   │   ├── page.tsx                    # Patient dashboard: sessions by day
│   │   ├── record/page.tsx             # Camera + pose detection + recording
│   │   └── progress/page.tsx           # Charts: trends over time
│   └── review/[sessionId]/page.tsx     # Session detail: metrics, angles, notes
├── components/
│   ├── StickFigure.tsx                 # Canvas drawing of skeleton
│   ├── MetricsPanel.tsx                # Live metrics overlay during recording
│   ├── SetupGuide.tsx                  # First-time camera positioning guide
│   ├── SessionCard.tsx                 # Session summary card
│   └── ProgressChart.tsx               # Recharts line chart wrapper
├── lib/
│   ├── supabase/client.ts              # Browser Supabase client
│   ├── supabase/server.ts              # Server Supabase client
│   ├── db.ts                           # All database operations
│   ├── tables.ts                       # Table name prefix helper
│   ├── mediapipe.ts                    # PoseLandmarker initialization
│   ├── gait-metrics.ts                 # Joint angle calculation, symmetry, cadence
│   ├── landmarks.ts                    # MediaPipe landmark indices + skeleton connections
│   └── types.ts                        # TypeScript interfaces
└── middleware.ts                        # Auth redirect (login/protected routes)
```
