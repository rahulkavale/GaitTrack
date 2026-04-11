-- Add join code to sessions for multi-device recording
alter table gait_dev_sessions add column join_code text;
create unique index gait_dev_sessions_join_code_idx on gait_dev_sessions(join_code) where join_code is not null;
