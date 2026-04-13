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

  // Balance / fall tendency
  fallRiskDetected: boolean;
  fallRiskDirection: "left" | "right" | "forward" | "neutral";
  fallRiskSeverity: number; // 0-1 heuristic severity

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
