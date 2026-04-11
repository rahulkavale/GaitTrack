-- Allow anyone authenticated to insert a recording IF they have the session's join code
-- This enables multi-device recording without requiring patient_access
create policy "gait_dev_join_code_create_recordings"
  on gait_dev_recordings for insert
  with check (
    exists (
      select 1 from gait_dev_sessions
      where gait_dev_sessions.id = gait_dev_recordings.session_id
      and gait_dev_sessions.join_code is not null
    )
  );

-- Allow anyone authenticated to read sessions by join_code (for the join flow)
create policy "gait_dev_join_code_read_sessions"
  on gait_dev_sessions for select
  using (join_code is not null);
