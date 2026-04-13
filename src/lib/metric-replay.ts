import { LANDMARK } from "@/lib/landmarks";
import type { FrameMetrics, PoseFrame } from "@/lib/types";
import type { TimelineMetricId } from "@/lib/metric-settings";

export interface MetricReplayConfig {
  id: TimelineMetricId;
  label: string;
  frameMetricKey?: keyof FrameMetrics;
  unit: string;
  normalMin?: number;
  normalMax?: number;
  absoluteValue?: boolean;
  joints: number[];
  segments: Array<[number, number]>;
}

export const METRIC_REPLAY_CONFIGS: MetricReplayConfig[] = [
  {
    id: "left_knee_angle",
    label: "Left Knee Angle",
    frameMetricKey: "leftKneeAngle",
    unit: "°",
    normalMin: 160,
    normalMax: 180,
    joints: [LANDMARK.LEFT_HIP, LANDMARK.LEFT_KNEE, LANDMARK.LEFT_ANKLE],
    segments: [
      [LANDMARK.LEFT_HIP, LANDMARK.LEFT_KNEE],
      [LANDMARK.LEFT_KNEE, LANDMARK.LEFT_ANKLE],
    ],
  },
  {
    id: "right_knee_angle",
    label: "Right Knee Angle",
    frameMetricKey: "rightKneeAngle",
    unit: "°",
    normalMin: 160,
    normalMax: 180,
    joints: [LANDMARK.RIGHT_HIP, LANDMARK.RIGHT_KNEE, LANDMARK.RIGHT_ANKLE],
    segments: [
      [LANDMARK.RIGHT_HIP, LANDMARK.RIGHT_KNEE],
      [LANDMARK.RIGHT_KNEE, LANDMARK.RIGHT_ANKLE],
    ],
  },
  {
    id: "left_hip_angle",
    label: "Left Hip Angle",
    frameMetricKey: "leftHipAngle",
    unit: "°",
    normalMin: 145,
    normalMax: 180,
    joints: [LANDMARK.LEFT_SHOULDER, LANDMARK.LEFT_HIP, LANDMARK.LEFT_KNEE],
    segments: [
      [LANDMARK.LEFT_SHOULDER, LANDMARK.LEFT_HIP],
      [LANDMARK.LEFT_HIP, LANDMARK.LEFT_KNEE],
    ],
  },
  {
    id: "right_hip_angle",
    label: "Right Hip Angle",
    frameMetricKey: "rightHipAngle",
    unit: "°",
    normalMin: 145,
    normalMax: 180,
    joints: [LANDMARK.RIGHT_SHOULDER, LANDMARK.RIGHT_HIP, LANDMARK.RIGHT_KNEE],
    segments: [
      [LANDMARK.RIGHT_SHOULDER, LANDMARK.RIGHT_HIP],
      [LANDMARK.RIGHT_HIP, LANDMARK.RIGHT_KNEE],
    ],
  },
  {
    id: "left_ankle_angle",
    label: "Left Ankle Angle",
    frameMetricKey: "leftAnkleAngle",
    unit: "°",
    normalMin: 85,
    normalMax: 95,
    joints: [LANDMARK.LEFT_KNEE, LANDMARK.LEFT_ANKLE, LANDMARK.LEFT_FOOT_INDEX],
    segments: [
      [LANDMARK.LEFT_KNEE, LANDMARK.LEFT_ANKLE],
      [LANDMARK.LEFT_ANKLE, LANDMARK.LEFT_FOOT_INDEX],
    ],
  },
  {
    id: "left_toe_clearance",
    label: "Left Toe Clearance",
    unit: "u",
    normalMin: 0.012,
    normalMax: 0.08,
    joints: [LANDMARK.LEFT_KNEE, LANDMARK.LEFT_ANKLE, LANDMARK.LEFT_FOOT_INDEX],
    segments: [
      [LANDMARK.LEFT_KNEE, LANDMARK.LEFT_ANKLE],
      [LANDMARK.LEFT_ANKLE, LANDMARK.LEFT_FOOT_INDEX],
    ],
  },
  {
    id: "right_toe_clearance",
    label: "Right Toe Clearance",
    unit: "u",
    normalMin: 0.012,
    normalMax: 0.08,
    joints: [LANDMARK.RIGHT_KNEE, LANDMARK.RIGHT_ANKLE, LANDMARK.RIGHT_FOOT_INDEX],
    segments: [
      [LANDMARK.RIGHT_KNEE, LANDMARK.RIGHT_ANKLE],
      [LANDMARK.RIGHT_ANKLE, LANDMARK.RIGHT_FOOT_INDEX],
    ],
  },
  {
    id: "left_arm_swing",
    label: "Left Arm Swing",
    frameMetricKey: "leftShoulderAngle",
    unit: "°",
    normalMin: 20,
    normalMax: 60,
    joints: [LANDMARK.LEFT_SHOULDER, LANDMARK.LEFT_ELBOW, LANDMARK.LEFT_WRIST],
    segments: [
      [LANDMARK.LEFT_SHOULDER, LANDMARK.LEFT_ELBOW],
      [LANDMARK.LEFT_ELBOW, LANDMARK.LEFT_WRIST],
    ],
  },
  {
    id: "right_arm_swing",
    label: "Right Arm Swing",
    frameMetricKey: "rightShoulderAngle",
    unit: "°",
    normalMin: 20,
    normalMax: 60,
    joints: [LANDMARK.RIGHT_SHOULDER, LANDMARK.RIGHT_ELBOW, LANDMARK.RIGHT_WRIST],
    segments: [
      [LANDMARK.RIGHT_SHOULDER, LANDMARK.RIGHT_ELBOW],
      [LANDMARK.RIGHT_ELBOW, LANDMARK.RIGHT_WRIST],
    ],
  },
  {
    id: "pelvic_obliquity",
    label: "Pelvic Obliquity",
    unit: "°",
    normalMin: 0,
    normalMax: 3,
    absoluteValue: true,
    joints: [LANDMARK.LEFT_HIP, LANDMARK.RIGHT_HIP, LANDMARK.LEFT_SHOULDER, LANDMARK.RIGHT_SHOULDER],
    segments: [
      [LANDMARK.LEFT_HIP, LANDMARK.RIGHT_HIP],
      [LANDMARK.LEFT_SHOULDER, LANDMARK.RIGHT_SHOULDER],
    ],
  },
  {
    id: "fatigue_drift",
    label: "Fatigue Drift",
    unit: "%",
    normalMin: 0,
    normalMax: 35,
    joints: [LANDMARK.LEFT_SHOULDER, LANDMARK.RIGHT_SHOULDER, LANDMARK.LEFT_HIP, LANDMARK.RIGHT_HIP, LANDMARK.LEFT_FOOT_INDEX, LANDMARK.RIGHT_FOOT_INDEX],
    segments: [
      [LANDMARK.LEFT_SHOULDER, LANDMARK.LEFT_HIP],
      [LANDMARK.RIGHT_SHOULDER, LANDMARK.RIGHT_HIP],
      [LANDMARK.LEFT_HIP, LANDMARK.RIGHT_HIP],
      [LANDMARK.LEFT_ANKLE, LANDMARK.LEFT_FOOT_INDEX],
      [LANDMARK.RIGHT_ANKLE, LANDMARK.RIGHT_FOOT_INDEX],
    ],
  },
  {
    id: "weight_shift",
    label: "Weight Shift",
    unit: "%",
    normalMin: -12,
    normalMax: 12,
    joints: [LANDMARK.LEFT_HIP, LANDMARK.RIGHT_HIP, LANDMARK.LEFT_KNEE, LANDMARK.RIGHT_KNEE, LANDMARK.LEFT_ANKLE, LANDMARK.RIGHT_ANKLE],
    segments: [
      [LANDMARK.LEFT_HIP, LANDMARK.LEFT_KNEE],
      [LANDMARK.LEFT_KNEE, LANDMARK.LEFT_ANKLE],
      [LANDMARK.RIGHT_HIP, LANDMARK.RIGHT_KNEE],
      [LANDMARK.RIGHT_KNEE, LANDMARK.RIGHT_ANKLE],
      [LANDMARK.LEFT_HIP, LANDMARK.RIGHT_HIP],
    ],
  },
  {
    id: "fall_risk",
    label: "Fall Tendency",
    unit: "%",
    normalMin: 0,
    normalMax: 35,
    joints: [LANDMARK.LEFT_SHOULDER, LANDMARK.RIGHT_SHOULDER, LANDMARK.LEFT_HIP, LANDMARK.RIGHT_HIP, LANDMARK.NOSE],
    segments: [
      [LANDMARK.LEFT_SHOULDER, LANDMARK.RIGHT_SHOULDER],
      [LANDMARK.LEFT_HIP, LANDMARK.RIGHT_HIP],
      [LANDMARK.LEFT_SHOULDER, LANDMARK.LEFT_HIP],
      [LANDMARK.RIGHT_SHOULDER, LANDMARK.RIGHT_HIP],
      [LANDMARK.NOSE, LANDMARK.LEFT_SHOULDER],
      [LANDMARK.NOSE, LANDMARK.RIGHT_SHOULDER],
    ],
  },
  {
    id: "trunk_forward_lean",
    label: "Trunk Forward Lean",
    frameMetricKey: "trunkForwardLean",
    unit: "°",
    normalMin: 0,
    normalMax: 5,
    joints: [LANDMARK.LEFT_SHOULDER, LANDMARK.RIGHT_SHOULDER, LANDMARK.LEFT_HIP, LANDMARK.RIGHT_HIP],
    segments: [
      [LANDMARK.LEFT_SHOULDER, LANDMARK.LEFT_HIP],
      [LANDMARK.RIGHT_SHOULDER, LANDMARK.RIGHT_HIP],
    ],
  },
  {
    id: "trunk_lateral_lean",
    label: "Trunk Lateral Lean",
    frameMetricKey: "trunkLateralLean",
    unit: "°",
    normalMin: 0,
    normalMax: 3,
    absoluteValue: true,
    joints: [LANDMARK.LEFT_SHOULDER, LANDMARK.RIGHT_SHOULDER, LANDMARK.LEFT_HIP, LANDMARK.RIGHT_HIP],
    segments: [
      [LANDMARK.LEFT_SHOULDER, LANDMARK.RIGHT_SHOULDER],
      [LANDMARK.LEFT_HIP, LANDMARK.RIGHT_HIP],
    ],
  },
  {
    id: "head_tilt",
    label: "Head Tilt",
    frameMetricKey: "headTilt",
    unit: "°",
    normalMin: 0,
    normalMax: 3,
    absoluteValue: true,
    joints: [LANDMARK.LEFT_EAR, LANDMARK.RIGHT_EAR, LANDMARK.NOSE],
    segments: [
      [LANDMARK.LEFT_EAR, LANDMARK.RIGHT_EAR],
      [LANDMARK.NOSE, LANDMARK.LEFT_EAR],
      [LANDMARK.NOSE, LANDMARK.RIGHT_EAR],
    ],
  },
  {
    id: "knee_symmetry",
    label: "Knee Symmetry",
    frameMetricKey: "kneeSymmetry",
    unit: "",
    normalMin: 0.9,
    normalMax: 1,
    joints: [LANDMARK.LEFT_HIP, LANDMARK.LEFT_KNEE, LANDMARK.LEFT_ANKLE, LANDMARK.RIGHT_HIP, LANDMARK.RIGHT_KNEE, LANDMARK.RIGHT_ANKLE],
    segments: [
      [LANDMARK.LEFT_HIP, LANDMARK.LEFT_KNEE],
      [LANDMARK.LEFT_KNEE, LANDMARK.LEFT_ANKLE],
      [LANDMARK.RIGHT_HIP, LANDMARK.RIGHT_KNEE],
      [LANDMARK.RIGHT_KNEE, LANDMARK.RIGHT_ANKLE],
    ],
  },
];

