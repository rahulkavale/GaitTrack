// Table name helper - reads prefix from env so dev/prod use different tables
// Dev: gait_dev_patients, gait_dev_sessions, etc.
// Prod: gait_prod_patients, gait_prod_sessions, etc.

const PREFIX = process.env.NEXT_PUBLIC_TABLE_PREFIX || "gait_dev";

export const TABLES = {
  patients: `${PREFIX}_patients`,
  patient_access: `${PREFIX}_patient_access`,
  sessions: `${PREFIX}_sessions`,
  recordings: `${PREFIX}_recordings`,
  invitations: `${PREFIX}_invitations`,
  metric_preferences: `${PREFIX}_metric_preferences`,
} as const;
