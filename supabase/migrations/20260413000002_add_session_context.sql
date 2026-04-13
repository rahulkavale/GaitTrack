alter table gait_dev_sessions
  add column if not exists session_context jsonb;

alter table gait_prod_sessions
  add column if not exists session_context jsonb;
