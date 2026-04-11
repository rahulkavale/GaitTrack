"use client";

import { GaitTimelines } from "@/components/MetricsTimeline";
import type { SessionMetrics, FrameMetrics } from "@/lib/types";

interface GaitReportProps {
  metrics: SessionMetrics;
  frameMetrics?: FrameMetrics[];
  comparisonFrameMetrics?: FrameMetrics[];
  comparisonLabel?: string;
}

function Badge({ label, detected, severity }: { label: string; detected: boolean; severity?: number }) {
  if (!detected) return null;
  return (
    <div className="bg-yellow-900/40 border border-yellow-700 rounded-lg px-3 py-2 text-sm">
      <span className="text-yellow-300 font-medium">{label}</span>
      {severity != null && (
        <span className="text-yellow-500 ml-2">({Math.round(severity * 100)}% of frames)</span>
      )}
    </div>
  );
}

function Meter({ label, value, max, unit, low, high }: {
  label: string; value: number; max: number; unit: string;
  low?: string; high?: string;
}) {
  const pct = Math.min(100, (value / max) * 100);
  return (
    <div className="mb-3">
      <div className="flex justify-between text-xs mb-1">
        <span className="text-gray-400">{label}</span>
        <span className="font-mono text-white">{Math.round(value)}{unit}</span>
      </div>
      <div className="w-full bg-gray-700 rounded-full h-2">
        <div
          className="h-2 rounded-full bg-green-500"
          style={{ width: `${pct}%` }}
        />
      </div>
      {(low || high) && (
        <div className="flex justify-between text-[10px] text-gray-600 mt-0.5">
          <span>{low}</span>
          <span>{high}</span>
        </div>
      )}
    </div>
  );
}

function CompareBar({ label, left, right, unit }: {
  label: string; left: number; right: number; unit: string;
}) {
  const max = Math.max(left, right, 1);
  return (
    <div className="mb-3">
      <div className="text-xs text-gray-400 mb-1">{label}</div>
      <div className="flex gap-1 items-center">
        <span className="text-xs text-green-400 w-10 text-right font-mono">{Math.round(left)}{unit}</span>
        <div className="flex-1 flex gap-0.5">
          <div className="h-3 bg-green-500 rounded-l" style={{ width: `${(left / max) * 50}%` }} />
          <div className="h-3 bg-blue-500 rounded-r" style={{ width: `${(right / max) * 50}%` }} />
        </div>
        <span className="text-xs text-blue-400 w-10 font-mono">{Math.round(right)}{unit}</span>
      </div>
      <div className="flex justify-between text-[10px] text-gray-600 mt-0.5 px-12">
        <span>Left</span>
        <span>Right</span>
      </div>
    </div>
  );
}

