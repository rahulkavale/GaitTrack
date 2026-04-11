-- Store the full computed SessionMetrics as JSON on each recording
-- This captures all 30+ metrics without needing 30+ columns
alter table gait_dev_recordings add column computed_metrics jsonb;

-- Also store on sessions for the consolidated view
alter table gait_dev_sessions add column computed_metrics jsonb;
