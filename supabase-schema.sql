-- Run this in the Supabase SQL Editor (Dashboard > SQL Editor > New Query)

-- Patients table
create table patients (
  id uuid default gen_random_uuid() primary key,
  name text not null,
  birth_date date,
  notes text,
  created_at timestamptz default now()
);

-- Links users to patients with roles
create table patient_access (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users(id) on delete cascade not null,
  patient_id uuid references patients(id) on delete cascade not null,
  role text not null check (role in ('parent', 'therapist', 'viewer')),
  created_at timestamptz default now(),
  unique(user_id, patient_id)
);

-- Sessions (groups of recordings on a given date)
create table sessions (
  id uuid default gen_random_uuid() primary key,
  patient_id uuid references patients(id) on delete cascade not null,
  label text not null,
  notes text,
  -- Consolidated metrics across all recordings
  knee_symmetry_index real,
  hip_symmetry_index real,
  stride_cadence real,
  total_steps integer,
  duration_seconds real,
  created_at timestamptz default now()
);

-- Individual recordings (one per camera angle)
create table recordings (
  id uuid default gen_random_uuid() primary key,
  session_id uuid references sessions(id) on delete cascade not null,
  view_angle text not null check (view_angle in ('side-left', 'side-right', 'front', 'back')),
  duration_ms integer not null,
  -- Per-angle metrics
  avg_left_knee_angle real,
  avg_right_knee_angle real,
  avg_left_hip_angle real,
  avg_right_hip_angle real,
  avg_left_ankle_angle real,
  avg_right_ankle_angle real,
  knee_symmetry_index real,
  hip_symmetry_index real,
  stride_cadence real,
  total_steps integer,
  -- Frame data (pose landmarks per frame as JSON)
  frame_data jsonb,
  metric_settings_snapshot jsonb,
  created_at timestamptz default now()
);

-- Invitations for sharing
create table invitations (
  id uuid default gen_random_uuid() primary key,
  email text not null,
  patient_id uuid references patients(id) on delete cascade not null,
  role text not null check (role in ('therapist', 'viewer')),
  accepted boolean default false,
  created_at timestamptz default now(),
  unique(email, patient_id)
);

create table metric_preferences (
  user_id uuid primary key references auth.users(id) on delete cascade,
  preferences jsonb not null default '{}'::jsonb,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- Row Level Security (RLS) -- users can only see patients they have access to

alter table patients enable row level security;
alter table patient_access enable row level security;
alter table sessions enable row level security;
alter table recordings enable row level security;
alter table invitations enable row level security;
alter table metric_preferences enable row level security;

-- patient_access: users see their own access rows
create policy "Users see own access"
  on patient_access for select
  using (auth.uid() = user_id);

create policy "Users insert own access"
  on patient_access for insert
  with check (auth.uid() = user_id);

create policy "Users delete own access"
  on patient_access for delete
  using (auth.uid() = user_id);

-- patients: users see patients they have access to
create policy "Users see accessible patients"
  on patients for select
  using (
    exists (
      select 1 from patient_access
      where patient_access.patient_id = patients.id
      and patient_access.user_id = auth.uid()
    )
  );

create policy "Users create patients"
  on patients for insert
  with check (true);  -- anyone logged in can create a patient

create policy "Parents update patients"
  on patients for update
  using (
    exists (
      select 1 from patient_access
      where patient_access.patient_id = patients.id
      and patient_access.user_id = auth.uid()
      and patient_access.role = 'parent'
    )
  );

-- sessions: users see sessions for patients they have access to
create policy "Users see accessible sessions"
  on sessions for select
  using (
    exists (
      select 1 from patient_access
      where patient_access.patient_id = sessions.patient_id
      and patient_access.user_id = auth.uid()
    )
  );

create policy "Team members create sessions"
  on sessions for insert
  with check (
    exists (
      select 1 from patient_access
      where patient_access.patient_id = sessions.patient_id
      and patient_access.user_id = auth.uid()
      and patient_access.role in ('parent', 'therapist')
    )
  );

create policy "Team members update sessions"
  on sessions for update
  using (
    exists (
      select 1 from patient_access
      where patient_access.patient_id = sessions.patient_id
      and patient_access.user_id = auth.uid()
      and patient_access.role in ('parent', 'therapist')
    )
  );

create policy "Parents delete sessions"
  on sessions for delete
  using (
    exists (
      select 1 from patient_access
      where patient_access.patient_id = sessions.patient_id
      and patient_access.user_id = auth.uid()
      and patient_access.role = 'parent'
    )
  );

-- recordings: same access pattern as sessions
create policy "Users see accessible recordings"
  on recordings for select
  using (
    exists (
      select 1 from sessions
      join patient_access on patient_access.patient_id = sessions.patient_id
      where sessions.id = recordings.session_id
      and patient_access.user_id = auth.uid()
    )
  );

create policy "Team members create recordings"
  on recordings for insert
  with check (
    exists (
      select 1 from sessions
      join patient_access on patient_access.patient_id = sessions.patient_id
      where sessions.id = recordings.session_id
      and patient_access.user_id = auth.uid()
      and patient_access.role in ('parent', 'therapist')
    )
  );

-- invitations: parents can manage, invitees can see their own
create policy "Parents manage invitations"
  on invitations for all
  using (
    exists (
      select 1 from patient_access
      where patient_access.patient_id = invitations.patient_id
      and patient_access.user_id = auth.uid()
      and patient_access.role = 'parent'
    )
  );

create policy "Invitees see own invitations"
  on invitations for select
  using (
    lower(email) = lower(coalesce(auth.jwt()->>'email', ''))
  );

create policy "Users manage own metric preferences"
  on metric_preferences for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);
