import { LANDMARK } from "./landmarks";
import type { FrameMetrics, GaitPhaseAnalysis, SessionMetrics } from "./types";

type Point3D = { x: number; y: number; z: number };
type Landmark = { x: number; y: number; z: number; visibility: number };

// ---- Geometry helpers ----

function angleBetweenPoints(a: Point3D, b: Point3D, c: Point3D): number {
  const ba = { x: a.x - b.x, y: a.y - b.y, z: a.z - b.z };
  const bc = { x: c.x - b.x, y: c.y - b.y, z: c.z - b.z };
  const dot = ba.x * bc.x + ba.y * bc.y + ba.z * bc.z;
  const magBA = Math.sqrt(ba.x ** 2 + ba.y ** 2 + ba.z ** 2);
  const magBC = Math.sqrt(bc.x ** 2 + bc.y ** 2 + bc.z ** 2);
  if (magBA === 0 || magBC === 0) return 0;
  const cosAngle = Math.max(-1, Math.min(1, dot / (magBA * magBC)));
  return (Math.acos(cosAngle) * 180) / Math.PI;
}

function symmetryIndex(left: number, right: number): number {
  const max = Math.max(left, right);
  if (max === 0) return 1;
  return 1 - Math.abs(left - right) / max;
}

// Angle of a line from vertical (0 = perfectly upright)
function angleFromVertical(top: Point3D, bottom: Point3D): number {
  const dx = top.x - bottom.x;
  const dy = top.y - bottom.y; // y increases downward in image coords
  // Vertical = (0, 1), angle from it
  const angle = Math.atan2(Math.abs(dx), Math.abs(dy)) * (180 / Math.PI);
  return angle;
}

// Signed lateral lean (positive = leaning right)
function lateralLean(leftShoulder: Point3D, rightShoulder: Point3D, leftHip: Point3D, rightHip: Point3D): number {
  const shoulderMidX = (leftShoulder.x + rightShoulder.x) / 2;
  const hipMidX = (leftHip.x + rightHip.x) / 2;
  const shoulderMidY = (leftShoulder.y + rightShoulder.y) / 2;
  const hipMidY = (leftHip.y + rightHip.y) / 2;
  const dx = shoulderMidX - hipMidX;
  const dy = Math.abs(shoulderMidY - hipMidY);
  return Math.atan2(dx, dy) * (180 / Math.PI);
}

function smooth(values: number[], window: number = 5): number[] {
  const result: number[] = [];
  const half = Math.floor(window / 2);
  for (let i = 0; i < values.length; i++) {
    const start = Math.max(0, i - half);
    const end = Math.min(values.length, i + half + 1);
    const slice = values.slice(start, end);
    result.push(slice.reduce((a, b) => a + b, 0) / slice.length);
  }
  return result;
}

function avg(arr: number[]): number {
  if (arr.length === 0) return 0;
  return arr.reduce((a, b) => a + b, 0) / arr.length;
}

function stddev(arr: number[]): number {
  if (arr.length < 2) return 0;
  const mean = avg(arr);
  return Math.sqrt(arr.reduce((sum, v) => sum + (v - mean) ** 2, 0) / arr.length);
}

// ---- Per-frame metrics ----

