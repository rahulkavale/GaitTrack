"use client";

import { useState } from "react";
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
}

// ---- Main component ----

export function GaitReport({ metrics, frameMetrics, previousMetrics, previousFrameMetrics, previousLabel }: GaitReportProps) {
  const [view, setView] = useState<"parent" | "clinical" | "raw" | "trends">("parent");
  const m = metrics;

  // Convert to clinical angles
  const leftKneeFlexion = toFlexionAngle(m.avgLeftKneeAngle);
  const rightKneeFlexion = toFlexionAngle(m.avgRightKneeAngle);
  const leftAnkleClinical = toAnkleClinical(m.avgLeftAnkleAngle);
  const rightAnkleClinical = toAnkleClinical(m.avgRightAnkleAngle);
  const leftHipFlexion = toFlexionAngle(m.avgLeftHipAngle);
  const rightHipFlexion = toFlexionAngle(m.avgRightHipAngle);

  // Classify gait patterns
  const patterns = classifyGaitPatterns({
    kneeFlexionAtContact: Math.max(leftKneeFlexion, rightKneeFlexion),
    kneeFlexionMidStance: Math.max(leftKneeFlexion, rightKneeFlexion), // approximation
    peakKneeFlexionSwing: toFlexionAngle(Math.min(m.leftPeakFlexion, m.rightPeakFlexion)),
    kneeROM: Math.max(m.leftKneeROM, m.rightKneeROM),
    ankleAtContact: (leftAnkleClinical + rightAnkleClinical) / 2,
    hipFlexionAtContact: (leftHipFlexion + rightHipFlexion) / 2,
    trunkLateralLean: m.avgLateralLean,
    armSwingRange: (m.leftArmSwingRange + m.rightArmSwingRange) / 2,
    stepWidth: m.stepWidth,
    peakKneeExtension: -toFlexionAngle(Math.max(m.avgLeftKneeAngle, m.avgRightKneeAngle)),
  });

  const detectedPatterns = patterns.filter(p => p.detected);

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

  return (
    <div className="space-y-4">
      {/* View toggle */}
      <div className="flex gap-1 bg-gray-900 rounded-xl p-1 overflow-x-auto">
        {(["parent", "clinical", "raw", "trends"] as const).map((v) => (
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
      <div className="bg-gray-800 rounded-xl p-4 text-center">
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

      {/* ======== PARENT VIEW ======== */}
      {view === "parent" && (
        <div className="space-y-4">
          {/* Simple metric cards */}
          <div className="space-y-2">
            {pMetrics.map((pm) => (
              <div key={pm.label} className="bg-gray-800 rounded-xl p-3 flex justify-between items-center">
                <div>
                  <div className="text-sm text-white">{pm.label}</div>
                  {pm.change && (
                    <div className={`text-xs ${STATUS_COLORS[pm.status]}`}>{pm.change}</div>
                  )}
                </div>
                <div className="text-lg font-mono font-bold text-white">{pm.value}</div>
              </div>
            ))}
          </div>

          {/* Detected issues in plain language */}
          {detectedPatterns.length > 0 && (
            <div className="space-y-2">
              <h2 className="text-sm font-medium text-gray-400">What we noticed</h2>
              {detectedPatterns.map((p) => (
                <div key={p.name} className={`rounded-xl p-3 border ${SEV_BG[p.severity]}`}>
                  <div className="flex items-center gap-1 mb-1">
                    <SeverityDot severity={p.severity} />
                    <span className={`text-sm font-medium ${SEV_COLORS[p.severity]}`}>{p.name}</span>
                    <span className="text-xs text-gray-500 ml-auto">{p.severity}</span>
                  </div>
                  <p className="text-xs text-gray-300">{p.parentDescription}</p>
                </div>
              ))}
            </div>
          )}

          {detectedPatterns.length === 0 && (
            <div className="bg-green-900/20 border border-green-800/50 rounded-xl p-4 text-center">
              <p className="text-sm text-green-300">No concerning gait patterns detected</p>
            </div>
          )}

          {/* Summary stats */}
          <div className="grid grid-cols-3 gap-2">
            <div className="bg-gray-800 rounded-xl p-3 text-center">
              <div className="text-[10px] text-gray-500">Duration</div>
              <div className="text-lg font-mono font-bold">{Math.round(m.durationSeconds)}s</div>
            </div>
            <div className="bg-gray-800 rounded-xl p-3 text-center">
              <div className="text-[10px] text-gray-500">Steps</div>
              <div className="text-lg font-mono font-bold">{m.totalSteps}</div>
            </div>
            <div className="bg-gray-800 rounded-xl p-3 text-center">
              <div className="text-[10px] text-gray-500">Cadence</div>
              <div className="text-lg font-mono font-bold">{Math.round(m.strideCadence)}</div>
            </div>
          </div>
        </div>
      )}

      {/* ======== CLINICAL VIEW ======== */}
      {view === "clinical" && (
        <div className="space-y-4">
          {/* Gait pattern flags */}
          <div className="space-y-2">
            <h2 className="text-sm font-medium text-gray-400">Gait Pattern Assessment</h2>
            {patterns.map((p) => (
              <div key={p.name} className={`rounded-xl p-3 border ${SEV_BG[p.severity]}`}>
                <div className="flex items-center gap-1 mb-1">
                  <SeverityDot severity={p.severity} />
                  <span className={`text-sm font-medium ${SEV_COLORS[p.severity]}`}>{p.name}</span>
                  <span className="text-xs text-gray-500 ml-auto">{p.severity}</span>
                </div>
                <p className="text-xs text-gray-300 mb-1">{p.clinicalDescription}</p>
                {p.suggestion && (
                  <p className="text-xs text-blue-300 italic">{p.suggestion}</p>
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
            <div className="text-xs text-gray-500 mt-1">Normal range: 25-40° per side</div>
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
