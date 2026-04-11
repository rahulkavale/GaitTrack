import type { SessionMetrics } from "./types";

/**
 * Reconcile metrics from multiple camera angles into a unified analysis.
 *
 * Side view is authoritative for:
 *   - Knee flexion/extension, hip flexion/extension, ankle dorsi/plantarflexion
 *   - Crouch gait, toe walking, heel strike
 *   - Forward lean, stride cadence, step count
 *   - Forward head posture
 *
 * Front view is authoritative for:
 *   - Lateral trunk sway, lateral lean
 *   - Step width, knee valgus, lateral deviation
 *   - Arm swing range and symmetry
 *   - Head tilt (lateral), head rotation
 *
 * Shared (average both):
 *   - Overall symmetry, gait deviation index
 *   - Trunk stability (combines both planes)
 *   - Head stability
 */
export function reconcileViews(
  recordings: Array<{
    view_angle: string;
    metrics: SessionMetrics;
  }>
): SessionMetrics | null {
  if (recordings.length === 0) return null;
  if (recordings.length === 1) return recordings[0].metrics;

  const side = recordings.find(r =>
    r.view_angle === "side-left" || r.view_angle === "side-right"
  );
  const front = recordings.find(r => r.view_angle === "front");

  // If we only have one type, return it
  if (!side && !front) return recordings[0].metrics;
  if (!side) return front!.metrics;
  if (!front) return side.metrics;

  const s = side.metrics;
  const f = front.metrics;

  return {
    // Duration: sum of both
    durationSeconds: s.durationSeconds + f.durationSeconds,
    // Steps: side view is more accurate for sagittal plane step detection
    totalSteps: s.totalSteps,
    strideCadence: s.strideCadence,

    // Knee: side view is authoritative
    avgLeftKneeAngle: s.avgLeftKneeAngle,
    avgRightKneeAngle: s.avgRightKneeAngle,
    kneeSymmetryIndex: s.kneeSymmetryIndex,
    leftKneeROM: s.leftKneeROM,
    rightKneeROM: s.rightKneeROM,
    leftPeakFlexion: s.leftPeakFlexion,
    rightPeakFlexion: s.rightPeakFlexion,
    crouchGaitDetected: s.crouchGaitDetected,
    crouchSeverity: s.crouchSeverity,

    // Hip: side view is authoritative for flexion/extension
    avgLeftHipAngle: s.avgLeftHipAngle,
    avgRightHipAngle: s.avgRightHipAngle,
    hipSymmetryIndex: s.hipSymmetryIndex,
    leftHipROM: s.leftHipROM,
    rightHipROM: s.rightHipROM,

    // Ankle: side view is authoritative
    avgLeftAnkleAngle: s.avgLeftAnkleAngle,
    avgRightAnkleAngle: s.avgRightAnkleAngle,
    ankleSymmetryIndex: s.ankleSymmetryIndex,
    toeWalkingDetected: s.toeWalkingDetected,
    toeWalkingSeverity: s.toeWalkingSeverity,
    leftHeelStrikePresent: s.leftHeelStrikePresent,
    rightHeelStrikePresent: s.rightHeelStrikePresent,

    // Trunk: combine both planes
    avgForwardLean: s.avgForwardLean,      // side view
    avgLateralLean: f.avgLateralLean,      // front view
    trunkStability: (s.trunkStability + f.trunkStability) / 2,

    // Head: combine both planes
    avgHeadTilt: f.avgHeadTilt,            // front view (lateral tilt)
    avgHeadForward: s.avgHeadForward,      // side view (forward posture)
    headTiltDirection: f.headTiltDirection, // front view
    headStability: (s.headStability + f.headStability) / 2,
    headRotationBias: f.headRotationBias,  // front view
    avgHeadRotation: f.avgHeadRotation,    // front view

    // Arms: front view is better for arm swing in frontal plane
    leftArmSwingRange: Math.max(s.leftArmSwingRange, f.leftArmSwingRange),
    rightArmSwingRange: Math.max(s.rightArmSwingRange, f.rightArmSwingRange),
    armSwingSymmetry: f.armSwingSymmetry,  // front view
    guardedArmDetected: s.guardedArmDetected || f.guardedArmDetected,

    // Gait phases: side view is authoritative
    leftStancePercent: s.leftStancePercent,
    rightStancePercent: s.rightStancePercent,
    doubleSupportPercent: s.doubleSupportPercent,
    stepTimeAsymmetry: s.stepTimeAsymmetry,
    legPreference: s.legPreference,

    // Walking line: front view is authoritative
    stepWidth: f.stepWidth,
    lateralDeviation: f.lateralDeviation,
    kneeValgusDetected: f.kneeValgusDetected,

    // Overall: combine both
    gaitDeviationIndex: Math.round((s.gaitDeviationIndex + f.gaitDeviationIndex) / 2),
    overallSymmetry: (s.overallSymmetry + f.overallSymmetry) / 2,
  };
}
