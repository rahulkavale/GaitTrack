# Gait Tracker

Gait Tracker is a mobile-first web app for simple, repeatable gait analysis using a phone camera or an existing video.

The goal is not to replace clinical gait labs. The goal is to make basic, objective movement measurement available far more often, at effectively zero marginal cost, using devices families already have.

## Why This Project Exists

For many families and therapists, gait progress is tracked with memory, notes, and subjective observation.

That creates a few problems:

- progress is hard to quantify over time
- small regressions can be missed
- data is hard to share between parents and therapists
- formal gait labs are expensive, infrequent, and inaccessible for most families

This project exists to close that gap with a practical middle ground:

- cheaper than a gait lab
- more objective than memory
- easier to use regularly
- private by default

## What The App Does

Today the app supports:

- live recording from a phone camera
- analysis of an existing uploaded video
- per-session movement metrics from pose landmarks
- multiple camera angles in one session
- local replay of the recorded/uploaded video on the same device
- session history and review for signed-in users
- a no-login `Try now` flow

The current output is best understood as **observed movement features and heuristic metrics**, not clinical diagnosis.

## Design Principles

### 1. Privacy First

Raw video replay stays on the device that recorded or uploaded it.

- replay video is stored in browser IndexedDB
- replay is not uploaded to cloud storage
- this keeps storage cost low and reduces privacy exposure

Server-side storage is used for structured session data such as:

- recordings metadata
- pose landmark frames
- computed metrics
- notes and sharing state

### 2. Accessible Over Perfect

The system is designed for ordinary phones and ordinary environments, not lab hardware.

That means:

- browser-based analysis
- no native app requirement
- low-cost deployment
- usable in clinic or at home

### 3. Support Clinicians, Don’t Pretend To Be One

The app measures and summarizes movement. It does not provide treatment advice, diagnosis, or regulatory-grade interpretation.

That is why the UI has been shifted toward:

- observed movement features
- descriptive findings
- no hardcoded therapy recommendations in the product surface

### 4. Keep The Mental Model Simple

The product behavior should be obvious:

- analysis can come from live camera or an uploaded file
- replay is local to the device/browser
- metrics can be reviewed later across sessions

## Current Product Flows

### Try Now

`/try/record`

- no login required
- analyze from camera or existing video
- see analysis immediately
- replay is available only on the same device/browser

### Logged-In Recording

`/patient/[patientId]/record`

- starts a new session
- supports live recording and uploaded video
- saves metrics to Supabase
- saves replay locally on the recording device

### Joined Session Recording

`/join/[sessionId]/record`

- add another angle to an existing session
- supports live recording and uploaded video
- replay still remains local to the device that provided it

### Review

`/review/[sessionId]`

- analysis tab for metrics and movement features
- replay tab for local video playback when available on that device

## Technical Overview

### Stack

- Next.js 16 App Router
- React 19
- MediaPipe Pose Landmarker
- Supabase Auth + Postgres
- Tailwind CSS
- Recharts
- Vercel

### How Analysis Works

At a high level:

1. A `video` element is fed either:
   - a `getUserMedia()` camera stream, or
   - an uploaded video file via object URL
2. MediaPipe `detectForVideo()` runs in the browser on each frame
3. Landmarks are drawn onto a canvas overlay
4. Per-frame metrics are computed from landmarks
5. Session-level metrics are derived from the collected frame series
6. Structured session data is saved to Supabase
7. Replay video is stored locally in IndexedDB

### Local Video Storage Model

Replay video uses the browser, not the backend.

- storage layer: `src/lib/videoStore.ts`
- persistence: IndexedDB
- lookup key: recording ID
- retention: bounded by a per-patient local cap

This is a deliberate tradeoff:

- good: low backend cost, better privacy
- bad: replay does not follow the user to another device/browser

### Metric Pipeline

Main logic lives in:

- `src/lib/gait-metrics.ts`
- `src/lib/clinical-norms.ts`

The pipeline computes:

- joint angles
- bilateral symmetry
- simple gait timing heuristics
- trunk/head/arm movement summaries
- observed movement features derived from thresholds

Important caveat:

These are currently **heuristic browser-side metrics**, not clinically validated motion lab outputs. Some measures are stronger than others, and some pattern-like flags are still derived from simplified inputs.

### Data Model

Main entities:

- patients
- sessions
- recordings
- patient access
- invitations

Recordings store:

- angle/view metadata
- session duration
- frame landmarks
- frame metrics
- computed summary metrics

Replay video itself is not stored in Supabase.

### Multi-Angle Sessions

A session can contain multiple recordings from different angles, for example:

- front
- back
- side-left
- side-right

Those recordings are stored separately and then reconciled into a combined session view.

## Repository Structure

```text
src/
├── app/
│   ├── page.tsx
│   ├── try/record/page.tsx
│   ├── patient/[patientId]/record/page.tsx
│   ├── join/[sessionId]/record/page.tsx
│   └── review/[sessionId]/page.tsx
├── components/
│   ├── GaitReport.tsx
│   ├── MetricsPanel.tsx
│   ├── RecordingVideo.tsx
│   ├── SetupGuide.tsx
│   └── StickFigure.tsx
├── lib/
│   ├── gait-metrics.ts
│   ├── clinical-norms.ts
│   ├── mediapipe.ts
│   ├── reconcile-views.ts
│   ├── videoStore.ts
│   ├── db.ts
│   └── supabase/
└── middleware.ts
```

## Running Locally

Install dependencies:

```bash
npm install
```

Start the app:

```bash
npm run dev
```

Build production locally:

```bash
npm run build
```

## Environment

The app expects standard Next.js environment variables for Supabase plus the table prefix used for environment separation.

Common variables:

```bash
NEXT_PUBLIC_SUPABASE_URL=...
NEXT_PUBLIC_SUPABASE_ANON_KEY=...
NEXT_PUBLIC_TABLE_PREFIX=gait_dev
```

## Known Limitations

- replay is local-only and does not sync across devices
- uploaded-video analysis is currently browser-side, so long videos can take noticeable time
- some gait feature thresholds are heuristic and should not be treated as diagnosis
- the displayed movement score is a custom composite, not a standardized clinical GDI

## Near-Term Improvements

- clearer upload validation and file guidance
- explicit build/version stamp in the UI
- replay/debug diagnostics for local video persistence
- direct use of richer stored `computed_metrics` in review
- confidence labeling for metrics by view and method
- analytics / event instrumentation

## Related Docs

- [Problem](docs/PROBLEM.md)
- [Vision](docs/VISION.md)
- [Architecture](docs/ARCHITECTURE.md)