export function computeFrameMetrics(
  worldLandmarks: Landmark[],
  timestamp: number
): FrameMetrics {
  const lm = worldLandmarks;

  // Joint angles
  const leftKneeAngle = angleBetweenPoints(lm[LANDMARK.LEFT_HIP], lm[LANDMARK.LEFT_KNEE], lm[LANDMARK.LEFT_ANKLE]);
  const rightKneeAngle = angleBetweenPoints(lm[LANDMARK.RIGHT_HIP], lm[LANDMARK.RIGHT_KNEE], lm[LANDMARK.RIGHT_ANKLE]);
  const leftHipAngle = angleBetweenPoints(lm[LANDMARK.LEFT_SHOULDER], lm[LANDMARK.LEFT_HIP], lm[LANDMARK.LEFT_KNEE]);
  const rightHipAngle = angleBetweenPoints(lm[LANDMARK.RIGHT_SHOULDER], lm[LANDMARK.RIGHT_HIP], lm[LANDMARK.RIGHT_KNEE]);
  const leftAnkleAngle = angleBetweenPoints(lm[LANDMARK.LEFT_KNEE], lm[LANDMARK.LEFT_ANKLE], lm[LANDMARK.LEFT_FOOT_INDEX]);
  const rightAnkleAngle = angleBetweenPoints(lm[LANDMARK.RIGHT_KNEE], lm[LANDMARK.RIGHT_ANKLE], lm[LANDMARK.RIGHT_FOOT_INDEX]);

  // Elbow angles (for arm position analysis)
  const leftElbowAngle = angleBetweenPoints(lm[LANDMARK.LEFT_SHOULDER], lm[LANDMARK.LEFT_ELBOW], lm[LANDMARK.LEFT_WRIST]);
  const rightElbowAngle = angleBetweenPoints(lm[LANDMARK.RIGHT_SHOULDER], lm[LANDMARK.RIGHT_ELBOW], lm[LANDMARK.RIGHT_WRIST]);

  // Shoulder angles (arm swing - angle of upper arm relative to torso)
  const leftShoulderAngle = angleBetweenPoints(lm[LANDMARK.LEFT_HIP], lm[LANDMARK.LEFT_SHOULDER], lm[LANDMARK.LEFT_ELBOW]);
  const rightShoulderAngle = angleBetweenPoints(lm[LANDMARK.RIGHT_HIP], lm[LANDMARK.RIGHT_SHOULDER], lm[LANDMARK.RIGHT_ELBOW]);

  // Trunk forward lean (side view) - angle of shoulder-hip line from vertical
  const shoulderMid = {
    x: (lm[LANDMARK.LEFT_SHOULDER].x + lm[LANDMARK.RIGHT_SHOULDER].x) / 2,
    y: (lm[LANDMARK.LEFT_SHOULDER].y + lm[LANDMARK.RIGHT_SHOULDER].y) / 2,
    z: (lm[LANDMARK.LEFT_SHOULDER].z + lm[LANDMARK.RIGHT_SHOULDER].z) / 2,
  };
  const hipMid = {
    x: (lm[LANDMARK.LEFT_HIP].x + lm[LANDMARK.RIGHT_HIP].x) / 2,
    y: (lm[LANDMARK.LEFT_HIP].y + lm[LANDMARK.RIGHT_HIP].y) / 2,
    z: (lm[LANDMARK.LEFT_HIP].z + lm[LANDMARK.RIGHT_HIP].z) / 2,
  };
  const trunkForwardLean = angleFromVertical(shoulderMid, hipMid);

  // Trunk lateral lean (front view)
  const trunkLateralLean = lateralLean(
    lm[LANDMARK.LEFT_SHOULDER], lm[LANDMARK.RIGHT_SHOULDER],
    lm[LANDMARK.LEFT_HIP], lm[LANDMARK.RIGHT_HIP]
  );

  // Head tilt (lateral) - angle of ear-to-ear line from horizontal
  const leftEar = lm[LANDMARK.LEFT_EAR];
  const rightEar = lm[LANDMARK.RIGHT_EAR];
  const earDy = leftEar.y - rightEar.y;
  const earDx = rightEar.x - leftEar.x;
  const headTilt = Math.atan2(earDy, earDx) * (180 / Math.PI); // positive = right ear lower = right tilt

  // Forward head posture - how far nose is ahead of shoulder midpoint
  const nose = lm[LANDMARK.NOSE];
  const noseForwardDx = nose.x - shoulderMid.x;
  const noseForwardDy = shoulderMid.y - nose.y; // shoulder is below nose
  const headForwardAngle = Math.atan2(Math.abs(noseForwardDx), noseForwardDy) * (180 / Math.PI);

  // Head rotation estimate from ear visibility asymmetry
  // When head rotates right, left ear becomes more visible and right ear less
  const leftEarVis = leftEar.visibility;
  const rightEarVis = rightEar.visibility;
  const visTotal = leftEarVis + rightEarVis;
  // Map visibility ratio to approximate rotation angle (rough: full rotation ~90°)
  const headRotation = visTotal > 0
    ? ((rightEarVis - leftEarVis) / visTotal) * 45 // positive = rotated right
    : 0;

  return {
    timestamp,
    leftKneeAngle,
    rightKneeAngle,
    leftHipAngle,
    rightHipAngle,
    leftAnkleAngle,
    rightAnkleAngle,
    trunkForwardLean,
    trunkLateralLean,
    leftElbowAngle,
    rightElbowAngle,
    leftShoulderAngle,
    rightShoulderAngle,
    headTilt,
    headForwardAngle,
    headRotation,
    leftAnkleY: lm[LANDMARK.LEFT_ANKLE].y,
    rightAnkleY: lm[LANDMARK.RIGHT_ANKLE].y,
    kneeSymmetry: symmetryIndex(leftKneeAngle, rightKneeAngle),
    hipSymmetry: symmetryIndex(leftHipAngle, rightHipAngle),
  };
}

