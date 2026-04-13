// Clinical norms for pediatric gait (ages 3-5)
// Sources: Gage "Treatment of Gait Problems in CP", Sutherland developmental gait studies,
// Perry "Gait Analysis: Normal and Pathological Function", Edinburgh Visual Gait Score (Read et al 2003)

// ---- Angle conventions ----
// MediaPipe gives the raw angle at a joint (180° = straight, lower = more bent)
// Clinical convention: flexion angle = 180 - raw angle (0° = straight, higher = more bent)
// Ankle: 90° raw = neutral; clinical dorsiflexion positive, plantarflexion negative

export function toFlexionAngle(rawAngle: number): number {
  return 180 - rawAngle;
}

export function toAnkleClinical(rawAngle: number): number {
  return rawAngle - 90; // positive = dorsiflexion, negative = plantarflexion
}

// ---- Normal ranges (clinical flexion angles, degrees) ----

export const NORMS = {
  knee: {
    // At initial contact: should be near full extension (0-5° flexion)
    initialContact: { normal: [0, 5], mild: [5, 15], moderate: [15, 30], severe: [30, 90] },
    // Peak flexion during swing: should reach 55-70° for foot clearance
    peakSwingFlexion: { normal: [55, 70], reduced: [30, 55], severe: [0, 30] },
    // During mid-stance: should extend near 0-5°
    stanceFlexion: { normal: [0, 5], mild: [5, 15], moderate: [15, 30], severe: [30, 90] },
    // Full cycle ROM: should be 55-70°
    rom: { normal: [55, 70], mild: [40, 55], moderate: [20, 40], severe: [0, 20] },
  },
  hip: {
    initialContact: { normal: [25, 35] },
    // Terminal stance extension: should reach 10-20° past neutral
    terminalExtension: { normal: [10, 20], reduced: [0, 10], absent: [-90, 0] },
    rom: { normal: [35, 45], reduced: [20, 35], minimal: [0, 20] },
  },
  ankle: {
    // At initial contact: should be at neutral (0°) to slight dorsiflexion (+5°)
    initialContact: { normal: [-5, 5], mildEquinus: [-10, -5], moderateEquinus: [-20, -10], severeEquinus: [-90, -20] },
    // Push-off plantarflexion
    pushOff: { normal: [-15, -25] },
    rom: { normal: [25, 35], reduced: [10, 25], minimal: [0, 10] },
  },
  timing: {
    stancePercent: { normal: [58, 62] },
    doubleSupport: { normal: [16, 24] },
  },
  // Steps/min for age 3-5 (Sutherland)
  cadence: { normal: [140, 170] },
  trunk: {
    forwardLean: { normal: [0, 5], mild: [5, 10], moderate: [10, 20], severe: [20, 90] },
    lateralLean: { normal: [0, 3], mild: [3, 7], moderate: [7, 12], severe: [12, 90] },
  },
  head: {
    lateralTilt: { normal: [0, 3], mild: [3, 7], moderate: [7, 15], severe: [15, 90] },
    forwardPosture: { normal: [0, 10], mild: [10, 20], moderate: [20, 90] },
  },
  armSwing: {
    range: { normal: [25, 40], reduced: [10, 25], absent: [0, 10] },
  },
} as const;

// ---- Severity classification ----

export type Severity = "normal" | "mild" | "moderate" | "severe";

export function classifyRange(value: number, ranges: Record<string, readonly [number, number]>): { severity: Severity; inRange: string } {
  for (const [name, [lo, hi]] of Object.entries(ranges)) {
    if (value >= lo && value <= hi) {
      const sev = name === "normal" ? "normal"
        : (name.includes("severe") || name === "absent") ? "severe"
        : (name.includes("moderate") || name === "minimal") ? "moderate"
        : "mild";
      return { severity: sev as Severity, inRange: name };
    }
  }
  return { severity: "severe", inRange: "out of range" };
}

// ---- Observed movement feature flags ----

