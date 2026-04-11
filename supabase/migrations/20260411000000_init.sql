-- Gait Tracker - Dev Environment
-- Table prefix: gait_dev_ (use gait_prod_ for production)
-- Allows multiple projects and environments to share one Supabase instance

-- Patients table
create table gait_dev_patients (
  id uuid default gen_random_uuid() primary key,
  name text not null,
  birth_date date,
  notes text,
  created_at timestamptz default now()
);

-- Links users to patients with roles
create table gait_dev_patient_access (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users(id) on delete cascade not null,
  patient_id uuid references gait_dev_patients(id) on delete cascade not null,
  role text not null check (role in ('parent', 'therapist', 'viewer')),
  created_at timestamptz default now(),
  unique(user_id, patient_id)
);

-- Sessions (groups of recordings on a given date)
create table gait_dev_sessions (
  id uuid default gen_random_uuid() primary key,
  patient_id uuid references gait_dev_patients(id) on delete cascade not null,
  label text not null,
  notes text,
  knee_symmetry_index real,
  hip_symmetry_index real,
  stride_cadence real,
  total_steps integer,
  duration_seconds real,
  created_at timestamptz default now()
);

-- Individual recordings (one per camera angle)
create table gait_dev_recordings (
  id uuid default gen_random_uuid() primary key,
  session_id uuid references gait_dev_sessions(id) on delete cascade not null,
  view_angle text not null check (view_angle in ('side-left', 'side-right', 'front', 'back')),
  duration_ms integer not null,
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
  frame_data jsonb,
  created_at timestamptz default now()
);

-- Invitations for sharing
create table gait_dev_invitations (
  id uuid default gen_random_uuid() primary key,
  email text not null,
  patient_id uuid references gait_dev_patients(id) on delete cascade not null,
  role text not null check (role in ('therapist', 'viewer')),
  accepted boolean default false,
  created_at timestamptz default now(),
  unique(email, patient_id)
);

-- Row Level Security

alter table gait_dev_patients enable row level security;
alter table gait_dev_patient_access enable row level security;
alter table gait_dev_sessions enable row level security;
alter table gait_dev_recordings enable row level security;
alter table gait_dev_invitations enable row level security;

-- patient_access policies
create policy "gait_dev_users_see_own_access"
  on gait_dev_patient_access for select
  using (auth.uid() = user_id);

create policy "gait_dev_users_insert_own_access"
  on gait_dev_patient_access for insert
  with check (auth.uid() = user_id);

create policy "gait_dev_users_delete_own_access"
  on gait_dev_patient_access for delete
  using (auth.uid() = user_id);

-- patients policies
create policy "gait_dev_users_see_accessible_patients"
  on gait_dev_patients for select
  using (
    exists (
      select 1 from gait_dev_patient_access
      where gait_dev_patient_access.patient_id = gait_dev_patients.id
      and gait_dev_patient_access.user_id = auth.uid()
    )
  );

create policy "gait_dev_users_create_patients"
  on gait_dev_patients for insert
  with check (true);

create policy "gait_dev_parents_update_patients"
  on gait_dev_patients for update
  using (
    exists (
      select 1 from gait_dev_patient_access
      where gait_dev_patient_access.patient_id = gait_dev_patients.id
      and gait_dev_patient_access.user_id = auth.uid()
      and gait_dev_patient_access.role = 'parent'
    )
  );

-- sessions policies
create policy "gait_dev_users_see_accessible_sessions"
  on gait_dev_sessions for select
  using (
    exists (
      select 1 from gait_dev_patient_access
      where gait_dev_patient_access.patient_id = gait_dev_sessions.patient_id
      and gait_dev_patient_access.user_id = auth.uid()
    )
  );

create policy "gait_dev_team_create_sessions"
  on gait_dev_sessions for insert
  with check (
    exists (
      select 1 from gait_dev_patient_access
      where gait_dev_patient_access.patient_id = gait_dev_sessions.patient_id
      and gait_dev_patient_access.user_id = auth.uid()
      and gait_dev_patient_access.role in ('parent', 'therapist')
    )
  );

create policy "gait_dev_team_update_sessions"
  on gait_dev_sessions for update
  using (
    exists (
      select 1 from gait_dev_patient_access
      where gait_dev_patient_access.patient_id = gait_dev_sessions.patient_id
      and gait_dev_patient_access.user_id = auth.uid()
      and gait_dev_patient_access.role in ('parent', 'therapist')
    )
  );

create policy "gait_dev_parents_delete_sessions"
  on gait_dev_sessions for delete
  using (
    exists (
      select 1 from gait_dev_patient_access
      where gait_dev_patient_access.patient_id = gait_dev_sessions.patient_id
      and gait_dev_patient_access.user_id = auth.uid()
      and gait_dev_patient_access.role = 'parent'
    )
  );

-- recordings policies
create policy "gait_dev_users_see_accessible_recordings"
  on gait_dev_recordings for select
  using (
    exists (
      select 1 from gait_dev_sessions
      join gait_dev_patient_access on gait_dev_patient_access.patient_id = gait_dev_sessions.patient_id
      where gait_dev_sessions.id = gait_dev_recordings.session_id
      and gait_dev_patient_access.user_id = auth.uid()
    )
  );

create policy "gait_dev_team_create_recordings"
  on gait_dev_recordings for insert
  with check (
    exists (
      select 1 from gait_dev_sessions
      join gait_dev_patient_access on gait_dev_patient_access.patient_id = gait_dev_sessions.patient_id
      where gait_dev_sessions.id = gait_dev_recordings.session_id
      and gait_dev_patient_access.user_id = auth.uid()
      and gait_dev_patient_access.role in ('parent', 'therapist')
    )
  );

-- invitations policies
create policy "gait_dev_parents_manage_invitations"
  on gait_dev_invitations for all
  using (
    exists (
      select 1 from gait_dev_patient_access
      where gait_dev_patient_access.patient_id = gait_dev_invitations.patient_id
      and gait_dev_patient_access.user_id = auth.uid()
      and gait_dev_patient_access.role = 'parent'
    )
  );

create policy "gait_dev_invitees_see_own"
  on gait_dev_invitations for select
  using (
    email = (select email from auth.users where id = auth.uid())
  );