// ---- Gait phase detection ----

function detectGaitPhases(
  frames: Array<{ timestamp: number; landmarks: Landmark[] }>
): GaitPhaseAnalysis {
  const empty: GaitPhaseAnalysis = {
    leftSteps: [], rightSteps: [],
    leftStancePercent: 50, rightStancePercent: 50, doubleSupportPercent: 20,
    leftStepDurationMs: 0, rightStepDurationMs: 0,
    stepTimeAsymmetry: 0, legPreference: "balanced",
  };

  if (frames.length < 20) return empty;

  // Track ankle Y positions over time (in normalized coords, lower Y = higher position = foot lifted)
  const leftAnkleY = smooth(frames.map(f => f.landmarks[LANDMARK.LEFT_ANKLE]?.y ?? 0), 7);
  const rightAnkleY = smooth(frames.map(f => f.landmarks[LANDMARK.RIGHT_ANKLE]?.y ?? 0), 7);
  const timestamps = frames.map(f => f.timestamp);

  // Detect step events as local maxima in ankle Y (foot at lowest = on ground, then lifts)
  // A step = foot going from ground (high Y) to lifted (low Y) to ground (high Y)
  // We detect the peaks (foot on ground = highest Y values)
  const leftSteps: number[] = [];
  const rightSteps: number[] = [];

  const minPeakDistance = 5; // minimum frames between peaks

  for (let i = 2; i < leftAnkleY.length - 2; i++) {
    if (leftAnkleY[i] > leftAnkleY[i - 1] && leftAnkleY[i] > leftAnkleY[i + 1] &&
        leftAnkleY[i] > leftAnkleY[i - 2] && leftAnkleY[i] > leftAnkleY[i + 2]) {
      if (leftSteps.length === 0 || i - leftSteps[leftSteps.length - 1] > minPeakDistance) {
        leftSteps.push(i);
      }
    }
    if (rightAnkleY[i] > rightAnkleY[i - 1] && rightAnkleY[i] > rightAnkleY[i + 1] &&
        rightAnkleY[i] > rightAnkleY[i - 2] && rightAnkleY[i] > rightAnkleY[i + 2]) {
      if (rightSteps.length === 0 || i - rightSteps[rightSteps.length - 1] > minPeakDistance) {
        rightSteps.push(i);
      }
    }
  }

  // Compute step durations
  const leftDurations: number[] = [];
  for (let i = 1; i < leftSteps.length; i++) {
    leftDurations.push(timestamps[leftSteps[i]] - timestamps[leftSteps[i - 1]]);
  }
  const rightDurations: number[] = [];
  for (let i = 1; i < rightSteps.length; i++) {
    rightDurations.push(timestamps[rightSteps[i]] - timestamps[rightSteps[i - 1]]);
  }

  const leftStepDurationMs = avg(leftDurations);
  const rightStepDurationMs = avg(rightDurations);

  // Step time asymmetry: 0 = symmetric, 1 = one side only
  const totalStepDuration = leftStepDurationMs + rightStepDurationMs;
  const stepTimeAsymmetry = totalStepDuration > 0
    ? Math.abs(leftStepDurationMs - rightStepDurationMs) / totalStepDuration
    : 0;

  // Determine leg preference
  let legPreference: "left" | "right" | "balanced" = "balanced";
  if (stepTimeAsymmetry > 0.15) {
    legPreference = leftStepDurationMs > rightStepDurationMs ? "right" : "left";
  }

  // Estimate stance percentages from ankle position
  // Foot is in stance when ankle Y is above median (on ground), swing when below (lifted)
  const leftMedian = [...leftAnkleY].sort((a, b) => a - b)[Math.floor(leftAnkleY.length / 2)];
  const rightMedian = [...rightAnkleY].sort((a, b) => a - b)[Math.floor(rightAnkleY.length / 2)];

  let leftStanceFrames = 0, rightStanceFrames = 0, doubleSupportFrames = 0;
  for (let i = 0; i < frames.length; i++) {
    const leftOnGround = leftAnkleY[i] >= leftMedian;
    const rightOnGround = rightAnkleY[i] >= rightMedian;
    if (leftOnGround) leftStanceFrames++;
    if (rightOnGround) rightStanceFrames++;
    if (leftOnGround && rightOnGround) doubleSupportFrames++;
  }

  const n = frames.length;

  return {
    leftSteps: leftSteps.map(i => timestamps[i]),
    rightSteps: rightSteps.map(i => timestamps[i]),
    leftStancePercent: (leftStanceFrames / n) * 100,
    rightStancePercent: (rightStanceFrames / n) * 100,
    doubleSupportPercent: (doubleSupportFrames / n) * 100,
    leftStepDurationMs,
    rightStepDurationMs,
    stepTimeAsymmetry,
    legPreference,
  };
}

