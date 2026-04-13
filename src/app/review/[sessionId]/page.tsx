"use client";

import { useEffect, useState, use } from "react";
import { useRouter } from "next/navigation";
import { getSession, updateSessionNotes, deleteSession } from "@/lib/db";
import { GaitReport } from "@/components/GaitReport";
import { RecordingVideo } from "@/components/RecordingVideo";
import { MetricReplay } from "@/components/MetricReplay";
import { reconcileViews } from "@/lib/reconcile-views";
import type { FrameMetrics, PoseFrame, SessionMetrics } from "@/lib/types";
import type { MetricPreferences, TimelineMetricId } from "@/lib/metric-settings";

interface Recording {
  id: string;
  view_angle: string;
  duration_ms: number;
  avg_left_knee_angle: number | null;
  avg_right_knee_angle: number | null;
  avg_left_hip_angle: number | null;
  avg_right_hip_angle: number | null;
  avg_left_ankle_angle: number | null;
  avg_right_ankle_angle: number | null;
  knee_symmetry_index: number | null;
  hip_symmetry_index: number | null;
  stride_cadence: number | null;
  total_steps: number | null;
  computed_metrics?: SessionMetrics | null;
  frame_metrics?: FrameMetrics[] | null;
  frame_data?: PoseFrame[] | null;
  metric_settings_snapshot?: MetricPreferences | null;
}

interface SessionData {
  id: string;
  patient_id: string;
  label: string;
  notes: string | null;
  join_code: string | null;
  knee_symmetry_index: number | null;
  hip_symmetry_index: number | null;
  stride_cadence: number | null;
  total_steps: number | null;
  duration_seconds: number | null;
  created_at: string;
  computed_metrics?: SessionMetrics | null;
  recordings: Recording[];
}

const VIEW_LABELS: Record<string, string> = {
  reconciled: "Combined View",
  "side-left": "Left Side",
  "side-right": "Right Side",
  front: "Front",
  back: "Back",
};

// Convert a DB recording row into a minimal SessionMetrics for the reconciler
function recordingToMetrics(rec: Recording): SessionMetrics {
  if (rec.computed_metrics) return rec.computed_metrics;
  return {
    durationSeconds: (rec.duration_ms || 0) / 1000,
    totalSteps: rec.total_steps ?? 0,
    strideCadence: rec.stride_cadence ?? 0,
    avgLeftKneeAngle: rec.avg_left_knee_angle ?? 0,
    avgRightKneeAngle: rec.avg_right_knee_angle ?? 0,
    avgLeftHipAngle: rec.avg_left_hip_angle ?? 0,
    avgRightHipAngle: rec.avg_right_hip_angle ?? 0,
    avgLeftAnkleAngle: rec.avg_left_ankle_angle ?? 0,
    avgRightAnkleAngle: rec.avg_right_ankle_angle ?? 0,
    kneeSymmetryIndex: rec.knee_symmetry_index ?? 0,
    hipSymmetryIndex: rec.hip_symmetry_index ?? 0,
    // These detailed metrics aren't stored in DB yet - defaults
    leftKneeROM: 0, rightKneeROM: 0,
    leftPeakFlexion: 0, rightPeakFlexion: 0,
    crouchGaitDetected: false, crouchSeverity: 0,
    leftHipROM: 0, rightHipROM: 0,
    ankleSymmetryIndex: 0,
    toeWalkingDetected: false, toeWalkingSeverity: 0,
    leftHeelStrikePresent: true, rightHeelStrikePresent: true,
    avgForwardLean: 0, avgLateralLean: 0, trunkStability: 1,
    avgHeadTilt: 0, avgHeadForward: 0, headTiltDirection: "neutral",
    headStability: 1, headRotationBias: "neutral", avgHeadRotation: 0,
    leftArmSwingRange: 0, rightArmSwingRange: 0,
    armSwingSymmetry: 0, guardedArmDetected: false,
    leftStancePercent: 50, rightStancePercent: 50,
    doubleSupportPercent: 20, stepTimeAsymmetry: 0, legPreference: "balanced",
    weightShiftAsymmetry: 0, preferredWeightSide: "balanced",
    fallRiskDetected: false, fallRiskDirection: "neutral", fallRiskSeverity: 0,
    supportPhaseAsymmetry: 0, estimatedStepLengthAsymmetry: 0,
    walkingConfidence: "steady",
    leftToeClearance: 0, rightToeClearance: 0,
    toeDragRiskDetected: false, toeDragRiskSide: "none",
    avgPelvicObliquity: 0, pelvicDropDetected: false, pelvicDropSide: "none",
    fatigueDriftScore: 0, fatigueObserved: false,
    stepWidth: 0, lateralDeviation: 0, kneeValgusDetected: false,
    gaitDeviationIndex: 50, overallSymmetry: 0,
  };
}