export function GaitReport({ metrics, frameMetrics, comparisonFrameMetrics, comparisonLabel }: GaitReportProps) {
  const m = metrics;

  return (
    <div className="space-y-4">
      {/* Overall score */}
      <div className="bg-gray-800 rounded-xl p-4 text-center">
        <div className="text-xs text-gray-400 mb-1">Gait Deviation Index</div>
        <div className="text-4xl font-mono font-bold text-white">{m.gaitDeviationIndex}</div>
        <div className="text-xs text-gray-500 mt-1">out of 100 (higher = more typical gait)</div>
        <div className="flex justify-center gap-4 mt-3 text-xs">
          <div>
            <span className="text-gray-500">Symmetry: </span>
            <span className="font-mono text-white">{Math.round(m.overallSymmetry * 100)}%</span>
          </div>
          <div>
            <span className="text-gray-500">Stability: </span>
            <span className="font-mono text-white">{Math.round(m.trunkStability * 100)}%</span>
          </div>
        </div>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-3 gap-2">
        <div className="bg-gray-800 rounded-xl p-3">
          <div className="text-[10px] text-gray-500">Duration</div>
          <div className="text-lg font-mono font-bold">{Math.round(m.durationSeconds)}s</div>
        </div>
        <div className="bg-gray-800 rounded-xl p-3">
          <div className="text-[10px] text-gray-500">Steps</div>
          <div className="text-lg font-mono font-bold">{m.totalSteps}</div>
        </div>
        <div className="bg-gray-800 rounded-xl p-3">
          <div className="text-[10px] text-gray-500">Cadence</div>
          <div className="text-lg font-mono font-bold">{Math.round(m.strideCadence)}</div>
          <div className="text-[10px] text-gray-600">steps/min</div>
        </div>
      </div>

      {/* Alerts / detected patterns */}
      {(m.crouchGaitDetected || m.toeWalkingDetected || m.guardedArmDetected || m.kneeValgusDetected) && (
        <div className="space-y-2">
          <h2 className="text-sm font-medium text-yellow-400">Detected Patterns</h2>
          <Badge label="Crouch Gait" detected={m.crouchGaitDetected} severity={m.crouchSeverity} />
          <Badge label="Toe Walking" detected={m.toeWalkingDetected} severity={m.toeWalkingSeverity} />
          <Badge label="Guarded Arm Position" detected={m.guardedArmDetected} />
          <Badge label="Knee Valgus (knees caving in)" detected={m.kneeValgusDetected} />
        </div>
      )}

      {/* Gait Phases */}
      <div className="bg-gray-800 rounded-xl p-4">
        <h2 className="text-sm font-medium text-gray-300 mb-3">Gait Phases</h2>
        <CompareBar label="Stance Phase" left={m.leftStancePercent} right={m.rightStancePercent} unit="%" />
        <Meter label="Double Support" value={m.doubleSupportPercent} max={50} unit="%" low="Stable" high="High = instability" />
        <div className="flex justify-between text-xs mt-2">
          <span className="text-gray-400">Step Timing Asymmetry</span>
          <span className="font-mono text-white">{Math.round(m.stepTimeAsymmetry * 100)}%</span>
        </div>
        {m.legPreference !== "balanced" && (
          <p className="text-xs text-yellow-400 mt-1">
            Preference: {m.legPreference} leg (bearing more weight on {m.legPreference === "left" ? "right" : "left"})
          </p>
        )}
      </div>

      {/* Knee */}
      <div className="bg-gray-800 rounded-xl p-4">
        <h2 className="text-sm font-medium text-gray-300 mb-3">Knee</h2>
        <CompareBar label="Avg Angle" left={m.avgLeftKneeAngle} right={m.avgRightKneeAngle} unit="°" />
        <CompareBar label="Range of Motion" left={m.leftKneeROM} right={m.rightKneeROM} unit="°" />
        <CompareBar label="Peak Flexion (most bent)" left={m.leftPeakFlexion} right={m.rightPeakFlexion} unit="°" />
        <Meter label="Symmetry" value={m.kneeSymmetryIndex * 100} max={100} unit="%" low="Asymmetric" high="Symmetric" />
      </div>

      {/* Hip */}
      <div className="bg-gray-800 rounded-xl p-4">
        <h2 className="text-sm font-medium text-gray-300 mb-3">Hip</h2>
        <CompareBar label="Avg Angle" left={m.avgLeftHipAngle} right={m.avgRightHipAngle} unit="°" />
        <CompareBar label="Range of Motion" left={m.leftHipROM} right={m.rightHipROM} unit="°" />
        <Meter label="Symmetry" value={m.hipSymmetryIndex * 100} max={100} unit="%" low="Asymmetric" high="Symmetric" />
      </div>

      {/* Ankle */}
      <div className="bg-gray-800 rounded-xl p-4">
        <h2 className="text-sm font-medium text-gray-300 mb-3">Ankle</h2>
        <CompareBar label="Avg Angle" left={m.avgLeftAnkleAngle} right={m.avgRightAnkleAngle} unit="°" />
        <div className="flex justify-between text-xs mt-1">
          <span className="text-gray-400">Left heel strike</span>
          <span className={m.leftHeelStrikePresent ? "text-green-400" : "text-red-400"}>
            {m.leftHeelStrikePresent ? "Yes" : "No"}
          </span>
        </div>
        <div className="flex justify-between text-xs mt-1">
          <span className="text-gray-400">Right heel strike</span>
          <span className={m.rightHeelStrikePresent ? "text-green-400" : "text-red-400"}>
            {m.rightHeelStrikePresent ? "Yes" : "No"}
          </span>
        </div>
        <Meter label="Symmetry" value={m.ankleSymmetryIndex * 100} max={100} unit="%" low="Asymmetric" high="Symmetric" />
      </div>

      {/* Trunk & Posture */}
      <div className="bg-gray-800 rounded-xl p-4">
        <h2 className="text-sm font-medium text-gray-300 mb-3">Trunk & Posture</h2>
        <Meter label="Forward Lean" value={m.avgForwardLean} max={30} unit="°" low="Upright" high="Leaning" />
        <Meter label="Lateral Lean" value={m.avgLateralLean} max={15} unit="°" low="Centered" high="Tilting" />
        <Meter label="Trunk Stability" value={m.trunkStability * 100} max={100} unit="%" low="Unsteady" high="Stable" />
      </div>

      {/* Head Alignment */}
      <div className="bg-gray-800 rounded-xl p-4">
        <h2 className="text-sm font-medium text-gray-300 mb-3">Head Alignment</h2>
        <Meter label="Head Tilt (lateral)" value={m.avgHeadTilt} max={20} unit="°" low="Level" high="Tilted" />
        {m.headTiltDirection !== "neutral" && (
          <p className="text-xs text-yellow-400 mb-2">
            Persistent tilt to the <strong>{m.headTiltDirection}</strong>
          </p>
        )}
        <Meter label="Forward Head Posture" value={m.avgHeadForward} max={30} unit="°" low="Aligned" high="Forward" />
        <Meter label="Head Stability" value={m.headStability * 100} max={100} unit="%" low="Unstable" high="Stable" />
        {m.headRotationBias !== "neutral" && (
          <p className="text-xs text-yellow-400 mt-1">
            Head rotation bias: persistently turned <strong>{m.headRotationBias}</strong> ({Math.round(m.avgHeadRotation)}°)
          </p>
        )}
      </div>

      {/* Arms */}
      <div className="bg-gray-800 rounded-xl p-4">
        <h2 className="text-sm font-medium text-gray-300 mb-3">Arm Swing</h2>
        <CompareBar label="Swing Range" left={m.leftArmSwingRange} right={m.rightArmSwingRange} unit="°" />
        <Meter label="Arm Swing Symmetry" value={m.armSwingSymmetry * 100} max={100} unit="%" low="Asymmetric" high="Symmetric" />
        {m.guardedArmDetected && (
          <p className="text-xs text-yellow-400 mt-1">
            Guarded arm position detected (arm held flexed with minimal swing)
          </p>
        )}
      </div>

      {/* Walking Line */}
      <div className="bg-gray-800 rounded-xl p-4">
        <h2 className="text-sm font-medium text-gray-300 mb-3">Walking Line</h2>
        <Meter label="Step Width (base of support)" value={m.stepWidth * 100} max={30} unit="" low="Narrow" high="Wide" />
        <Meter label="Lateral Deviation (veering)" value={m.lateralDeviation * 100} max={10} unit="" low="Straight" high="Veering" />
        {m.kneeValgusDetected && (
          <p className="text-xs text-yellow-400 mt-1">
            Knee valgus detected (knees caving inward during stance)
          </p>
        )}
      </div>

      {/* Overall Symmetry Summary */}
      <div className="bg-gray-800 rounded-xl p-4">
        <h2 className="text-sm font-medium text-gray-300 mb-3">Symmetry Summary</h2>
        <Meter label="Overall" value={m.overallSymmetry * 100} max={100} unit="%" />
        <Meter label="Knee" value={m.kneeSymmetryIndex * 100} max={100} unit="%" />
        <Meter label="Hip" value={m.hipSymmetryIndex * 100} max={100} unit="%" />
        <Meter label="Ankle" value={m.ankleSymmetryIndex * 100} max={100} unit="%" />
        <Meter label="Arm Swing" value={m.armSwingSymmetry * 100} max={100} unit="%" />
        <Meter label="Step Timing" value={(1 - m.stepTimeAsymmetry) * 100} max={100} unit="%" />
      </div>

      {/* Frame-by-frame time series */}
      {frameMetrics && frameMetrics.length > 0 && (
        <GaitTimelines
          frameMetrics={frameMetrics}
          comparisonMetrics={comparisonFrameMetrics}
          comparisonLabel={comparisonLabel}
        />
      )}
    </div>
  );
}
