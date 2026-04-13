import { createClient } from "@/lib/supabase/client";
import { TABLES } from "./tables";
import type { SessionContext, SessionMetrics } from "./types";
import {
  DEFAULT_METRIC_PREFERENCES,
  mergeMetricPreferences,
  type MetricPreferences,
} from "./metric-settings";

const supabase = () => createClient();


// ---- Patients ----

export async function getPatients(userId?: string) {
  const resolvedUserId = userId ?? (await supabase().auth.getUser()).data.user?.id;
  if (!resolvedUserId) return [];

  const { data: accessRows, error: accessError } = await supabase()
    .from(TABLES.patient_access)
    .select("patient_id, role")
    .eq("user_id", resolvedUserId);
  if (accessError) throw accessError;
  if (!accessRows || accessRows.length === 0) return [];

  const patientIds = accessRows.map(r => r.patient_id);

  // Then fetch those patients
  const { data, error } = await supabase()
    .from(TABLES.patients)
    .select("*")
    .in("id", patientIds)
    .order("created_at", { ascending: false });
  if (error) throw error;

  // Merge access roles back in
  return (data || []).map(patient => ({
    ...patient,
    patient_access: accessRows.filter(a => a.patient_id === patient.id),
  }));
}

export async function createPatient(name: string, birthDate?: string) {
  const { data: { user } } = await supabase().auth.getUser();
  if (!user) throw new Error("Not authenticated");

  // Generate ID client-side so we can create patient + access without
  // needing to SELECT the patient back (SELECT policy requires access to exist first)
  const patientId = crypto.randomUUID();

  const { error: patientError } = await supabase()
    .from(TABLES.patients)
    .insert({ id: patientId, name, birth_date: birthDate || null });
  if (patientError) throw patientError;

  const { error: accessError } = await supabase()
    .from(TABLES.patient_access)
    .insert({ user_id: user.id, patient_id: patientId, role: "parent" });
  if (accessError) throw accessError;

  return { id: patientId, name };
}

export async function deletePatient(patientId: string) {
  // Cascade deletes handle sessions, recordings, access, invitations
  const { error } = await supabase()
    .from(TABLES.patients)
    .delete()
    .eq("id", patientId);
  if (error) throw error;
}

export async function getMetricPreferences(): Promise<MetricPreferences> {
  const { data: { user } } = await supabase().auth.getUser();
  if (!user) return DEFAULT_METRIC_PREFERENCES;

  const { data, error } = await supabase()
    .from(TABLES.metric_preferences)
    .select("preferences")
    .eq("user_id", user.id)
    .maybeSingle();
  if (error) throw error;

  return mergeMetricPreferences((data as { preferences?: Partial<MetricPreferences> } | null)?.preferences ?? null);
}

export async function saveMetricPreferences(preferences: MetricPreferences) {
  const { data: { user } } = await supabase().auth.getUser();
  if (!user) throw new Error("Not authenticated");

  const { error } = await supabase()
    .from(TABLES.metric_preferences)
    .upsert({
      user_id: user.id,
      preferences,
      updated_at: new Date().toISOString(),
    });
  if (error) throw error;
}

// ---- Sessions ----

export async function getSessions(patientId: string) {
  const { data: sessions, error } = await supabase()
    .from(TABLES.sessions)
    .select("*")
    .eq("patient_id", patientId)
    .order("created_at", { ascending: false });
  if (error) throw error;
  if (!sessions || sessions.length === 0) return [];

  // Fetch recordings for these sessions
  const sessionIds = sessions.map(s => s.id);
  const { data: recordings } = await supabase()
    .from(TABLES.recordings)
    .select("id, session_id, view_angle, duration_ms, knee_symmetry_index, hip_symmetry_index, stride_cadence, total_steps, avg_left_knee_angle, avg_right_knee_angle, avg_left_hip_angle, avg_right_hip_angle, computed_metrics")
    .in("session_id", sessionIds);

  return sessions.map(session => ({
    ...session,
    recordings: (recordings || []).filter(r => r.session_id === session.id),
  }));
}