export function getMetricReplayConfig(metricId: TimelineMetricId) {
  return METRIC_REPLAY_CONFIGS.find((config) => config.id === metricId) ?? METRIC_REPLAY_CONFIGS[0];
}

export function getMetricValue(
  metricId: TimelineMetricId,
  frameMetric: FrameMetrics
) {
  switch (metricId) {
    case "left_toe_clearance": {
      return Math.max(0, 0.08 - frameMetric.leftAnkleY);
    }
    case "right_toe_clearance": {
      return Math.max(0, 0.08 - frameMetric.rightAnkleY);
    }
    case "left_arm_swing":
      return frameMetric.leftShoulderAngle;
    case "right_arm_swing":
      return frameMetric.rightShoulderAngle;
    case "pelvic_obliquity": {
      return Math.abs(frameMetric.trunkLateralLean * 0.7);
    }
    case "fatigue_drift": {
      const forward = Math.min(100, (frameMetric.trunkForwardLean / 20) * 100);
      const lateral = Math.min(100, (Math.abs(frameMetric.trunkLateralLean) / 12) * 100);
      const footDrop = Math.max(
        0,
        Math.min(100, ((0.02 - Math.max(0, 0.08 - frameMetric.leftAnkleY)) / 0.02) * 100),
        Math.min(100, ((0.02 - Math.max(0, 0.08 - frameMetric.rightAnkleY)) / 0.02) * 100)
      );
      return Math.max(0, Math.min(100, forward * 0.4 + lateral * 0.2 + footDrop * 0.4));
    }
    case "weight_shift": {
      const delta = frameMetric.rightAnkleY - frameMetric.leftAnkleY;
      return Math.max(-100, Math.min(100, delta * 800));
    }
    case "fall_risk": {
      const lateralSeverity = Math.min(100, (Math.abs(frameMetric.trunkLateralLean) / 12) * 100);
      const forwardSeverity = Math.min(
        100,
        Math.max(
          (frameMetric.trunkForwardLean / 20) * 100,
          (frameMetric.headForwardAngle / 25) * 100
        )
      );
      return Math.max(lateralSeverity, forwardSeverity);
    }
    default: {
      const config = getMetricReplayConfig(metricId);
      if (!config.frameMetricKey) return 0;
      const raw = frameMetric[config.frameMetricKey];
      return typeof raw === "number" ? raw : 0;
    }
  }
}