export interface GaitPattern {
  id: FeatureMetricId;
  name: string;
  detected: boolean;
  severity: Severity;
  clinicalDescription: string;   // for physios
  parentDescription: string;     // for parents
  suggestion: string;            // therapy suggestion
}

export function classifyGaitPatterns(params: {
  leftKneeFlexionAtContact: number;
  rightKneeFlexionAtContact: number;
  leftKneeFlexionMidStance: number;
  rightKneeFlexionMidStance: number;
  peakLeftKneeFlexionSwing: number;
  peakRightKneeFlexionSwing: number;
  leftKneeROM: number;
  rightKneeROM: number;
  leftAnkleAtContact: number;          // + = DF, - = PF
  rightAnkleAtContact: number;
  hipFlexionAtContact: number;         // averaged
  trunkLateralLeanSigned: number;      // signed: + = lean to right, - = lean to left
  armSwingRange: number;
  stepWidth: number;
  leftPeakKneeExtension: number;       // signed clinical flexion (negative = hyperextension)
  rightPeakKneeExtension: number;
  featurePreferences?: MetricPreferences["features"];
}): GaitPattern[] {
  const p = params;
  const patterns: GaitPattern[] = [];
  const featurePreferences = p.featurePreferences;

  function higherWorseSeverity(value: number, thresholds: { mild: number; moderate: number; severe: number }): Severity {
    if (value > thresholds.severe) return "severe";
    if (value > thresholds.moderate) return "moderate";
    if (value > thresholds.mild) return "mild";
    return "normal";
  }

  function lowerWorseSeverity(value: number, thresholds: { mild: number; moderate: number; severe: number }): Severity {
    if (value < thresholds.severe) return "severe";
    if (value < thresholds.moderate) return "moderate";
    if (value < thresholds.mild) return "mild";
    return "normal";
  }

  // Helper: pick which side is more affected for a "higher = worse" metric
  function worseSide(left: number, right: number, eqTol: number): { side: "left" | "right" | "both"; value: number } {
    if (Math.abs(left - right) <= eqTol) return { side: "both", value: Math.max(left, right) };
    return left > right ? { side: "left", value: left } : { side: "right", value: right };
  }
  // For "lower = worse" (e.g. ROM)
  function worseSideLow(left: number, right: number, eqTol: number): { side: "left" | "right" | "both"; value: number } {
    if (Math.abs(left - right) <= eqTol) return { side: "both", value: Math.min(left, right) };
    return left < right ? { side: "left", value: left } : { side: "right", value: right };
  }
  function sideLabel(s: "left" | "right" | "both", noun: string): string {
    if (s === "both") return `both ${noun}s`;
    return `the ${s} ${noun}`;
  }

  // Persistent knee flexion in stance-like positions
  const leftCrouch = Math.max(p.leftKneeFlexionAtContact, p.leftKneeFlexionMidStance);
  const rightCrouch = Math.max(p.rightKneeFlexionAtContact, p.rightKneeFlexionMidStance);
  const crouch = worseSide(leftCrouch, rightCrouch, 5);
  const crouchAngle = crouch.value;
  const crouchSev = higherWorseSeverity(
    crouchAngle,
    featurePreferences?.persistent_knee_bend?.thresholds ?? { mild: 5, moderate: 15, severe: 30 }
  );
  patterns.push({
    id: "persistent_knee_bend",
    name: "Persistent Knee Bend",
    detected: crouchSev !== "normal",
    severity: crouchSev,
    clinicalDescription: crouchSev === "normal"
      ? "Knee position stays near full extension through the observed walking cycle."
      : `${crouch.side === "both" ? "Both knees show" : `The ${crouch.side} knee shows`} persistent flexion of about ${Math.round(crouchAngle)}° during stance-like portions of the capture (${crouchSev}).`,
    parentDescription: crouchSev === "normal"
      ? "Knees are straightening well during the observed walking cycle."
      : `${crouch.side === "both" ? "Both knees appear to stay more bent than expected" : `The ${crouch.side} knee appears to stay more bent than expected`} during walking, by about ${Math.round(crouchAngle)}°.`,
    suggestion: crouchSev === "normal" ? ""
      : crouchSev === "mild" ? "Monitor. Hamstring stretching exercises."
      : "Assess hamstring tightness. Consider serial casting or orthotic support.",
  });

  // Forefoot-first / plantarflexed landing tendency
  const equinus = worseSideLow(p.leftAnkleAtContact, p.rightAnkleAtContact, 5);
  const equinusVal = equinus.value;
  const equinusSev = lowerWorseSeverity(
    equinusVal,
    featurePreferences?.forefoot_first_landing?.thresholds ?? { mild: -5, moderate: -10, severe: -20 }
  );
  patterns.push({
    id: "forefoot_first_landing",
    name: "Forefoot-First Landing",
    detected: equinusSev !== "normal",
    severity: equinusSev,
    clinicalDescription: equinusSev === "normal"
      ? "Observed ankle position is near neutral around landing."
      : `${equinus.side === "both" ? "Both ankles show" : `The ${equinus.side} ankle shows`} a plantarflexed landing tendency of about ${Math.round(equinusVal)}° (${equinusSev}), which may indicate forefoot-first contact.`,
    parentDescription: equinusSev === "normal"
      ? "The feet appear to land close to heel-first."
      : `${equinus.side === "both" ? "Both feet appear to land more on the front of the foot" : `The ${equinus.side} foot appears to land more on the front of the foot`} than heel-first.`,
    suggestion: equinusSev === "normal" ? ""
      : equinusSev === "mild" ? "Calf stretching. Consider AFO assessment."
      : "Gastrocnemius/soleus tightness likely. AFO recommended. Consider botulinum toxin if spastic.",
  });

  // Reduced knee excursion
  const stiff = worseSideLow(p.leftKneeROM, p.rightKneeROM, 8);
  const stiffROM = stiff.value;
  const stiffSev = lowerWorseSeverity(
    stiffROM,
    featurePreferences?.reduced_knee_motion?.thresholds ?? { mild: 55, moderate: 40, severe: 20 }
  );
  const peakSwing = stiff.side === "left" ? p.peakLeftKneeFlexionSwing
    : stiff.side === "right" ? p.peakRightKneeFlexionSwing
    : Math.min(p.peakLeftKneeFlexionSwing, p.peakRightKneeFlexionSwing);
  patterns.push({
    id: "reduced_knee_motion",
    name: "Reduced Knee Motion",
    detected: stiffSev !== "normal",
    severity: stiffSev,
    clinicalDescription: stiffSev === "normal"
      ? `Observed knee excursion is within the current expected range at about ${Math.round(stiffROM)}°.`
      : `Observed knee excursion is reduced ${stiff.side === "both" ? "on both sides" : `on the ${stiff.side}`} to about ${Math.round(stiffROM)}° (${stiffSev}). Peak swing flexion reaches about ${Math.round(peakSwing)}°.`,
    parentDescription: stiffSev === "normal"
      ? "The knees are bending and straightening through a good range during walking."
      : `${sideLabel(stiff.side, "knee").charAt(0).toUpperCase() + sideLabel(stiff.side, "knee").slice(1)} ${stiff.side === "both" ? "show" : "shows"} less bend-and-straighten movement than expected during walking, at about ${Math.round(stiffROM)}°.`,
    suggestion: stiffSev === "normal" ? ""
      : "Assess rectus femoris. May benefit from knee flexion exercises during swing phase practice.",
  });

  // Lateral trunk lean
  const leanMag = Math.abs(p.trunkLateralLeanSigned);
  const leanDir: "left" | "right" = p.trunkLateralLeanSigned >= 0 ? "right" : "left";
  const trendSev = higherWorseSeverity(
    leanMag,
    featurePreferences?.side_lean_of_trunk?.thresholds ?? { mild: 3, moderate: 7, severe: 12 }
  );
  // Trendelenburg lean indicates weakness on the OPPOSITE (stance) hip when leaning over it.
  // Clinically: trunk leans toward the weak side during single-limb stance on that side.
  patterns.push({
    id: "side_lean_of_trunk",
    name: "Side Lean of Trunk",
    detected: trendSev !== "normal",
    severity: trendSev,
    clinicalDescription: trendSev === "normal"
      ? "Trunk remains centered in the frontal plane through the observed walking cycle."
      : `Observed lateral trunk lean is about ${Math.round(leanMag)}° to the ${leanDir} (${trendSev}) during the capture.`,
    parentDescription: trendSev === "normal"
      ? "The body stays upright and centered during walking."
      : `The body appears to lean about ${Math.round(leanMag)}° to the ${leanDir} during walking.`,
    suggestion: trendSev === "normal" ? ""
      : `Hip abductor strengthening (${leanDir} side). Side-stepping exercises. Assess gluteus medius.`,
  });

  // Combined crouched and forefoot-first pattern
  const worstAnkle = Math.min(p.leftAnkleAtContact, p.rightAnkleAtContact);
  const jumpThresholds = featurePreferences?.combined_bent_knee_forefoot?.thresholds ?? { mild: 15, moderate: 15, severe: 30 };
  const jumpDetected = crouchAngle > jumpThresholds.mild && worstAnkle < -5 && p.hipFlexionAtContact > 35;
  patterns.push({
    id: "combined_bent_knee_forefoot",
    name: "Combined Bent-Knee and Forefoot Pattern",
    detected: jumpDetected,
    severity: jumpDetected ? (crouchAngle > jumpThresholds.severe ? "severe" : "moderate") : "normal",
    clinicalDescription: jumpDetected
      ? "Observed combination of increased knee flexion, forefoot-first landing tendency, and increased hip flexion in the same capture."
      : "No combined bent-knee and forefoot-first pattern observed.",
    parentDescription: jumpDetected
      ? "Walking appears to combine bent knees, more front-of-foot landing, and bent hips at the same time."
      : "No combined bent-knee and forefoot-first pattern was observed.",
    suggestion: jumpDetected ? "Multi-level assessment needed. Consider combined approach to hip flexors, hamstrings, and calf." : "",
  });

  // Knee overextension tendency
  const recurv = worseSideLow(p.leftPeakKneeExtension, p.rightPeakKneeExtension, 3);
  const recurvVal = recurv.value;
  const recurvThresholds = featurePreferences?.knee_overextension?.thresholds ?? { mild: -5, moderate: -8, severe: -10 };
  const recurvSev = lowerWorseSeverity(recurvVal, recurvThresholds);
  const recurvDetected = recurvSev !== "normal";
  patterns.push({
    id: "knee_overextension",
    name: "Knee Overextension",
    detected: recurvDetected,
    severity: recurvSev,
    clinicalDescription: recurvDetected
      ? `${recurv.side === "both" ? "Both knees show" : `The ${recurv.side} knee shows`} about ${Math.round(Math.abs(recurvVal))}° of overextension during stance-like portions of the capture.`
      : "No clear knee overextension observed.",
    parentDescription: recurvDetected
      ? `${recurv.side === "both" ? "Both knees appear to go slightly past straight" : `The ${recurv.side} knee appears to go slightly past straight`} during walking.`
      : "The knees stay close to straight without clearly going past straight.",
    suggestion: recurvDetected ? "Quadriceps assessment. Consider knee brace to prevent hyperextension." : "",
  });

  // Limited arm swing
  const armSwingThresholds = featurePreferences?.limited_arm_swing?.thresholds ?? { mild: 10, moderate: 7, severe: 4 };
  const guardSev = lowerWorseSeverity(p.armSwingRange, armSwingThresholds);
  const guardDetected = guardSev !== "normal";
  patterns.push({
    id: "limited_arm_swing",
    name: "Limited Arm Swing",
    detected: guardDetected,
    severity: guardSev,
    clinicalDescription: guardDetected
      ? `Observed arm swing range is about ${Math.round(p.armSwingRange)}°, lower than the current expected range.`
      : `Observed arm swing range is about ${Math.round(p.armSwingRange)}°, within the current expected range.`,
    parentDescription: guardDetected
      ? "The arms appear to swing less than expected during walking."
      : "The arms are swinging naturally during walking.",
    suggestion: guardDetected ? "Upper body relaxation exercises. Practice walking with loose arms." : "",
  });

  // Narrow base of support
  const stepWidthThresholds = featurePreferences?.narrow_step_width?.thresholds ?? { mild: 0.08, moderate: 0.05, severe: 0.03 };
  const scissorSev = lowerWorseSeverity(p.stepWidth, stepWidthThresholds);
  const scissorDetected = scissorSev !== "normal";
  patterns.push({
    id: "narrow_step_width",
    name: "Narrow Step Width",
    detected: scissorDetected,
    severity: scissorSev,
    clinicalDescription: scissorDetected
      ? "Observed step width is narrow, with the legs moving close together in the capture."
      : "Observed step width is within the current expected range.",
    parentDescription: scissorDetected
      ? "The feet appear to travel very close together during walking."
      : "The feet stay reasonably spaced during walking.",
    suggestion: scissorDetected ? "Adductor stretching. Assess for surgical adductor release if persistent." : "",
  });

  return patterns;
}