export default function ReviewPage({ params }: { params: Promise<{ sessionId: string }> }) {
  const { sessionId } = use(params);
  const router = useRouter();
  const [session, setSession] = useState<SessionData | null>(null);
  const [notes, setNotes] = useState("");
  const [loading, setLoading] = useState(true);
  const [activeSection, setActiveSection] = useState<"overview" | "replay" | "advanced">("overview");
  const [overviewMode, setOverviewMode] = useState<"parent" | "clinical">("parent");
  const [advancedMode, setAdvancedMode] = useState<"trends" | "raw">("trends");
  const [replayMode, setReplayMode] = useState<"standard" | "metric">("standard");
  const [activeTab, setActiveTab] = useState<"reconciled" | string>("reconciled");
  const [focusedMetricId, setFocusedMetricId] = useState<TimelineMetricId | null>(null);

  useEffect(() => {
    getSession(sessionId).then((s) => {
      if (s) {
        const session = s as unknown as SessionData;
        setSession(session);
        setNotes(session.notes || "");
        // Default to reconciled if multiple angles, else first recording
        if (session.recordings?.length > 1) {
          setActiveTab("reconciled");
        } else if (session.recordings?.length === 1) {
          setActiveTab(session.recordings[0].view_angle);
        }
      }
      setLoading(false);
    });
  }, [sessionId]);

  const handleSaveNotes = async () => {
    if (!session) return;
    await updateSessionNotes(session.id, notes);
  };

  const handleDelete = async () => {
    if (!session) return;
    if (confirm("Delete this session? This cannot be undone.")) {
      await deleteSession(session.id);
      router.push(`/patient/${session.patient_id}`);
    }
  };

  if (loading) {
    return <div className="min-h-screen bg-gray-950 flex items-center justify-center text-gray-400">Loading...</div>;
  }
  if (!session) {
    return (
      <div className="min-h-screen bg-gray-950 flex items-center justify-center text-gray-400">
        <div className="text-center">
          <p>Session not found</p>
          <button onClick={() => router.push("/")} className="mt-4 text-green-400 underline">Go home</button>
        </div>
      </div>
    );
  }

  const date = new Date(session.created_at);
  const recordings = session.recordings || [];
  const hasMultipleAngles = recordings.length > 1;

  // Build reconciled metrics
  const reconciledMetrics = session.computed_metrics ?? (hasMultipleAngles
    ? reconcileViews(recordings.map(r => ({ view_angle: r.view_angle, metrics: recordingToMetrics(r) })))
    : recordings.length === 1 ? recordingToMetrics(recordings[0]) : null);

  // Get metrics for active tab
  const getActiveMetrics = (): SessionMetrics | null => {
    if (activeTab === "reconciled") return reconciledMetrics;
    const rec = recordings.find(r => r.view_angle === activeTab);
    return rec ? recordingToMetrics(rec) : null;
  };

  const activeMetrics = getActiveMetrics();
  const activeFrameMetrics =
    activeTab === "reconciled"
      ? undefined
      : recordings.find(r => r.view_angle === activeTab)?.frame_metrics ?? undefined;
  const activeFrameData =
    activeTab === "reconciled"
      ? undefined
      : recordings.find(r => r.view_angle === activeTab)?.frame_data ?? undefined;
  const activeMetricPreferences =
    activeTab === "reconciled"
      ? recordings.find(r => r.metric_settings_snapshot)?.metric_settings_snapshot ?? null
      : recordings.find(r => r.view_angle === activeTab)?.metric_settings_snapshot ?? null;

  return (
    <div className="min-h-screen bg-gray-950 text-white pb-8">
      <div className="bg-gray-900/95 p-4 shadow-lg shadow-black/20 safe-top">
        <button
          onClick={() => router.push(`/patient/${session.patient_id}`)}
          className="text-green-400 text-sm mb-2"
        >
          &larr; Back to sessions
        </button>
        <h1 className="text-xl font-bold">{session.label}</h1>
        <p className="text-sm text-gray-400">
          {date.toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" })}
          {" at "}
          {date.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })}
        </p>
        <p className="text-xs text-gray-500 mt-1">
          {recordings.length} angle{recordings.length !== 1 ? "s" : ""} recorded
          {session.join_code && <span> &middot; Code: <span className="font-mono text-green-400">{session.join_code}</span></span>}
        </p>
      </div>

      <div className="mx-auto max-w-4xl p-4 space-y-5">
        <div className="flex gap-1 rounded-2xl bg-gray-900 p-1 shadow-sm shadow-black/20">
          <button
            onClick={() => setActiveSection("overview")}
            className={`flex-1 px-3 py-2 rounded-lg text-sm font-medium ${
              activeSection === "overview" ? "bg-green-600 text-white" : "text-gray-400"
            }`}
          >
            Overview
          </button>
          <button
            onClick={() => setActiveSection("replay")}
            className={`flex-1 px-3 py-2 rounded-lg text-sm font-medium ${
              activeSection === "replay" ? "bg-green-600 text-white" : "text-gray-400"
            }`}
          >
            Replay
          </button>
          <button
            onClick={() => setActiveSection("advanced")}
            className={`flex-1 px-3 py-2 rounded-lg text-sm font-medium ${
              activeSection === "advanced" ? "bg-green-600 text-white" : "text-gray-400"
            }`}
          >
            Advanced
          </button>
        </div>

        {/* View toggle tabs */}
        {hasMultipleAngles && (
          <div className="flex gap-1 overflow-x-auto rounded-2xl bg-gray-900 p-1 shadow-sm shadow-black/20">
            <button
              onClick={() => setActiveTab("reconciled")}
              className={`flex-shrink-0 px-3 py-2 rounded-lg text-xs font-medium ${
              activeTab === "reconciled" ? "bg-green-600 text-white" : "text-gray-400"
              }`}
            >
              Combined View
            </button>
            {recordings.map((rec) => (
              <button
                key={rec.id}
                onClick={() => setActiveTab(rec.view_angle)}
                className={`flex-shrink-0 px-3 py-2 rounded-lg text-xs font-medium ${
                  activeTab === rec.view_angle ? "bg-green-600 text-white" : "text-gray-400"
                }`}
              >
                {VIEW_LABELS[rec.view_angle] ?? rec.view_angle}
              </button>
            ))}
          </div>
        )}

        {/* Active tab description */}
        {hasMultipleAngles && activeTab === "reconciled" && (
          <div className="rounded-2xl border border-green-800/50 bg-green-900/20 p-3 text-xs text-green-300">
            Combined view: best metrics from each camera angle merged into one analysis.
            Side view for joint angles, front view for lateral movement.
          </div>
        )}

        {activeSection === "overview" && (
          <>
            <div className="flex gap-1 rounded-2xl bg-gray-900 p-1 shadow-sm shadow-black/20">
              <button
                onClick={() => setOverviewMode("parent")}
                className={`flex-1 px-3 py-2 rounded-lg text-xs font-medium ${
                  overviewMode === "parent" ? "bg-green-600 text-white" : "text-gray-400"
                }`}
              >
                Summary
              </button>
              <button
                onClick={() => setOverviewMode("clinical")}
                className={`flex-1 px-3 py-2 rounded-lg text-xs font-medium ${
                  overviewMode === "clinical" ? "bg-green-600 text-white" : "text-gray-400"
                }`}
              >
                Detailed View
              </button>
            </div>
            {/* Gait Report */}
            {activeMetrics ? (
              <GaitReport
                metrics={activeMetrics}
                frameMetrics={activeFrameMetrics}
                metricPreferences={activeMetricPreferences}
                initialView={overviewMode}
                allowedViews={["parent", "clinical"]}
                onFocusMetric={
                  activeTab !== "reconciled" && activeFrameData && activeFrameMetrics
                    ? (metricId) => {
                        setFocusedMetricId(metricId);
                        setReplayMode("metric");
                        setActiveSection("replay");
                      }
                    : undefined
                }
              />
            ) : (
              <div className="bg-gray-800 rounded-xl p-6 text-center text-gray-400">
                No metrics available for this view.
              </div>
            )}
          </>
        )}

        {activeSection === "replay" && (
          <div className="rounded-2xl border border-white/5 bg-gray-900 p-4 shadow-sm shadow-black/20 space-y-4">
            <div className="rounded-xl border border-white/10 bg-black/20 p-3 text-xs text-gray-300">
              Replay videos are stored only on the recording device in local browser storage. They are never uploaded to cloud storage, so they may be unavailable on a different phone or browser.
            </div>
            <div className="flex gap-1 rounded-xl bg-gray-800 p-1">
              <button
                onClick={() => setReplayMode("standard")}
                className={`flex-1 px-3 py-2 rounded-lg text-xs font-medium ${
                  replayMode === "standard" ? "bg-green-600 text-white" : "text-gray-400"
                }`}
              >
                Standard Replay
              </button>
              <button
                onClick={() => setReplayMode("metric")}
                className={`flex-1 px-3 py-2 rounded-lg text-xs font-medium ${
                  replayMode === "metric" ? "bg-green-600 text-white" : "text-gray-400"
                }`}
                disabled={activeTab === "reconciled" || !activeFrameData || !activeFrameMetrics}
              >
                Focused Replay
              </button>
            </div>
            {!focusedMetricId && activeTab !== "reconciled" && activeFrameData && activeFrameMetrics && (
              <div className="rounded-xl border border-green-800/50 bg-green-900/20 p-3 text-xs text-green-200">
                Focused replay is available for this angle. Open Summary or Detailed View and tap <span className="font-semibold">Watch Focused Replay</span> on a supported metric.
              </div>
            )}
            {replayMode === "metric" && focusedMetricId && activeTab !== "reconciled" && activeFrameData && activeFrameMetrics && (
              <MetricReplay
                recordingId={recordings.find(r => r.view_angle === activeTab)?.id ?? ""}
                frameData={activeFrameData}
                frameMetrics={activeFrameMetrics}
                metricPreferences={activeMetricPreferences}
                initialMetricId={focusedMetricId}
                title="On-demand metric replay"
              />
            )}
            {replayMode === "standard" && (
              <>
                <p className="text-xs text-gray-500">
                  Replay for {activeTab === "reconciled" ? "all recorded angles" : VIEW_LABELS[activeTab] ?? activeTab}
                </p>
                {recordings.length === 0 && (
                  <p className="text-xs text-gray-500">No recordings in this session.</p>
                )}
                {recordings.map((rec) => {
                  const show = activeTab === "reconciled" || activeTab === rec.view_angle;
                  if (!show) return null;
                  return (
                    <RecordingVideo
                      key={rec.id}
                      recordingId={rec.id}
                      label={`${VIEW_LABELS[rec.view_angle] ?? rec.view_angle} view`}
                    />
                  );
                })}
              </>
            )}
            {replayMode === "metric" && (!focusedMetricId || activeTab === "reconciled" || !activeFrameData || !activeFrameMetrics) && (
              <div className="rounded-xl border border-white/10 bg-gray-800 p-4 text-sm text-gray-400">
                Metric replay works on a single recorded angle with saved local replay video. Choose an angle and launch it from a supported metric in Overview.
              </div>
            )}
          </div>
        )}

        {activeSection === "advanced" && (
          <div className="space-y-4">
            <div className="rounded-2xl border border-white/10 bg-gray-900 p-3 text-xs text-gray-300">
              Advanced views keep every existing detail, but they are separated from the default overview so the main reading flow stays simpler.
            </div>
            <div className="flex gap-1 rounded-2xl bg-gray-900 p-1 shadow-sm shadow-black/20">
              <button
                onClick={() => setAdvancedMode("trends")}
                className={`flex-1 px-3 py-2 rounded-lg text-xs font-medium ${
                  advancedMode === "trends" ? "bg-green-600 text-white" : "text-gray-400"
                }`}
              >
                Trends
              </button>
              <button
                onClick={() => setAdvancedMode("raw")}
                className={`flex-1 px-3 py-2 rounded-lg text-xs font-medium ${
                  advancedMode === "raw" ? "bg-green-600 text-white" : "text-gray-400"
                }`}
              >
                Raw Data
              </button>
            </div>
            {activeMetrics ? (
              <GaitReport
                metrics={activeMetrics}
                frameMetrics={activeFrameMetrics}
                metricPreferences={activeMetricPreferences}
                initialView={advancedMode}
                allowedViews={["trends", "raw"]}
              />
            ) : (
              <div className="bg-gray-800 rounded-xl p-6 text-center text-gray-400">
                No advanced metrics available for this view.
              </div>
            )}
          </div>
        )}

        {/* Notes */}
        <div className="rounded-2xl border border-white/5 bg-gray-800 p-4 shadow-sm shadow-black/20">
          <h2 className="text-sm font-medium text-gray-300 mb-2">Notes</h2>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Add notes about this session..."
            className="w-full bg-gray-900 text-white text-sm rounded-lg p-3 h-24 resize-none placeholder-gray-600 focus:outline-none focus:ring-1 focus:ring-green-500"
          />
          <button
            onClick={handleSaveNotes}
            className="mt-2 bg-green-600 text-white text-sm px-4 py-2 rounded-lg active:bg-green-700"
          >
            Save notes
          </button>
        </div>

        {/* Delete */}
        <button
          onClick={handleDelete}
          className="w-full rounded-2xl bg-red-900/50 py-3 text-sm text-red-400 shadow-sm shadow-black/20 active:bg-red-900"
        >
          Delete session
        </button>
      </div>
    </div>
  );
}
