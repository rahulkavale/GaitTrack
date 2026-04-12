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

// ---- CP gait pattern flags ----

export interface GaitPattern {
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
}): GaitPattern[] {
  const p = params;
  const patterns: GaitPattern[] = [];

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

  // Crouch gait
  const leftCrouch = Math.max(p.leftKneeFlexionAtContact, p.leftKneeFlexionMidStance);
  const rightCrouch = Math.max(p.rightKneeFlexionAtContact, p.rightKneeFlexionMidStance);
  const crouch = worseSide(leftCrouch, rightCrouch, 5);
  const crouchAngle = crouch.value;
  const crouchSev = crouchAngle > 30 ? "severe" : crouchAngle > 15 ? "moderate" : crouchAngle > 5 ? "mild" : "normal";
  patterns.push({
    name: "Crouch Gait",
    detected: crouchSev !== "normal",
    severity: crouchSev,
    clinicalDescription: crouchSev === "normal"
      ? "Knee extends normally during stance phase"
      : `${crouch.side === "both" ? "Bilateral" : crouch.side === "left" ? "Left" : "Right"} knee flexion ${Math.round(crouchAngle)}° during stance (${crouchSev}). Knee fails to extend at initial contact and mid-stance.`,
    parentDescription: crouchSev === "normal"
      ? "Knees are straightening well when standing on each leg"
      : `${crouch.side === "both" ? "Both knees are" : `The ${crouch.side} knee is`} staying bent ${Math.round(crouchAngle)}° when ${crouch.side === "both" ? "they" : "it"} should be nearly straight. This is ${crouchSev}.`,
    suggestion: crouchSev === "normal" ? ""
      : crouchSev === "mild" ? "Monitor. Hamstring stretching exercises."
      : "Assess hamstring tightness. Consider serial casting or orthotic support.",
  });

  // Equinus (toe walking) — more negative = more plantarflexed = worse
  const equinus = worseSideLow(p.leftAnkleAtContact, p.rightAnkleAtContact, 5);
  const equinusVal = equinus.value;
  const equinusSev = equinusVal < -20 ? "severe" : equinusVal < -10 ? "moderate" : equinusVal < -5 ? "mild" : "normal";
  patterns.push({
    name: "Equinus (Toe Walking)",
    detected: equinusSev !== "normal",
    severity: equinusSev,
    clinicalDescription: equinusSev === "normal"
      ? "Heel strikes first with ankle near neutral at initial contact"
      : `${equinus.side === "both" ? "Bilateral" : equinus.side === "left" ? "Left" : "Right"} ankle at ${Math.round(equinusVal)}° plantarflexion at initial contact (${equinusSev}). ${equinusSev === "severe" ? "Toe-only contact." : "Forefoot contact pattern."}`,
    parentDescription: equinusSev === "normal"
      ? "The heel touches the ground first when stepping - this is good"
      : `${equinus.side === "both" ? "Both feet are landing" : `The ${equinus.side} foot is landing`} on ${equinusSev === "severe" ? "the toes" : "the front of the foot"} instead of heel first. This is ${equinusSev}.`,
    suggestion: equinusSev === "normal" ? ""
      : equinusSev === "mild" ? "Calf stretching. Consider AFO assessment."
      : "Gastrocnemius/soleus tightness likely. AFO recommended. Consider botulinum toxin if spastic.",
  });

  // Stiff knee — lower ROM = worse
  const stiff = worseSideLow(p.leftKneeROM, p.rightKneeROM, 8);
  const stiffROM = stiff.value;
  const stiffSev = stiffROM < 20 ? "severe" : stiffROM < 40 ? "moderate" : stiffROM < 55 ? "mild" : "normal";
  const peakSwing = stiff.side === "left" ? p.peakLeftKneeFlexionSwing
    : stiff.side === "right" ? p.peakRightKneeFlexionSwing
    : Math.min(p.peakLeftKneeFlexionSwing, p.peakRightKneeFlexionSwing);
  patterns.push({
    name: "Stiff Knee Gait",
    detected: stiffSev !== "normal",
    severity: stiffSev,
    clinicalDescription: stiffSev === "normal"
      ? `Knee ROM ${Math.round(stiffROM)}° through gait cycle (normal)`
      : `Reduced knee ROM ${stiff.side === "both" ? "bilaterally" : `on the ${stiff.side}`}: ${Math.round(stiffROM)}° (${stiffSev}). Peak swing flexion only ${Math.round(peakSwing)}°.`,
    parentDescription: stiffSev === "normal"
      ? "The knee is bending and straightening through a good range when walking"
      : `${sideLabel(stiff.side, "knee").charAt(0).toUpperCase() + sideLabel(stiff.side, "knee").slice(1)} ${stiff.side === "both" ? "aren't" : "isn't"} bending enough during walking - only moving ${Math.round(stiffROM)}° instead of the normal 55-70°.`,
    suggestion: stiffSev === "normal" ? ""
      : "Assess rectus femoris. May benefit from knee flexion exercises during swing phase practice.",
  });

  // Trendelenburg — signed lean tells us direction
  const leanMag = Math.abs(p.trunkLateralLeanSigned);
  const leanDir: "left" | "right" = p.trunkLateralLeanSigned >= 0 ? "right" : "left";
  const trendSev = leanMag > 12 ? "severe" : leanMag > 7 ? "moderate" : leanMag > 3 ? "mild" : "normal";
  // Trendelenburg lean indicates weakness on the OPPOSITE (stance) hip when leaning over it.
  // Clinically: trunk leans toward the weak side during single-limb stance on that side.
  patterns.push({
    name: "Trendelenburg",
    detected: trendSev !== "normal",
    severity: trendSev,
    clinicalDescription: trendSev === "normal"
      ? "Trunk stays centered during single limb stance"
      : `Lateral trunk lean ${Math.round(leanMag)}° to the ${leanDir} (${trendSev}). Suggests ${leanDir} hip abductor weakness (compensated Trendelenburg).`,
    parentDescription: trendSev === "normal"
      ? "The body stays upright and centered during walking"
      : `The body is leaning ${Math.round(leanMag)}° to the ${leanDir} during walking. This suggests the ${leanDir} hip is weaker.`,
    suggestion: trendSev === "normal" ? ""
      : `Hip abductor strengthening (${leanDir} side). Side-stepping exercises. Assess gluteus medius.`,
  });

  // Jump gait (equinus + crouch combined)
  const worstAnkle = Math.min(p.leftAnkleAtContact, p.rightAnkleAtContact);
  const jumpDetected = crouchAngle > 15 && worstAnkle < -5 && p.hipFlexionAtContact > 35;
  patterns.push({
    name: "Jump Gait",
    detected: jumpDetected,
    severity: jumpDetected ? "moderate" : "normal",
    clinicalDescription: jumpDetected
      ? "Combined pattern: knee flexion + equinus + hip flexion at initial contact. Typical of spastic diplegia."
      : "No jump gait pattern",
    parentDescription: jumpDetected
      ? "Walking with a bouncing pattern - knees bent, on toes, and hips flexed together"
      : "No bouncing walking pattern",
    suggestion: jumpDetected ? "Multi-level assessment needed. Consider combined approach to hip flexors, hamstrings, and calf." : "",
  });

  // Recurvatum (knee hyperextension) — most negative = worst
  const recurv = worseSideLow(p.leftPeakKneeExtension, p.rightPeakKneeExtension, 3);
  const recurvVal = recurv.value;
  const recurvDetected = recurvVal < -5;
  patterns.push({
    name: "Knee Hyperextension",
    detected: recurvDetected,
    severity: recurvDetected ? (recurvVal < -10 ? "severe" : "mild") : "normal",
    clinicalDescription: recurvDetected
      ? `${recurv.side === "both" ? "Both knees hyperextend" : `The ${recurv.side} knee hyperextends`} ${Math.round(Math.abs(recurvVal))}° during stance. May indicate quadriceps weakness or hamstring insufficiency.`
      : "No knee hyperextension",
    parentDescription: recurvDetected
      ? `${recurv.side === "both" ? "Both knees are" : `The ${recurv.side} knee is`} bending backwards when standing on it - it should stay straight, not go past straight`
      : "The knee stays in a good position when standing",
    suggestion: recurvDetected ? "Quadriceps assessment. Consider knee brace to prevent hyperextension." : "",
  });

  // Guarded arms
  const guardDetected = p.armSwingRange < 10;
  patterns.push({
    name: "Guarded Arm Position",
    detected: guardDetected,
    severity: guardDetected ? "mild" : "normal",
    clinicalDescription: guardDetected
      ? `Arm swing range only ${Math.round(p.armSwingRange)}° (normal 25-40°). Arms held in flexed guard position.`
      : `Arm swing range ${Math.round(p.armSwingRange)}° (normal)`,
    parentDescription: guardDetected
      ? "The arms are held up and stiff instead of swinging naturally during walking"
      : "The arms are swinging naturally during walking",
    suggestion: guardDetected ? "Upper body relaxation exercises. Practice walking with loose arms." : "",
  });

  // Scissoring
  const scissorDetected = p.stepWidth < 0.05;
  patterns.push({
    name: "Scissoring",
    detected: scissorDetected,
    severity: scissorDetected ? "moderate" : "normal",
    clinicalDescription: scissorDetected
      ? "Narrow base of support with legs crossing midline. Suggests adductor spasticity."
      : "Step width within normal range",
    parentDescription: scissorDetected
      ? "The legs are crossing over each other during walking - the feet should be hip-width apart"
      : "The feet are spaced well apart during walking",
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
