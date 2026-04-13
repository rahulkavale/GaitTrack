"use client";

import { useEffect, useState } from "react";
import { GaitTimelines } from "@/components/MetricsTimeline";
import {
  toFlexionAngle,
  toAnkleClinical,
  classifyGaitPatterns,
  parentMetrics,
  NORMS,
  classifyRange,
  type GaitPattern,
  type Severity,
} from "@/lib/clinical-norms";
import type { SessionMetrics, FrameMetrics } from "@/lib/types";
import {
  getSummaryMetricOrder,
  mergeMetricPreferences,
  type MetricPreferences,
} from "@/lib/metric-settings";
import type { TimelineMetricId } from "@/lib/metric-settings";

// ---- Shared UI components ----

const SEV_COLORS: Record<Severity, string> = {
  normal: "text-green-400",
  mild: "text-yellow-400",
  moderate: "text-orange-400",
  severe: "text-red-400",
};

const SEV_BG: Record<Severity, string> = {
  normal: "bg-green-900/30 border-green-800",
  mild: "bg-yellow-900/30 border-yellow-800",
  moderate: "bg-orange-900/30 border-orange-800",
  severe: "bg-red-900/30 border-red-800",
};

const STATUS_COLORS: Record<string, string> = {
  good: "text-green-400",
  improving: "text-green-400",
  stable: "text-gray-400",
  watch: "text-yellow-400",
  concern: "text-red-400",
};

function SeverityDot({ severity }: { severity: Severity }) {
  const colors: Record<Severity, string> = {
    normal: "bg-green-400", mild: "bg-yellow-400", moderate: "bg-orange-400", severe: "bg-red-400",
  };
  return <span className={`inline-block w-2 h-2 rounded-full ${colors[severity]} mr-1.5`} />;
}