export function getMetricSeverity(
  value: number,
  config: MetricReplayConfig
): "good" | "watch" | "concern" {
  const resolvedValue = config.absoluteValue ? Math.abs(value) : value;
  if (config.normalMin == null || config.normalMax == null) return "good";
  if (resolvedValue >= config.normalMin && resolvedValue <= config.normalMax) return "good";

  const range = Math.max(config.normalMax - config.normalMin, 1);
  const distance =
    resolvedValue < config.normalMin
      ? config.normalMin - resolvedValue
      : resolvedValue - config.normalMax;

  return distance <= range * 0.5 ? "watch" : "concern";
}

export function getSeverityColor(severity: "good" | "watch" | "concern") {
  switch (severity) {
    case "good":
      return "#4ade80";
    case "watch":
      return "#facc15";
    case "concern":
      return "#f87171";
  }
}

export function findFrameIndexForTime(
  frames: PoseFrame[],
  currentTimeMs: number
) {
  if (frames.length === 0) return 0;
  let low = 0;
  let high = frames.length - 1;
  while (low < high) {
    const mid = Math.floor((low + high) / 2);
    if (frames[mid].timestamp < currentTimeMs) low = mid + 1;
    else high = mid;
  }
  return Math.max(0, Math.min(frames.length - 1, low));
}