export async function getSession(sessionId: string) {
  const { data: session, error } = await supabase()
    .from(TABLES.sessions)
    .select("*")
    .eq("id", sessionId)
    .single();
  if (error) throw error;
  if (!session) return null;

  const { data: recordings } = await supabase()
    .from(TABLES.recordings)
    .select("*")
    .eq("session_id", sessionId);

  return { ...session, recordings: recordings || [] };
}

function generateJoinCode(): string {
  return Math.floor(1000 + Math.random() * 9000).toString();
}

export async function createSession(patientId: string, label: string, sessionContext?: SessionContext | null) {
  const sessionId = crypto.randomUUID();
  const joinCode = generateJoinCode();
  const { error } = await supabase()
    .from(TABLES.sessions)
    .insert({ id: sessionId, patient_id: patientId, label, join_code: joinCode, session_context: sessionContext ?? null });
  if (error) throw error;
  return { id: sessionId, label, join_code: joinCode };
}

export async function getSessionByJoinCode(joinCode: string) {
  const { data: session, error } = await supabase()
    .from(TABLES.sessions)
    .select("*")
    .eq("join_code", joinCode)
    .single();
  if (error) throw error;
  if (!session) return null;

  const { data: recordings } = await supabase()
    .from(TABLES.recordings)
    .select("id, view_angle")
    .eq("session_id", session.id);

  return { ...session, recordings: recordings || [] };
}

export async function updateSessionMetrics(
  sessionId: string,
  metrics: {
    knee_symmetry_index: number;
    hip_symmetry_index: number;
    stride_cadence: number;
    total_steps: number;
    duration_seconds: number;
  }
) {
  const { error } = await supabase()
    .from(TABLES.sessions)
    .update(metrics)
    .eq("id", sessionId);
  if (error) throw error;
}

export async function updateSessionNotes(sessionId: string, notes: string) {
  const { error } = await supabase()
    .from(TABLES.sessions)
    .update({ notes })
    .eq("id", sessionId);
  if (error) throw error;
}

export async function updateSessionContext(sessionId: string, sessionContext: SessionContext | null) {
  const { error } = await supabase()
    .from(TABLES.sessions)
    .update({ session_context: sessionContext })
    .eq("id", sessionId);
  if (error) throw error;
}

export async function deleteSession(sessionId: string) {
  const { error } = await supabase()
    .from(TABLES.sessions)
    .delete()
    .eq("id", sessionId);
  if (error) throw error;
}

// ---- Recordings ----

export async function saveRecording(
  sessionId: string,
  viewAngle: string,
  durationMs: number,
  metrics: SessionMetrics,
  frameData: unknown[],
  frameMetrics?: unknown[],
  metricSettingsSnapshot?: MetricPreferences
) {
  const recordingId = crypto.randomUUID();
  const { error } = await supabase()
    .from(TABLES.recordings)
    .insert({
      id: recordingId,
      session_id: sessionId,
      view_angle: viewAngle,
      duration_ms: Math.round(durationMs),
      avg_left_knee_angle: metrics.avgLeftKneeAngle,
      avg_right_knee_angle: metrics.avgRightKneeAngle,
      avg_left_hip_angle: metrics.avgLeftHipAngle,
      avg_right_hip_angle: metrics.avgRightHipAngle,
      avg_left_ankle_angle: metrics.avgLeftAnkleAngle,
      avg_right_ankle_angle: metrics.avgRightAnkleAngle,
      knee_symmetry_index: metrics.kneeSymmetryIndex,
      hip_symmetry_index: metrics.hipSymmetryIndex,
      stride_cadence: metrics.strideCadence,
      total_steps: Math.round(metrics.totalSteps),
      frame_data: frameData,
      frame_metrics: frameMetrics ?? null,
      computed_metrics: metrics,
      metric_settings_snapshot: metricSettingsSnapshot ?? null,
    });
  if (error) throw error;
  return { id: recordingId };
}