function Meter({ label, value, max, unit }: { label: string; value: number; max: number; unit: string }) {
  const pct = Math.min(100, (value / max) * 100);
  return (
    <div className="mb-2">
      <div className="flex justify-between text-xs mb-0.5">
        <span className="text-gray-400">{label}</span>
        <span className="font-mono text-white">{Math.round(value)}{unit}</span>
      </div>
      <div className="w-full bg-gray-700 rounded-full h-1.5">
        <div className="h-1.5 rounded-full bg-green-500" style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

function CompareBar({ label, left, right, unit }: { label: string; left: number; right: number; unit: string }) {
  const max = Math.max(Math.abs(left), Math.abs(right), 1);
  return (
    <div className="mb-2">
      <div className="text-xs text-gray-400 mb-0.5">{label}</div>
      <div className="flex gap-1 items-center">
        <span className="text-xs text-green-400 w-10 text-right font-mono">{Math.round(left)}{unit}</span>
        <div className="flex-1 flex gap-0.5">
          <div className="h-2.5 bg-green-500 rounded-l" style={{ width: `${(Math.abs(left) / max) * 50}%` }} />
          <div className="h-2.5 bg-blue-500 rounded-r" style={{ width: `${(Math.abs(right) / max) * 50}%` }} />
        </div>
        <span className="text-xs text-blue-400 w-10 font-mono">{Math.round(right)}{unit}</span>
      </div>
      <div className="flex justify-between text-[10px] text-gray-600 px-12"><span>L</span><span>R</span></div>
    </div>
  );
}

// ---- Props ----

interface GaitReportProps {
  metrics: SessionMetrics;
  frameMetrics?: FrameMetrics[];
  previousMetrics?: SessionMetrics | null;
  previousFrameMetrics?: FrameMetrics[];
  previousLabel?: string;
  metricPreferences?: MetricPreferences | null;
  onFocusMetric?: (metricId: TimelineMetricId) => void;
  initialView?: "parent" | "clinical" | "raw" | "trends";
  allowedViews?: Array<"parent" | "clinical" | "raw" | "trends">;
}

type ReportView = "parent" | "clinical" | "raw" | "trends";

function focusMetricForSummary(metricId: ReturnType<typeof getSummaryMetricOrder>[number]): TimelineMetricId | null {
  switch (metricId) {
    case "knee_symmetry":
      return "knee_symmetry";
    case "trunk_stability":
      return "trunk_lateral_lean";
    case "head_stability":
      return "head_tilt";
    default:
      return null;
  }
}

function focusMetricForFeature(featureId: string): TimelineMetricId | null {
  switch (featureId) {
    case "persistent_knee_bend":
    case "reduced_knee_motion":
    case "knee_overextension":
      return "left_knee_angle";
    case "forefoot_first_landing":
      return "left_ankle_angle";
    case "side_lean_of_trunk":
      return "trunk_lateral_lean";
    default:
      return null;
  }
}

function ActionButton({
  onClick,
  label = "Watch Focused Replay",
}: {
  onClick: () => void;
  label?: string;
}) {
  return (
    <button
      onClick={onClick}
      className="mt-2 rounded-full bg-green-600 px-3 py-1.5 text-[11px] font-medium text-white shadow-sm active:bg-green-700"
    >
      {label}
    </button>
  );
}

function formatSeverityLabel(severity: Severity) {
  return severity === "normal" ? "within expected range" : severity;
}

function directionLabel(direction: SessionMetrics["fallRiskDirection"]) {
  if (direction === "neutral") return "no clear direction";
  if (direction === "forward") return "forward";
  return `toward the ${direction}`;
}

function confidenceLabel(confidence: SessionMetrics["walkingConfidence"]) {
  switch (confidence) {
    case "steady":
      return "steady unsupported pattern";
    case "watch":
      return "watch closely";
    case "support-recommended":
      return "support may be needed";
  }
}

// ---- Main component ----

export function GaitReport({
  metrics,
  frameMetrics,
  previousMetrics,
  previousFrameMetrics,
  previousLabel,
  metricPreferences,
  onFocusMetric,
  initialView = "parent",
  allowedViews = ["parent", "clinical", "raw", "trends"],
}: GaitReportProps) {
  const [view, setView] = useState<ReportView>(initialView);
  const m = metrics;
  const preferences = mergeMetricPreferences(metricPreferences ?? undefined);

  const visibleViews: ReportView[] = allowedViews.length > 0 ? allowedViews : ["parent"];
  useEffect(() => {
    setView(initialView);
  }, [initialView]);

  useEffect(() => {
    if (!visibleViews.includes(view)) {
      setView(visibleViews[0]);
    }
  }, [view, visibleViews]);

  // Convert to clinical angles
  const leftKneeFlexion = toFlexionAngle(m.avgLeftKneeAngle);
  const rightKneeFlexion = toFlexionAngle(m.avgRightKneeAngle);
  const leftAnkleClinical = toAnkleClinical(m.avgLeftAnkleAngle);
  const rightAnkleClinical = toAnkleClinical(m.avgRightAnkleAngle);
  const leftHipFlexion = toFlexionAngle(m.avgLeftHipAngle);
  const rightHipFlexion = toFlexionAngle(m.avgRightHipAngle);

  // Signed lateral lean from frame data (positive = lean to right; falls back to 0)
  const trunkLateralLeanSigned = frameMetrics && frameMetrics.length > 0
    ? frameMetrics.reduce((sum, f) => sum + f.trunkLateralLean, 0) / frameMetrics.length
    : 0;

  // Classify gait patterns
  const patterns = classifyGaitPatterns({
    leftKneeFlexionAtContact: leftKneeFlexion,
    rightKneeFlexionAtContact: rightKneeFlexion,
    leftKneeFlexionMidStance: leftKneeFlexion, // approximation
    rightKneeFlexionMidStance: rightKneeFlexion,
    peakLeftKneeFlexionSwing: toFlexionAngle(m.leftPeakFlexion),
    peakRightKneeFlexionSwing: toFlexionAngle(m.rightPeakFlexion),
    leftKneeROM: m.leftKneeROM,
    rightKneeROM: m.rightKneeROM,
    leftAnkleAtContact: leftAnkleClinical,
    rightAnkleAtContact: rightAnkleClinical,
    hipFlexionAtContact: (leftHipFlexion + rightHipFlexion) / 2,
    trunkLateralLeanSigned,
    armSwingRange: (m.leftArmSwingRange + m.rightArmSwingRange) / 2,
    stepWidth: m.stepWidth,
    leftPeakKneeExtension: -leftKneeFlexion,
    rightPeakKneeExtension: -rightKneeFlexion,
    featurePreferences: preferences.features,
  });

  const visiblePatterns = patterns.filter((pattern) => preferences.features[pattern.id].enabled);
  const detectedPatterns = visiblePatterns.filter(p => p.detected);
  const leftKneeStatus = classifyRange(leftKneeFlexion, NORMS.knee.stanceFlexion);
  const rightKneeStatus = classifyRange(rightKneeFlexion, NORMS.knee.stanceFlexion);
  const leftArmStatus = classifyRange(m.leftArmSwingRange, NORMS.armSwing.range);
  const rightArmStatus = classifyRange(m.rightArmSwingRange, NORMS.armSwing.range);
  const weightShiftPercent = Math.round(m.weightShiftAsymmetry * 100);
  const stepLengthAsymmetryPercent = Math.round(m.estimatedStepLengthAsymmetry * 100);
  const supportPhaseAsymmetryPercent = Math.round(m.supportPhaseAsymmetry * 100);
  const fatiguePercent = Math.round(m.fatigueDriftScore * 100);
  const fallSeverityLabel: Severity =
    m.fallRiskSeverity >= 0.75 ? "severe" : m.fallRiskSeverity >= 0.55 ? "moderate" : m.fallRiskSeverity >= 0.35 ? "mild" : "normal";

  // Parent metrics
  const pMetrics = parentMetrics(
    {
      gdi: m.gaitDeviationIndex,
      overallSymmetry: m.overallSymmetry,
      kneeSymmetry: m.kneeSymmetryIndex,
      cadence: m.strideCadence,
      trunkStability: m.trunkStability,
      headStability: m.headStability,
    },
    previousMetrics ? {
      gdi: previousMetrics.gaitDeviationIndex,
      overallSymmetry: previousMetrics.overallSymmetry,
      kneeSymmetry: previousMetrics.kneeSymmetryIndex,
      cadence: previousMetrics.strideCadence,
      trunkStability: previousMetrics.trunkStability,
      headStability: previousMetrics.headStability,
    } : null
  );
  const summaryMetricOrder = getSummaryMetricOrder();
  const visibleSummaryMetricIds = summaryMetricOrder.filter(
    (metricId) => preferences.summary[metricId].enabled
  );
  const visibleParentMetrics = pMetrics
    .map((metric, index) => ({
      ...metric,
      metricId: summaryMetricOrder[index],
    }))
    .filter((metric) => metric.metricId ? visibleSummaryMetricIds.includes(metric.metricId) : false);
  const canFocusReplay =
    typeof onFocusMetric === "function" &&
    (
      visibleParentMetrics.some((metric) => metric.metricId && focusMetricForSummary(metric.metricId)) ||
      visiblePatterns.some((pattern) => focusMetricForFeature(pattern.id))
    );

  return (
    <div className="space-y-4">
      {/* View toggle */}
      <div className="flex gap-1 bg-gray-900 rounded-xl p-1 overflow-x-auto">
        {visibleViews.map((v) => (
          <button
            key={v}
            onClick={() => setView(v)}
            className={`flex-shrink-0 px-3 py-2 rounded-lg text-xs font-medium capitalize ${
              view === v ? "bg-green-600 text-white" : "text-gray-400"
            }`}
          >
            {v === "parent" ? "Summary" : v === "clinical" ? "Clinical" : v === "raw" ? "Raw Data" : "Trends"}
          </button>
        ))}
      </div>

      {/* Overall score - shown in all views */}
      <div className="rounded-2xl border border-white/5 bg-gray-800 p-5 text-center shadow-sm shadow-black/20">
        <div className="text-xs text-gray-400 mb-1">Gait Deviation Index</div>
        <div className="text-4xl font-mono font-bold text-white">{m.gaitDeviationIndex}</div>
        <div className="text-xs text-gray-500 mt-1">out of 100 (higher = more typical gait)</div>
        {previousMetrics && (
          <div className="mt-2 text-xs">
            <span className="text-gray-500">vs last session: </span>
            {(() => {
              const delta = m.gaitDeviationIndex - previousMetrics.gaitDeviationIndex;
              const color = delta > 0 ? "text-green-400" : delta < 0 ? "text-red-400" : "text-gray-400";
              const arrow = delta > 0 ? "↑" : delta < 0 ? "↓" : "→";
              return <span className={`font-mono ${color}`}>{arrow} {Math.abs(delta)} points</span>;
            })()}
          </div>
        )}
      </div>

      {canFocusReplay && (view === "parent" || view === "clinical") && (
        <div className="rounded-2xl border border-green-700/60 bg-green-900/20 p-4 shadow-sm shadow-green-950/10">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-sm font-medium text-green-200">Metric replay available</p>
              <p className="mt-1 text-xs text-green-100/80">
                Tap any <span className="font-semibold text-green-200">Watch Focused Replay</span> button below to jump into a color-coded replay for that metric.
              </p>
            </div>
            <div className="rounded-full bg-green-500/20 px-3 py-1 text-[10px] font-medium tracking-[0.18em] text-green-200">
              NEW
            </div>
          </div>
        </div>
      )}

      {/* ======== PARENT VIEW ======== */}
      {view === "parent" && (
        <div className="space-y-4">
          {/* Simple metric cards */}
          <div className="space-y-2">
            {visibleParentMetrics.map((pm) => (
              <div key={pm.label} className="flex items-center justify-between rounded-2xl border border-white/5 bg-gray-800 p-4 shadow-sm shadow-black/20">
                <div>
                  <div className="text-sm text-white">{pm.label}</div>
                  {pm.change && (
                    <div className={`text-xs ${STATUS_COLORS[pm.status]}`}>{pm.change}</div>
                  )}
                </div>
                <div className="text-right">
                  <div className="text-lg font-mono font-bold text-white">{pm.value}</div>
                  {pm.metricId && focusMetricForSummary(pm.metricId) && onFocusMetric && (
                    <ActionButton onClick={() => onFocusMetric(focusMetricForSummary(pm.metricId)!)} />
                  )}
                </div>
              </div>
            ))}
          </div>

          {/* Observed movement features in plain language */}
          {detectedPatterns.length > 0 && (
            <div className="space-y-2">
              <h2 className="text-sm font-medium text-gray-400">Observed movement features</h2>
              {detectedPatterns.map((p) => (
                <div key={p.name} className={`rounded-2xl p-4 border shadow-sm ${SEV_BG[p.severity]}`}>
                  <div className="flex items-center gap-1 mb-1">
                    <SeverityDot severity={p.severity} />
                    <span className={`text-sm font-medium ${SEV_COLORS[p.severity]}`}>{p.name}</span>
                    <span className="text-xs text-gray-500 ml-auto">{p.severity}</span>
                  </div>
                  <p className="text-xs text-gray-300">{p.parentDescription}</p>
                  {focusMetricForFeature(p.id) && onFocusMetric && (
                    <ActionButton onClick={() => onFocusMetric(focusMetricForFeature(p.id)!)} />
                  )}
                </div>
              ))}
            </div>
          )}

          {detectedPatterns.length === 0 && (
            <div className="rounded-2xl border border-green-800/50 bg-green-900/20 p-4 text-center shadow-sm shadow-green-950/10">
              <p className="text-sm text-green-300">No notable movement features were flagged in this capture</p>
            </div>
          )}

          {/* Summary stats */}
          <div className="grid grid-cols-3 gap-2">
            <div className="rounded-2xl border border-white/5 bg-gray-800 p-3 text-center shadow-sm shadow-black/20">
              <div className="text-[10px] text-gray-500">Duration</div>
              <div className="text-lg font-mono font-bold">{Math.round(m.durationSeconds)}s</div>
            </div>
            <div className="rounded-2xl border border-white/5 bg-gray-800 p-3 text-center shadow-sm shadow-black/20">
              <div className="text-[10px] text-gray-500">Steps</div>
              <div className="text-lg font-mono font-bold">{m.totalSteps}</div>
            </div>
            <div className="rounded-2xl border border-white/5 bg-gray-800 p-3 text-center shadow-sm shadow-black/20">
              <div className="text-[10px] text-gray-500">Cadence</div>
              <div className="text-lg font-mono font-bold">{Math.round(m.strideCadence)}</div>
            </div>
          </div>

          <div className="rounded-2xl border border-white/5 bg-gray-800 p-4 shadow-sm shadow-black/20">
            <h2 className="text-sm font-medium text-gray-300">Side-Specific Movement Check</h2>
            <div className="mt-3 space-y-3 text-sm">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-white">Weight shift</p>
                  <p className="mt-1 text-xs text-gray-400">
                    {m.preferredWeightSide === "balanced"
                      ? `Weight-bearing looks fairly even between legs with about ${weightShiftPercent}% asymmetry.`
                      : `More loading appears to stay on the ${m.preferredWeightSide} leg, with about ${weightShiftPercent}% asymmetry.`}
                  </p>
                </div>
                <span className={`text-xs ${m.preferredWeightSide === "balanced" ? "text-green-400" : "text-yellow-400"}`}>
                  {m.preferredWeightSide === "balanced" ? "balanced" : `favoring ${m.preferredWeightSide}`}
                </span>
              </div>
              {onFocusMetric && <ActionButton onClick={() => onFocusMetric("weight_shift")} />}

              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div className="rounded-xl border border-white/5 bg-gray-900/60 p-3">
                  <p className="text-xs uppercase tracking-wide text-gray-500">Left knee bend</p>
                  <p className="mt-1 text-sm text-white">{Math.round(leftKneeFlexion)}° bend</p>
                  <p className={`mt-1 text-xs ${SEV_COLORS[leftKneeStatus.severity]}`}>
                    {formatSeverityLabel(leftKneeStatus.severity)}
                  </p>
                  {onFocusMetric && <ActionButton onClick={() => onFocusMetric("left_knee_angle")} label="Focus Left Knee" />}
                </div>
                <div className="rounded-xl border border-white/5 bg-gray-900/60 p-3">
                  <p className="text-xs uppercase tracking-wide text-gray-500">Right knee bend</p>
                  <p className="mt-1 text-sm text-white">{Math.round(rightKneeFlexion)}° bend</p>
                  <p className={`mt-1 text-xs ${SEV_COLORS[rightKneeStatus.severity]}`}>
                    {formatSeverityLabel(rightKneeStatus.severity)}
                  </p>
                  {onFocusMetric && <ActionButton onClick={() => onFocusMetric("right_knee_angle")} label="Focus Right Knee" />}
                </div>
              </div>

              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div className="rounded-xl border border-white/5 bg-gray-900/60 p-3">
                  <p className="text-xs uppercase tracking-wide text-gray-500">Left arm swing</p>
                  <p className="mt-1 text-sm text-white">{Math.round(m.leftArmSwingRange)}° range</p>
                  <p className={`mt-1 text-xs ${SEV_COLORS[leftArmStatus.severity]}`}>
                    {formatSeverityLabel(leftArmStatus.severity)}
                  </p>
                  {onFocusMetric && <ActionButton onClick={() => onFocusMetric("left_arm_swing")} label="Focus Left Arm" />}
                </div>
                <div className="rounded-xl border border-white/5 bg-gray-900/60 p-3">
                  <p className="text-xs uppercase tracking-wide text-gray-500">Right arm swing</p>
                  <p className="mt-1 text-sm text-white">{Math.round(m.rightArmSwingRange)}° range</p>
                  <p className={`mt-1 text-xs ${SEV_COLORS[rightArmStatus.severity]}`}>
                    {formatSeverityLabel(rightArmStatus.severity)}
                  </p>
                  {onFocusMetric && <ActionButton onClick={() => onFocusMetric("right_arm_swing")} label="Focus Right Arm" />}
                </div>
              </div>

              <div className="flex items-start justify-between gap-3 rounded-xl border border-white/5 bg-gray-900/60 p-3">
                <div>
                  <p className="text-white">Fall tendency</p>
                  <p className="mt-1 text-xs text-gray-400">
                    {m.fallRiskDetected
                      ? `Balance loss risk was flagged ${directionLabel(m.fallRiskDirection)} during the observed walk.`
                      : "No strong fall direction was flagged in this recording."}
                  </p>
                </div>
                <span className={`text-xs ${SEV_COLORS[fallSeverityLabel]}`}>
                  {m.fallRiskDetected ? `${fallSeverityLabel} ${directionLabel(m.fallRiskDirection)}` : "not flagged"}
                </span>
              </div>
              {onFocusMetric && <ActionButton onClick={() => onFocusMetric("fall_risk")} />}
            </div>
          </div>

          <div className="rounded-2xl border border-blue-800/50 bg-blue-950/20 p-4 shadow-sm shadow-blue-950/10">
            <h2 className="text-sm font-medium text-blue-100">Parent-Facing Video-Based Estimates</h2>
            <p className="mt-1 text-xs text-blue-200/80">
              These are observational estimates from video, meant to make the recording easier to understand. They are not definitive biomechanics.
            </p>
            <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div className="rounded-xl border border-white/5 bg-gray-900/60 p-3">
                <div className="text-xs uppercase tracking-wide text-gray-500">Walking confidence</div>
                <div className="mt-1 text-sm text-white">{confidenceLabel(m.walkingConfidence)}</div>
                <div className={`mt-1 text-xs ${m.walkingConfidence === "steady" ? "text-green-400" : m.walkingConfidence === "watch" ? "text-yellow-400" : "text-red-400"}`}>
                  estimate only from video posture and timing
                </div>
              </div>
              <div className="rounded-xl border border-white/5 bg-gray-900/60 p-3">
                <div className="text-xs uppercase tracking-wide text-gray-500">Sustained walking time</div>
                <div className="mt-1 text-sm text-white">{Math.round(m.durationSeconds)} seconds</div>
                <div className="mt-1 text-xs text-gray-400">Use repeated sessions over time to judge endurance change.</div>
              </div>
              <div className="rounded-xl border border-white/5 bg-gray-900/60 p-3">
                <div className="text-xs uppercase tracking-wide text-gray-500">Tripping / toe drag</div>
                <div className="mt-1 text-sm text-white">
                  {m.toeDragRiskDetected ? `watch ${m.toeDragRiskSide} side` : "not flagged"}
                </div>
                <div className="mt-1 text-xs text-gray-400">
                  Left clearance {m.leftToeClearance.toFixed(3)}, right clearance {m.rightToeClearance.toFixed(3)}.
                </div>
                {onFocusMetric && (
                  <div className="mt-1 flex gap-2">
                    <ActionButton onClick={() => onFocusMetric("left_toe_clearance")} label="Focus Left Toe" />
                    <ActionButton onClick={() => onFocusMetric("right_toe_clearance")} label="Focus Right Toe" />
                  </div>
                )}
              </div>
              <div className="rounded-xl border border-white/5 bg-gray-900/60 p-3">
                <div className="text-xs uppercase tracking-wide text-gray-500">Fatigue drift</div>
                <div className="mt-1 text-sm text-white">{m.fatigueObserved ? "movement changed later in the clip" : "no strong fatigue change flagged"}</div>
                <div className="mt-1 text-xs text-gray-400">{fatiguePercent}% drift based on posture and foot-clearance changes.</div>
                {onFocusMetric && <ActionButton onClick={() => onFocusMetric("fatigue_drift")} label="Watch Fatigue Replay" />}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ======== CLINICAL VIEW ======== */}
      {view === "clinical" && (
        <div className="space-y-4">
          {/* Observed movement features */}
          <div className="space-y-2">
            <h2 className="text-sm font-medium text-gray-400">Observed Movement Features</h2>
            {visiblePatterns.map((p) => (
              <div key={p.name} className={`rounded-xl p-3 border ${SEV_BG[p.severity]}`}>
                <div className="flex items-center gap-1 mb-1">
                  <SeverityDot severity={p.severity} />
                  <span className={`text-sm font-medium ${SEV_COLORS[p.severity]}`}>{p.name}</span>
                  <span className="text-xs text-gray-500 ml-auto">{p.severity}</span>
                </div>
                <p className="text-xs text-gray-300">{p.clinicalDescription}</p>
                {focusMetricForFeature(p.id) && onFocusMetric && (
                  <ActionButton onClick={() => onFocusMetric(focusMetricForFeature(p.id)!)} />
                )}
              </div>
            ))}
          </div>

          {/* Joint angles (clinical terms) */}
          <div className="bg-gray-800 rounded-xl p-4">
            <h2 className="text-sm font-medium text-gray-300 mb-3">Joint Angles (Clinical)</h2>

            <div className="text-xs text-gray-500 mb-2">Knee Flexion (0° = full extension)</div>
            <CompareBar label="Stance phase" left={leftKneeFlexion} right={rightKneeFlexion} unit="°" />
            <CompareBar label="ROM" left={m.leftKneeROM} right={m.rightKneeROM} unit="°" />

            <div className="text-xs text-gray-500 mt-3 mb-2">Hip Flexion</div>
            <CompareBar label="At initial contact" left={leftHipFlexion} right={rightHipFlexion} unit="°" />
            <CompareBar label="ROM" left={m.leftHipROM} right={m.rightHipROM} unit="°" />

            <div className="text-xs text-gray-500 mt-3 mb-2">Ankle (+ dorsiflexion / - plantarflexion)</div>
            <CompareBar label="At initial contact" left={leftAnkleClinical} right={rightAnkleClinical} unit="°" />
          </div>

          {/* Gait timing */}
          <div className="bg-gray-800 rounded-xl p-4">
            <h2 className="text-sm font-medium text-gray-300 mb-3">Gait Timing</h2>
            <CompareBar label="Stance phase" left={m.leftStancePercent} right={m.rightStancePercent} unit="%" />
            <Meter label="Double support" value={m.doubleSupportPercent} max={50} unit="%" />
            <div className="flex justify-between text-xs mt-1">
              <span className="text-gray-400">Step time asymmetry</span>
              <span className="font-mono">{Math.round(m.stepTimeAsymmetry * 100)}%</span>
            </div>
            {m.legPreference !== "balanced" && (
              <p className="text-xs text-yellow-400 mt-1">Weight-bearing preference: {m.legPreference} leg</p>
            )}
            <div className="mt-2 flex justify-between text-xs">
              <span className="text-gray-400">Weight shift asymmetry</span>
              <span className="font-mono text-white">{weightShiftPercent}%</span>
            </div>
            <div className="mt-1 flex justify-between text-xs">
              <span className="text-gray-400">Preferred loading side</span>
              <span className={m.preferredWeightSide === "balanced" ? "text-green-400" : "text-yellow-400"}>
                {m.preferredWeightSide}
              </span>
            </div>
            <div className="mt-1 flex justify-between text-xs">
              <span className="text-gray-400">Support phase asymmetry</span>
              <span className="font-mono text-white">{supportPhaseAsymmetryPercent}%</span>
            </div>
            <div className="mt-1 flex justify-between text-xs">
              <span className="text-gray-400">Step length asymmetry estimate</span>
              <span className="font-mono text-white">{stepLengthAsymmetryPercent}%</span>
            </div>
            <div className="text-xs text-gray-500 mt-2">
              Normal: stance 58-62%, double support 16-24%
            </div>
          </div>

          {/* Trunk & Head */}
          <div className="bg-gray-800 rounded-xl p-4">
            <h2 className="text-sm font-medium text-gray-300 mb-3">Trunk & Head</h2>
            <div className="flex justify-between text-xs mb-1">
              <span className="text-gray-400">Forward lean</span>
              <span>
                <span className="font-mono text-white">{Math.round(m.avgForwardLean)}°</span>
                <span className={`ml-2 ${SEV_COLORS[classifyRange(m.avgForwardLean, NORMS.trunk.forwardLean).severity]}`}>
                  ({classifyRange(m.avgForwardLean, NORMS.trunk.forwardLean).severity})
                </span>
              </span>
            </div>
            <div className="flex justify-between text-xs mb-1">
              <span className="text-gray-400">Lateral lean</span>
              <span>
                <span className="font-mono text-white">{Math.round(m.avgLateralLean)}°</span>
                <span className={`ml-2 ${SEV_COLORS[classifyRange(m.avgLateralLean, NORMS.trunk.lateralLean).severity]}`}>
                  ({classifyRange(m.avgLateralLean, NORMS.trunk.lateralLean).severity})
                </span>
              </span>
            </div>
            <div className="flex justify-between text-xs mb-1">
              <span className="text-gray-400">Head tilt</span>
              <span>
                <span className="font-mono text-white">{Math.round(m.avgHeadTilt)}°</span>
                {m.headTiltDirection !== "neutral" && (
                  <span className="text-yellow-400 ml-1">({m.headTiltDirection})</span>
                )}
              </span>
            </div>
            <Meter label="Trunk stability" value={m.trunkStability * 100} max={100} unit="%" />
            <Meter label="Head stability" value={m.headStability * 100} max={100} unit="%" />
          </div>

          {/* Arms */}
          <div className="bg-gray-800 rounded-xl p-4">
            <h2 className="text-sm font-medium text-gray-300 mb-3">Arm Swing</h2>
            <CompareBar label="Swing range" left={m.leftArmSwingRange} right={m.rightArmSwingRange} unit="°" />
            <Meter label="Symmetry" value={m.armSwingSymmetry * 100} max={100} unit="%" />
            <div className="mt-2 grid grid-cols-1 gap-2 sm:grid-cols-2">
              <div className="rounded-lg border border-white/5 bg-gray-900/60 p-3">
                <div className="text-xs text-gray-500">Left arm</div>
                <div className="mt-1 text-sm font-mono text-white">{Math.round(m.leftArmSwingRange)}°</div>
                <div className={`mt-1 text-xs ${SEV_COLORS[leftArmStatus.severity]}`}>
                  {formatSeverityLabel(leftArmStatus.severity)}
                </div>
              </div>
              <div className="rounded-lg border border-white/5 bg-gray-900/60 p-3">
                <div className="text-xs text-gray-500">Right arm</div>
                <div className="mt-1 text-sm font-mono text-white">{Math.round(m.rightArmSwingRange)}°</div>
                <div className={`mt-1 text-xs ${SEV_COLORS[rightArmStatus.severity]}`}>
                  {formatSeverityLabel(rightArmStatus.severity)}
                </div>
              </div>
            </div>
            <div className="text-xs text-gray-500 mt-1">Normal range: 25-40° per side</div>
          </div>

          <div className="bg-gray-800 rounded-xl p-4">
            <h2 className="text-sm font-medium text-gray-300 mb-3">Foot Clearance & Ankle Events</h2>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div className="rounded-lg border border-white/5 bg-gray-900/60 p-3">
                <div className="text-xs text-gray-500">Left toe clearance</div>
                <div className="mt-1 text-sm font-mono text-white">{m.leftToeClearance.toFixed(3)}</div>
                <div className={`mt-1 text-xs ${m.leftHeelStrikePresent ? "text-green-400" : "text-yellow-400"}`}>
                  {m.leftHeelStrikePresent ? "heel-strike signal present" : "heel-strike signal limited"}
                </div>
                {onFocusMetric && <ActionButton onClick={() => onFocusMetric("left_toe_clearance")} label="Focus Left Toe" />}
              </div>
              <div className="rounded-lg border border-white/5 bg-gray-900/60 p-3">
                <div className="text-xs text-gray-500">Right toe clearance</div>
                <div className="mt-1 text-sm font-mono text-white">{m.rightToeClearance.toFixed(3)}</div>
                <div className={`mt-1 text-xs ${m.rightHeelStrikePresent ? "text-green-400" : "text-yellow-400"}`}>
                  {m.rightHeelStrikePresent ? "heel-strike signal present" : "heel-strike signal limited"}
                </div>
                {onFocusMetric && <ActionButton onClick={() => onFocusMetric("right_toe_clearance")} label="Focus Right Toe" />}
              </div>
            </div>
            <p className="mt-2 text-xs text-gray-500">
              Toe-clearance and heel-strike signals are video-based estimates from foot motion, useful for watching tripping risk and landing pattern over time.
            </p>
          </div>

          <div className="bg-gray-800 rounded-xl p-4">
            <h2 className="text-sm font-medium text-gray-300 mb-3">Balance Direction</h2>
            <div className="flex items-center justify-between text-xs">
              <span className="text-gray-400">Fall tendency</span>
              <span className={SEV_COLORS[fallSeverityLabel]}>
                {m.fallRiskDetected ? `${fallSeverityLabel} ${directionLabel(m.fallRiskDirection)}` : "not flagged"}
              </span>
            </div>
            <div className="mt-2 flex items-center justify-between text-xs">
              <span className="text-gray-400">Severity score</span>
              <span className="font-mono text-white">{Math.round(m.fallRiskSeverity * 100)}%</span>
            </div>
            <p className="mt-2 text-xs text-gray-500">
              This is a heuristic directional balance flag based on trunk lean and forward posture, not a clinical fall prediction.
            </p>
          </div>

          <div className="bg-gray-800 rounded-xl p-4">
            <h2 className="text-sm font-medium text-gray-300 mb-3">Pelvis & Fatigue</h2>
            <div className="flex items-center justify-between text-xs">
              <span className="text-gray-400">Pelvic obliquity</span>
              <span className="font-mono text-white">{Math.round(m.avgPelvicObliquity * 10) / 10}°</span>
            </div>
            <div className="mt-1 flex items-center justify-between text-xs">
              <span className="text-gray-400">Pelvic drop / hike</span>
              <span className={m.pelvicDropDetected ? "text-yellow-400" : "text-green-400"}>
                {m.pelvicDropDetected ? `${m.pelvicDropSide} side flagged` : "not flagged"}
              </span>
            </div>
            <div className="mt-1 flex items-center justify-between text-xs">
              <span className="text-gray-400">Fatigue drift</span>
              <span className={m.fatigueObserved ? "text-yellow-400" : "text-green-400"}>
                {fatiguePercent}% {m.fatigueObserved ? "observed" : "stable"}
              </span>
            </div>
            {onFocusMetric && (
              <div className="mt-2 flex gap-2">
                <ActionButton onClick={() => onFocusMetric("pelvic_obliquity")} label="Watch Pelvis Replay" />
                <ActionButton onClick={() => onFocusMetric("fatigue_drift")} label="Watch Fatigue Replay" />
              </div>
            )}
            <p className="mt-2 text-xs text-gray-500">
              Pelvic and fatigue signals are observational estimates from how hip level, posture, and foot clearance change across the clip.
            </p>
          </div>
        </div>
      )}

      {/* ======== RAW DATA VIEW ======== */}
      {view === "raw" && (
        <div className="space-y-4">
          <div className="bg-gray-800 rounded-xl p-4">
            <h2 className="text-sm font-medium text-gray-300 mb-3">Raw Joint Angles (MediaPipe)</h2>
            <p className="text-[10px] text-gray-500 mb-3">180° = fully straight, lower = more bent</p>
            <CompareBar label="Knee angle" left={m.avgLeftKneeAngle} right={m.avgRightKneeAngle} unit="°" />
            <CompareBar label="Knee ROM" left={m.leftKneeROM} right={m.rightKneeROM} unit="°" />
            <CompareBar label="Peak knee flexion" left={m.leftPeakFlexion} right={m.rightPeakFlexion} unit="°" />
            <CompareBar label="Hip angle" left={m.avgLeftHipAngle} right={m.avgRightHipAngle} unit="°" />
            <CompareBar label="Hip ROM" left={m.leftHipROM} right={m.rightHipROM} unit="°" />
            <CompareBar label="Ankle angle" left={m.avgLeftAnkleAngle} right={m.avgRightAnkleAngle} unit="°" />
            <CompareBar label="Arm swing range" left={m.leftArmSwingRange} right={m.rightArmSwingRange} unit="°" />
          </div>

          <div className="bg-gray-800 rounded-xl p-4">
            <h2 className="text-sm font-medium text-gray-300 mb-3">All Metrics</h2>
            <div className="space-y-1 text-xs">
              {Object.entries(m).map(([key, value]) => {
                if (typeof value === "boolean") {
                  return (
                    <div key={key} className="flex justify-between py-0.5">
                      <span className="text-gray-500">{key}</span>
                      <span className={value ? "text-yellow-400" : "text-gray-600"}>{value ? "Yes" : "No"}</span>
                    </div>
                  );
                }
                if (typeof value === "number") {
                  return (
                    <div key={key} className="flex justify-between py-0.5">
                      <span className="text-gray-500">{key}</span>
                      <span className="font-mono text-white">{Math.round(value * 100) / 100}</span>
                    </div>
                  );
                }
                if (typeof value === "string") {
                  return (
                    <div key={key} className="flex justify-between py-0.5">
                      <span className="text-gray-500">{key}</span>
                      <span className="text-white">{value}</span>
                    </div>
                  );
                }
                return null;
              })}
            </div>
          </div>
        </div>
      )}

      {/* ======== TRENDS VIEW ======== */}
      {view === "trends" && (
        <div className="space-y-4">
          {previousMetrics && (
            <div className="bg-gray-800 rounded-xl p-4">
              <h2 className="text-sm font-medium text-gray-300 mb-3">
                vs {previousLabel || "Previous Session"}
              </h2>
              <div className="space-y-1">
                {[
                  { label: "GDI", curr: m.gaitDeviationIndex, prev: previousMetrics.gaitDeviationIndex, unit: "", better: true },
                  { label: "Overall Symmetry", curr: m.overallSymmetry * 100, prev: previousMetrics.overallSymmetry * 100, unit: "%", better: true },
                  { label: "Knee Symmetry", curr: m.kneeSymmetryIndex * 100, prev: previousMetrics.kneeSymmetryIndex * 100, unit: "%", better: true },
                  { label: "Trunk Stability", curr: m.trunkStability * 100, prev: previousMetrics.trunkStability * 100, unit: "%", better: true },
                  { label: "Crouch", curr: m.crouchSeverity * 100, prev: previousMetrics.crouchSeverity * 100, unit: "%", better: false },
                  { label: "Toe Walking", curr: m.toeWalkingSeverity * 100, prev: previousMetrics.toeWalkingSeverity * 100, unit: "%", better: false },
                  { label: "Forward Lean", curr: m.avgForwardLean, prev: previousMetrics.avgForwardLean, unit: "°", better: false },
                  { label: "Head Tilt", curr: m.avgHeadTilt, prev: previousMetrics.avgHeadTilt, unit: "°", better: false },
                ].map(({ label, curr, prev, unit, better }) => {
                  const delta = curr - prev;
                  const improved = better ? delta > 0 : delta < 0;
                  const color = Math.abs(delta) < 1 ? "text-gray-400" : improved ? "text-green-400" : "text-red-400";
                  const arrow = Math.abs(delta) < 1 ? "→" : improved ? "↑" : "↓";
                  return (
                    <div key={label} className="flex justify-between text-xs py-1">
                      <span className="text-gray-400">{label}</span>
                      <span>
                        <span className="font-mono text-gray-500">{Math.round(prev)}{unit}</span>
                        <span className={`font-mono mx-2 ${color}`}>{arrow}</span>
                        <span className="font-mono text-white">{Math.round(curr)}{unit}</span>
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Frame-by-frame timelines */}
          {frameMetrics && frameMetrics.length > 0 && (
            <GaitTimelines
              frameMetrics={frameMetrics}
              comparisonMetrics={previousFrameMetrics}
              comparisonLabel={previousLabel || "Previous"}
              metricPreferences={preferences}
            />
          )}

          {!frameMetrics?.length && !previousMetrics && (
            <div className="bg-gray-800 rounded-xl p-6 text-center text-gray-400">
              <p>Record more sessions to see trends and frame-by-frame comparisons.</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
