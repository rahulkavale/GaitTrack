create table gait_dev_metric_preferences (
  user_id uuid primary key references auth.users(id) on delete cascade,
  preferences jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table gait_dev_metric_preferences enable row level security;

create policy "gait_dev_users_manage_own_metric_preferences"
  on gait_dev_metric_preferences for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

alter table gait_dev_recordings
  add column metric_settings_snapshot jsonb;
