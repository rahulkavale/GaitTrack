export interface PoseFrame {
  timestamp: number;
  landmarks: Array<{ x: number; y: number; z: number; visibility: number }>;
  worldLandmarks: Array<{ x: number; y: number; z: number; visibility: number }>;
}

// Per-frame raw measurements
export interface FrameMetrics {
  timestamp: number;
  // Joint angles
  leftKneeAngle: number;
  rightKneeAngle: number;
  leftHipAngle: number;
  rightHipAngle: number;
  leftAnkleAngle: number;
  rightAnkleAngle: number;
  // Trunk
  trunkForwardLean: number; // degrees from vertical (side view)
  trunkLateralLean: number; // degrees lateral tilt (front view)
  // Arms
  leftElbowAngle: number;
  rightElbowAngle: number;
  leftShoulderAngle: number; // arm swing range
  rightShoulderAngle: number;
  // Head
  headTilt: number;           // lateral tilt in degrees (0 = level, positive = right tilt)
  headForwardAngle: number;   // how far forward the head is from shoulder line (degrees)
  headRotation: number;       // rotation estimate from ear visibility asymmetry
  // Feet vertical position (for gait phase detection)
  leftAnkleY: number;
  rightAnkleY: number;
  // Symmetry
  kneeSymmetry: number;
  hipSymmetry: number;
}

// Gait phase events detected from frame sequence
export interface GaitPhaseAnalysis {
  // Step events with timestamps
  leftSteps: number[];   // timestamps of left heel strikes
  rightSteps: number[];  // timestamps of right heel strikes
  // Phase timing (as percentage of gait cycle)
  leftStancePercent: number;  // % of cycle in stance (foot on ground)
  rightStancePercent: number;
  doubleSupportPercent: number; // % both feet on ground
  // Step characteristics
  leftStepDurationMs: number;  // avg time per left step
  rightStepDurationMs: number;
  stepTimeAsymmetry: number;   // 0=symmetric, 1=completely one-sided
  legPreference: "left" | "right" | "balanced";
}

// Comprehensive session-level analysis
export interface SessionMetrics {
  // Duration
  durationSeconds: number;
  totalSteps: number;
  strideCadence: number; // steps/min

  // Joint angles (avg)
  avgLeftKneeAngle: number;
  avgRightKneeAngle: number;
  avgLeftHipAngle: number;
  avgRightHipAngle: number;
  avgLeftAnkleAngle: number;
  avgRightAnkleAngle: number;

  // Knee analysis
  kneeSymmetryIndex: number;
  leftKneeROM: number;       // range of motion (max - min through cycle)
  rightKneeROM: number;
  leftPeakFlexion: number;   // max bend during swing
  rightPeakFlexion: number;
  crouchGaitDetected: boolean; // excessive knee flexion during stance
  crouchSeverity: number;     // 0-1, how severe

  // Hip analysis
  hipSymmetryIndex: number;
  leftHipROM: number;
  rightHipROM: number;

  // Ankle analysis
  ankleSymmetryIndex: number;
  toeWalkingDetected: boolean; // persistent plantarflexion
  toeWalkingSeverity: number;  // 0-1
  leftHeelStrikePresent: boolean;
  rightHeelStrikePresent: boolean;

  // Trunk & posture
  avgForwardLean: number;     // degrees from vertical
  avgLateralLean: number;     // degrees lateral
  trunkStability: number;     // 0-1, how steady (less sway = higher)

  // Head alignment
  avgHeadTilt: number;          // avg lateral tilt (degrees, 0 = level)
  avgHeadForward: number;       // avg forward head posture (degrees)
  headTiltDirection: "left" | "right" | "neutral"; // which way it tilts
  headStability: number;        // 0-1, how steady during walking
  headRotationBias: "left" | "right" | "neutral"; // persistent rotation
  avgHeadRotation: number;      // avg rotation in degrees

  // Arms
  leftArmSwingRange: number;  // degrees of arm swing
  rightArmSwingRange: number;
  armSwingSymmetry: number;   // 0-1
  guardedArmDetected: boolean; // arm held in flexed position

  // Gait phases
  leftStancePercent: number;
  rightStancePercent: number;
  doubleSupportPercent: number;
  stepTimeAsymmetry: number;
  legPreference: "left" | "right" | "balanced";
  weightShiftAsymmetry: number; // 0-1, higher means more loading imbalance
  preferredWeightSide: "left" | "right" | "balanced";
  supportPhaseAsymmetry: number; // 0-1, absolute left/right stance difference
  estimatedStepLengthAsymmetry: number; // 0-1 heuristic from step spacing

  // Balance / fall tendency
  fallRiskDetected: boolean;
  fallRiskDirection: "left" | "right" | "forward" | "neutral";
  fallRiskSeverity: number; // 0-1 heuristic severity
  walkingConfidence: "steady" | "watch" | "support-recommended";

  // Foot clearance / tripping
  leftToeClearance: number; // normalized swing clearance estimate
  rightToeClearance: number;
  toeDragRiskDetected: boolean;
  toeDragRiskSide: "left" | "right" | "both" | "none";

  // Pelvis and fatigue
  avgPelvicObliquity: number; // average hip line tilt magnitude in degrees
  pelvicDropDetected: boolean;
  pelvicDropSide: "left" | "right" | "none";
  fatigueDriftScore: number; // 0-1 change from early to late recording
  fatigueObserved: boolean;

  // Walking line (front view)
  stepWidth: number;          // avg distance between feet (normalized)
  lateralDeviation: number;   // how much they veer from straight line
  kneeValgusDetected: boolean; // knees caving inward

  // Overall scores
  gaitDeviationIndex: number; // 0-100, 100 = typical gait
  overallSymmetry: number;    // 0-1, combined symmetry score
}

export interface GaitSession {
  id: string;
  createdAt: string;
  label: string;
  durationMs: number;
  frames: PoseFrame[];
  metrics: SessionMetrics;
  notes: string;
  viewAngle: "side" | "front";
}

export interface SessionContext {
  afo: "on" | "off" | "not_applicable" | "unknown";
  footwear: "barefoot" | "shoes" | "orthotics" | "unknown";
  supportLevel: "independent" | "hand_support" | "walker" | "other" | "unknown";
  environment: "indoor" | "outdoor" | "unknown";
  painLevel: number | null;
  fatigueToday: "low" | "medium" | "high" | "unknown";
}

export const DEFAULT_SESSION_CONTEXT: SessionContext = {
  afo: "unknown",
  footwear: "unknown",
  supportLevel: "unknown",
  environment: "unknown",
  painLevel: null,
  fatigueToday: "unknown",
};