// ---- Comprehensive session analysis ----

export function computeSessionMetrics(
  frameMetrics: FrameMetrics[],
  frames: Array<{ timestamp: number; landmarks: Landmark[] }>,
  durationMs: number
): SessionMetrics {
  const durationSeconds = durationMs / 1000;

  const defaults: SessionMetrics = {
    durationSeconds,
    totalSteps: 0, strideCadence: 0,
    avgLeftKneeAngle: 0, avgRightKneeAngle: 0,
    avgLeftHipAngle: 0, avgRightHipAngle: 0,
    avgLeftAnkleAngle: 0, avgRightAnkleAngle: 0,
    kneeSymmetryIndex: 0, leftKneeROM: 0, rightKneeROM: 0,
    leftPeakFlexion: 0, rightPeakFlexion: 0,
    crouchGaitDetected: false, crouchSeverity: 0,
    hipSymmetryIndex: 0, leftHipROM: 0, rightHipROM: 0,
    ankleSymmetryIndex: 0, toeWalkingDetected: false, toeWalkingSeverity: 0,
    leftHeelStrikePresent: true, rightHeelStrikePresent: true,
    avgForwardLean: 0, avgLateralLean: 0, trunkStability: 1,
    avgHeadTilt: 0, avgHeadForward: 0, headTiltDirection: "neutral",
    headStability: 1, headRotationBias: "neutral", avgHeadRotation: 0,
    leftArmSwingRange: 0, rightArmSwingRange: 0,
    armSwingSymmetry: 0, guardedArmDetected: false,
    leftStancePercent: 50, rightStancePercent: 50,
    doubleSupportPercent: 20, stepTimeAsymmetry: 0, legPreference: "balanced",
    stepWidth: 0, lateralDeviation: 0, kneeValgusDetected: false,
    gaitDeviationIndex: 50, overallSymmetry: 0,
  };

  if (frameMetrics.length === 0) return defaults;

  // Gait phases
  const phases = detectGaitPhases(frames);
  const totalSteps = phases.leftSteps.length + phases.rightSteps.length;
  const strideCadence = durationSeconds > 0 ? (totalSteps / durationSeconds) * 60 : 0;

  // ---- Knee analysis ----
  const leftKneeAngles = frameMetrics.map(f => f.leftKneeAngle);
  const rightKneeAngles = frameMetrics.map(f => f.rightKneeAngle);

  const leftKneeROM = Math.max(...leftKneeAngles) - Math.min(...leftKneeAngles);
  const rightKneeROM = Math.max(...rightKneeAngles) - Math.min(...rightKneeAngles);

  // Peak flexion = minimum angle (most bent)
  const leftPeakFlexion = Math.min(...leftKneeAngles);
  const rightPeakFlexion = Math.min(...rightKneeAngles);

  // Crouch gait: knee angle consistently < 150° during what should be stance phase
  // Normal standing knee is ~170-180°, crouch is < 150°
  const avgKnee = avg([...leftKneeAngles, ...rightKneeAngles]);
  const crouchThreshold = 150;
  const crouchFrames = frameMetrics.filter(
    f => f.leftKneeAngle < crouchThreshold || f.rightKneeAngle < crouchThreshold
  ).length;
  const crouchSeverity = crouchFrames / frameMetrics.length;
  const crouchGaitDetected = crouchSeverity > 0.3; // >30% of frames show crouch

  // ---- Hip analysis ----
  const leftHipAngles = frameMetrics.map(f => f.leftHipAngle);
  const rightHipAngles = frameMetrics.map(f => f.rightHipAngle);
  const leftHipROM = Math.max(...leftHipAngles) - Math.min(...leftHipAngles);
  const rightHipROM = Math.max(...rightHipAngles) - Math.min(...rightHipAngles);

  // ---- Ankle analysis ----
  const leftAnkleAngles = frameMetrics.map(f => f.leftAnkleAngle);
  const rightAnkleAngles = frameMetrics.map(f => f.rightAnkleAngle);

  // Toe walking: ankle angle consistently < 80° (plantarflexion)
  // Normal ankle at heel strike is ~90°, toe walking is < 80°
  const toeWalkFrames = frameMetrics.filter(
    f => f.leftAnkleAngle < 80 || f.rightAnkleAngle < 80
  ).length;
  const toeWalkingSeverity = toeWalkFrames / frameMetrics.length;
  const toeWalkingDetected = toeWalkingSeverity > 0.3;

  // Heel strike detection: ankle angle goes above 85° at some point (dorsiflexion)
  const leftHeelStrikePresent = leftAnkleAngles.some(a => a > 85);
  const rightHeelStrikePresent = rightAnkleAngles.some(a => a > 85);

  // ---- Trunk analysis ----
  const forwardLeans = frameMetrics.map(f => f.trunkForwardLean);
  const lateralLeans = frameMetrics.map(f => f.trunkLateralLean);
  const avgForwardLean = avg(forwardLeans);
  const avgLateralLean = avg(lateralLeans.map(Math.abs));

  // Trunk stability: inverse of trunk sway variability (less sway = more stable)
  const leanStdDev = stddev(lateralLeans);
  const trunkStability = Math.max(0, Math.min(1, 1 - leanStdDev / 15)); // normalize: 15° stddev = 0 stability

  // ---- Head analysis ----
  const headTilts = frameMetrics.map(f => f.headTilt);
  const headForwards = frameMetrics.map(f => f.headForwardAngle);
  const headRotations = frameMetrics.map(f => f.headRotation);

  const avgHeadTilt = avg(headTilts);
  const avgHeadForward = avg(headForwards);
  const avgHeadRotation = avg(headRotations);

  // Head tilt direction (persistent tilt)
  let headTiltDirection: "left" | "right" | "neutral" = "neutral";
  if (avgHeadTilt > 3) headTiltDirection = "right";
  else if (avgHeadTilt < -3) headTiltDirection = "left";

  // Head stability: inverse of head tilt variability
  const headTiltStdDev = stddev(headTilts);
  const headStability = Math.max(0, Math.min(1, 1 - headTiltStdDev / 10)); // 10° stddev = 0 stability

  // Head rotation bias (persistent looking to one side)
  let headRotationBias: "left" | "right" | "neutral" = "neutral";
  if (avgHeadRotation > 5) headRotationBias = "right";
  else if (avgHeadRotation < -5) headRotationBias = "left";

  // ---- Arm analysis ----
  const leftShoulderAngles = frameMetrics.map(f => f.leftShoulderAngle);
  const rightShoulderAngles = frameMetrics.map(f => f.rightShoulderAngle);
  const leftArmSwingRange = Math.max(...leftShoulderAngles) - Math.min(...leftShoulderAngles);
  const rightArmSwingRange = Math.max(...rightShoulderAngles) - Math.min(...rightShoulderAngles);
  const armSwingSymmetry = symmetryIndex(leftArmSwingRange, rightArmSwingRange);

  // Guarded arm: elbow consistently flexed < 120° and minimal arm swing
  const leftElbowAngles = frameMetrics.map(f => f.leftElbowAngle);
  const rightElbowAngles = frameMetrics.map(f => f.rightElbowAngle);
  const avgLeftElbow = avg(leftElbowAngles);
  const avgRightElbow = avg(rightElbowAngles);
  const guardedArmDetected =
    (avgLeftElbow < 120 && leftArmSwingRange < 10) ||
    (avgRightElbow < 120 && rightArmSwingRange < 10);

  // ---- Walking line (from front view landmarks) ----
  // Step width: average horizontal distance between ankles
  const stepWidths = frames.map(f => {
    const la = f.landmarks[LANDMARK.LEFT_ANKLE];
    const ra = f.landmarks[LANDMARK.RIGHT_ANKLE];
    return la && ra ? Math.abs(la.x - ra.x) : 0;
  });
  const stepWidth = avg(stepWidths);

  // Lateral deviation: how much hip center moves left/right over time
  const hipCenterX = frames.map(f => {
    const lh = f.landmarks[LANDMARK.LEFT_HIP];
    const rh = f.landmarks[LANDMARK.RIGHT_HIP];
    return lh && rh ? (lh.x + rh.x) / 2 : 0;
  });
  const lateralDeviation = stddev(hipCenterX);

  // Knee valgus: knees closer together than ankles (from front view)
  const valgusFrames = frames.filter(f => {
    const lk = f.landmarks[LANDMARK.LEFT_KNEE];
    const rk = f.landmarks[LANDMARK.RIGHT_KNEE];
    const la = f.landmarks[LANDMARK.LEFT_ANKLE];
    const ra = f.landmarks[LANDMARK.RIGHT_ANKLE];
    if (!lk || !rk || !la || !ra) return false;
    const kneeWidth = Math.abs(lk.x - rk.x);
    const ankleWidth = Math.abs(la.x - ra.x);
    return kneeWidth < ankleWidth * 0.85; // knees 15%+ closer than ankles
  }).length;
  const kneeValgusDetected = valgusFrames / frames.length > 0.3;

  // ---- Overall scores ----
  const overallSymmetry = avg([
    symmetryIndex(avg(leftKneeAngles), avg(rightKneeAngles)),
    symmetryIndex(avg(leftHipAngles), avg(rightHipAngles)),
    symmetryIndex(avg(leftAnkleAngles), avg(rightAnkleAngles)),
    armSwingSymmetry,
    1 - phases.stepTimeAsymmetry,
  ]);

  // Gait Deviation Index: composite score (0-100, higher = more typical gait)
  // 7 factors weighted to sum to 100
  const gdi =
    overallSymmetry * 15 +                                          // bilateral symmetry
    (1 - crouchSeverity) * 15 +                                     // no crouch gait
    (1 - toeWalkingSeverity) * 15 +                                 // no toe walking
    trunkStability * 15 +                                           // trunk stability
    headStability * 10 +                                            // head stability
    Math.min(1, (leftArmSwingRange + rightArmSwingRange) / 40) * 15 + // arm swing present
    (1 - phases.stepTimeAsymmetry) * 15;                            // step timing symmetry

  return {
    durationSeconds,
    totalSteps,
    strideCadence,

    avgLeftKneeAngle: avg(leftKneeAngles),
    avgRightKneeAngle: avg(rightKneeAngles),
    avgLeftHipAngle: avg(leftHipAngles),
    avgRightHipAngle: avg(rightHipAngles),
    avgLeftAnkleAngle: avg(leftAnkleAngles),
    avgRightAnkleAngle: avg(rightAnkleAngles),

    kneeSymmetryIndex: avg(frameMetrics.map(f => f.kneeSymmetry)),
    leftKneeROM,
    rightKneeROM,
    leftPeakFlexion,
    rightPeakFlexion,
    crouchGaitDetected,
    crouchSeverity,

    hipSymmetryIndex: avg(frameMetrics.map(f => f.hipSymmetry)),
    leftHipROM,
    rightHipROM,

    ankleSymmetryIndex: symmetryIndex(avg(leftAnkleAngles), avg(rightAnkleAngles)),
    toeWalkingDetected,
    toeWalkingSeverity,
    leftHeelStrikePresent,
    rightHeelStrikePresent,

    avgForwardLean,
    avgLateralLean,
    trunkStability,

    avgHeadTilt: Math.abs(avgHeadTilt),
    avgHeadForward,
    headTiltDirection,
    headStability,
    headRotationBias,
    avgHeadRotation: Math.abs(avgHeadRotation),

    leftArmSwingRange,
    rightArmSwingRange,
    armSwingSymmetry,
    guardedArmDetected,

    leftStancePercent: phases.leftStancePercent,
    rightStancePercent: phases.rightStancePercent,
    doubleSupportPercent: phases.doubleSupportPercent,
    stepTimeAsymmetry: phases.stepTimeAsymmetry,
    legPreference: phases.legPreference,

    stepWidth,
    lateralDeviation,
    kneeValgusDetected,

    gaitDeviationIndex: Math.round(Math.max(0, Math.min(100, gdi))),
    overallSymmetry,
  };
}