// ---- Parent-friendly metric descriptions ----

export interface ParentMetric {
  label: string;
  value: string;
  status: "good" | "improving" | "stable" | "watch" | "concern";
  change: string | null; // "improved by 12%", "declined by 5%", null if no comparison
}

export function parentMetrics(
  current: {
    gdi: number;
    overallSymmetry: number;
    kneeSymmetry: number;
    cadence: number;
    trunkStability: number;
    headStability: number;
  },
  previous?: {
    gdi: number;
    overallSymmetry: number;
    kneeSymmetry: number;
    cadence: number;
    trunkStability: number;
    headStability: number;
  } | null
): ParentMetric[] {
  function delta(curr: number, prev: number | undefined, higherBetter: boolean): { status: ParentMetric["status"]; change: string | null } {
    if (prev == null) return { status: "stable", change: null };
    const diff = curr - prev;
    const pct = prev !== 0 ? Math.round((diff / prev) * 100) : 0;
    if (Math.abs(pct) < 2) return { status: "stable", change: "No significant change" };
    const improved = higherBetter ? diff > 0 : diff < 0;
    return {
      status: improved ? "improving" : "concern",
      change: improved ? `Improved by ${Math.abs(pct)}%` : `Declined by ${Math.abs(pct)}%`,
    };
  }

  return [
    {
      label: "Overall Walking Score",
      value: `${current.gdi}/100`,
      ...delta(current.gdi, previous?.gdi, true),
    },
    {
      label: "Left-Right Balance",
      value: `${Math.round(current.overallSymmetry * 100)}%`,
      ...delta(current.overallSymmetry, previous?.overallSymmetry, true),
    },
    {
      label: "Knee Balance",
      value: `${Math.round(current.kneeSymmetry * 100)}%`,
      ...delta(current.kneeSymmetry, previous?.kneeSymmetry, true),
    },
    {
      label: "Walking Speed",
      value: `${Math.round(current.cadence)} steps/min`,
      ...delta(current.cadence, previous?.cadence, true),
    },
    {
      label: "Body Steadiness",
      value: `${Math.round(current.trunkStability * 100)}%`,
      ...delta(current.trunkStability, previous?.trunkStability, true),
    },
    {
      label: "Head Steadiness",
      value: `${Math.round(current.headStability * 100)}%`,
      ...delta(current.headStability, previous?.headStability, true),
    },
  ];
}
import type { FeatureMetricId, MetricPreferences } from "./metric-settings";