// ---- Consolidated metrics ----

export async function consolidateSessionMetrics(sessionId: string) {
  const { data: recordings, error } = await supabase()
    .from(TABLES.recordings)
    .select("*")
    .eq("session_id", sessionId);
  if (error) throw error;
  if (!recordings || recordings.length === 0) return;

  const n = recordings.length;
  const avg = (field: string) =>
    recordings.reduce((sum: number, r: Record<string, number | null>) => sum + (r[field] ?? 0), 0) / n;

  // Basic column metrics
  const consolidated = {
    knee_symmetry_index: avg("knee_symmetry_index"),
    hip_symmetry_index: avg("hip_symmetry_index"),
    stride_cadence: avg("stride_cadence"),
    total_steps: Math.round(
      recordings.reduce((sum: number, r: Record<string, number | null>) => sum + (r["total_steps"] ?? 0), 0)
    ),
    duration_seconds:
      recordings.reduce((sum: number, r: Record<string, number | null>) => sum + (r["duration_ms"] ?? 0), 0) / 1000,
  };

  await updateSessionMetrics(sessionId, consolidated);

  // Also reconcile full metrics from computed_metrics JSON and store on session
  const recordingsWithMetrics = (recordings as unknown as Array<{ view_angle: string; computed_metrics: SessionMetrics | null }>)
    .filter(r => r.computed_metrics != null);

  if (recordingsWithMetrics.length > 0) {
    const { reconcileViews } = await import("./reconcile-views");
    const reconciled = reconcileViews(
      recordingsWithMetrics.map(r => ({ view_angle: r.view_angle, metrics: r.computed_metrics! }))
    );
    if (reconciled) {
      await supabase()
        .from(TABLES.sessions)
        .update({ computed_metrics: reconciled })
        .eq("id", sessionId);
    }
  }
}

// ---- Sharing ----

export async function inviteToPatient(patientId: string, email: string, role: string) {
  const { error } = await supabase()
    .from(TABLES.invitations)
    .insert({ patient_id: patientId, email, role });
  if (error) throw error;
}

export async function getPendingInvitations() {
  const { data: { user } } = await supabase().auth.getUser();
  if (!user) return [];
  if (!user.email) return [];

  const { data: invitations, error } = await supabase()
    .from(TABLES.invitations)
    .select("*")
    .eq("email", user.email)
    .eq("accepted", false);
  if (error) {
    console.error("Failed to load invitations:", error);
    return [];
  }
  if (!invitations || invitations.length === 0) return [];

  // Fetch patient names separately
  const patientIds = [...new Set(invitations.map(i => i.patient_id))];
  const { data: patients } = await supabase()
    .from(TABLES.patients)
    .select("id, name")
    .in("id", patientIds);

  const patientMap = new Map((patients || []).map(p => [p.id, p.name]));

  return invitations.map(inv => ({
    ...inv,
    patients: { name: patientMap.get(inv.patient_id) || "Unknown" },
  }));
}

export async function acceptInvitation(invitationId: string) {
  const { data: { user } } = await supabase().auth.getUser();
  if (!user) throw new Error("Not authenticated");

  const { data: invitation, error: invError } = await supabase()
    .from(TABLES.invitations)
    .select("*")
    .eq("id", invitationId)
    .single();
  if (invError) throw invError;

  const { error: accessError } = await supabase()
    .from(TABLES.patient_access)
    .insert({
      user_id: user.id,
      patient_id: invitation.patient_id,
      role: invitation.role,
    });
  if (accessError) throw accessError;

  await supabase()
    .from(TABLES.invitations)
    .update({ accepted: true })
    .eq("id", invitationId);
}

export async function getPatientTeam(patientId: string) {
  const { data, error } = await supabase()
    .from(TABLES.patient_access)
    .select("role, user_id")
    .eq("patient_id", patientId);
  if (error) throw error;
  return data;
}
