-- Store computed per-frame metrics alongside raw frame data
-- This enables time-series visualization without recomputing from landmarks
alter table gait_dev_recordings add column frame_metrics jsonb;
