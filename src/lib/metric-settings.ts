export type SummaryMetricId =
  | "movement_score"
  | "overall_symmetry"
  | "knee_symmetry"
  | "cadence"
  | "trunk_stability"
  | "head_stability";

export type FeatureMetricId =
  | "persistent_knee_bend"
  | "forefoot_first_landing"
  | "reduced_knee_motion"
  | "side_lean_of_trunk"
  | "combined_bent_knee_forefoot"
  | "knee_overextension"
  | "limited_arm_swing"
  | "narrow_step_width";

export type TimelineMetricId =
  | "left_knee_angle"
  | "right_knee_angle"
  | "left_hip_angle"
  | "right_hip_angle"
  | "left_ankle_angle"
  | "trunk_forward_lean"
  | "trunk_lateral_lean"
  | "head_tilt"
  | "knee_symmetry";

export interface SummaryMetricPreference {
  enabled: boolean;
}

export interface FeatureThresholds {
  mild: number;
  moderate: number;
  severe: number;
}

export interface FeatureMetricPreference {
  enabled: boolean;
  thresholds: FeatureThresholds;
}

export interface TimelineMetricPreference {
  enabled: boolean;
}

export interface MetricPreferences {
  summary: Record<SummaryMetricId, SummaryMetricPreference>;
  features: Record<FeatureMetricId, FeatureMetricPreference>;
  timelines: Record<TimelineMetricId, TimelineMetricPreference>;
}

export interface MetricDefinition {
  id: SummaryMetricId | FeatureMetricId | TimelineMetricId;
  kind: "summary" | "feature" | "timeline";
  label: string;
  shortDescription: string;
  detailDescription: string;
  inputs: string[];
  formula: string;
  source: string;
}

const defaultSummary: Record<SummaryMetricId, SummaryMetricPreference> = {
  movement_score: { enabled: true },
  overall_symmetry: { enabled: true },
  knee_symmetry: { enabled: true },
  cadence: { enabled: true },
  trunk_stability: { enabled: true },
  head_stability: { enabled: true },
};

const defaultFeatures: Record<FeatureMetricId, FeatureMetricPreference> = {
  persistent_knee_bend: {
    enabled: true,
    thresholds: { mild: 5, moderate: 15, severe: 30 },
  },
  forefoot_first_landing: {
    enabled: true,
    thresholds: { mild: -5, moderate: -10, severe: -20 },
  },
  reduced_knee_motion: {
    enabled: true,
    thresholds: { mild: 55, moderate: 40, severe: 20 },
  },
  side_lean_of_trunk: {
    enabled: true,
    thresholds: { mild: 3, moderate: 7, severe: 12 },
  },
  combined_bent_knee_forefoot: {
    enabled: true,
    thresholds: { mild: 15, moderate: 15, severe: 30 },
  },
  knee_overextension: {
    enabled: true,
    thresholds: { mild: -5, moderate: -8, severe: -10 },
  },
  limited_arm_swing: {
    enabled: true,
    thresholds: { mild: 10, moderate: 7, severe: 4 },
  },
  narrow_step_width: {
    enabled: true,
    thresholds: { mild: 0.08, moderate: 0.05, severe: 0.03 },
  },
};

const defaultTimelines: Record<TimelineMetricId, TimelineMetricPreference> = {
  left_knee_angle: { enabled: true },
  right_knee_angle: { enabled: true },
  left_hip_angle: { enabled: true },
  right_hip_angle: { enabled: true },
  left_ankle_angle: { enabled: true },
  trunk_forward_lean: { enabled: true },
  trunk_lateral_lean: { enabled: true },
  head_tilt: { enabled: true },
  knee_symmetry: { enabled: true },
};

export const DEFAULT_METRIC_PREFERENCES: MetricPreferences = {
  summary: defaultSummary,
  features: defaultFeatures,
  timelines: defaultTimelines,
};

export const METRIC_DEFINITIONS: MetricDefinition[] = [
  {
    id: "movement_score",
    kind: "summary",
    label: "Movement Score",
    shortDescription: "High-level walking summary score.",
    detailDescription:
      "A custom composite score derived from symmetry, crouch severity, trunk stability, head stability, arm swing, and timing features. This is a project-specific heuristic, not a standardized clinical GDI.",
    inputs: ["symmetry indices", "timing asymmetry", "posture stability", "toe-walking and crouch flags"],
    formula:
      "Weighted heuristic score assembled from session metrics and normalized to a 0-100 scale.",
    source:
      "Internal project heuristic based on pose-derived gait features. Not a validated published index.",
  },
  {
    id: "overall_symmetry",
    kind: "summary",
    label: "Left-Right Balance",
    shortDescription: "Combined left-right movement symmetry.",
    detailDescription:
      "This rolls up side-to-side balance from multiple joint measurements to show how evenly both sides are moving during the session.",
    inputs: ["knee symmetry", "hip symmetry", "arm swing symmetry", "step timing asymmetry"],
    formula: "Composite of per-joint symmetry scores, normalized to 0-100%.",
    source: "Internal project heuristic informed by standard symmetry comparisons used in gait analysis.",
  },
  {
    id: "knee_symmetry",
    kind: "summary",
    label: "Knee Balance",
    shortDescription: "How similarly both knees move.",
    detailDescription:
      "Knee balance compares left and right knee angle behavior. Higher values indicate more even movement between sides.",
    inputs: ["left knee angle", "right knee angle"],
    formula: "1 - |left - right| / max(left, right), converted to a percentage.",
    source: "Standard symmetry-index style comparison applied to pose-derived knee angles.",
  },
  {
    id: "cadence",
    kind: "summary",
    label: "Walking Speed",
    shortDescription: "Step frequency estimate.",
    detailDescription:
      "Walking speed is estimated from detected step timing and reported as steps per minute. In this app it is heuristic and depends on camera quality and gait-phase detection quality.",
    inputs: ["left and right ankle trajectories", "session duration"],
    formula: "Detected steps / duration * 60.",
    source: "Common cadence definition; current event detection is an app heuristic.",
  },
  {
    id: "trunk_stability",
    kind: "summary",
    label: "Body Steadiness",
    shortDescription: "How steady the trunk stays during walking.",
    detailDescription:
      "Trunk stability estimates how much upper body sway is present during the capture. Higher values mean less variation frame to frame.",
    inputs: ["trunk forward lean", "trunk lateral lean"],
    formula: "Inverse of frame-to-frame sway variation, normalized to 0-100%.",
    source: "Internal project heuristic using pose-derived trunk angles.",
  },
  {
    id: "head_stability",
    kind: "summary",
    label: "Head Steadiness",
    shortDescription: "How steady the head stays during walking.",
    detailDescription:
      "Head steadiness summarizes how much head tilt and rotation vary through the recording.",
    inputs: ["head tilt", "head forward angle", "head rotation estimate"],
    formula: "Inverse of head movement variability, normalized to 0-100%.",
    source: "Internal project heuristic using pose landmarks.",
  },
  {
    id: "persistent_knee_bend",
    kind: "feature",
    label: "Persistent Knee Bend",
    shortDescription: "Flags when the knees stay more bent than expected.",
    detailDescription:
      "This feature compares observed knee flexion against default stance-like thresholds. It is currently based on pose-derived averages and not true gait-event segmentation.",
    inputs: ["left knee flexion", "right knee flexion", "knee range of motion"],
    formula:
      "Worst observed side is compared with mild, moderate, and severe knee-flexion thresholds in degrees.",
    source:
      "Default thresholds are project heuristics informed by pediatric gait literature and clinical practice references.",
  },
  {
    id: "forefoot_first_landing",
    kind: "feature",
    label: "Forefoot-First Landing",
    shortDescription: "Flags a plantarflexed landing tendency.",
    detailDescription:
      "This feature looks at ankle position around landing-like moments and highlights when the foot appears to land more on the forefoot than the heel.",
    inputs: ["left ankle angle", "right ankle angle"],
    formula:
      "Worst ankle clinical angle is compared against plantarflexion thresholds. More negative values are more concerning.",
    source:
      "Default thresholds are project heuristics informed by ankle position conventions used in gait review.",
  },
  {
    id: "reduced_knee_motion",
    kind: "feature",
    label: "Reduced Knee Motion",
    shortDescription: "Flags limited bend-and-straighten excursion at the knee.",
    detailDescription:
      "This feature uses knee range of motion through the recording to flag when the knees appear to move through a smaller-than-expected excursion.",
    inputs: ["left knee ROM", "right knee ROM", "peak knee flexion"],
    formula:
      "Lowest knee ROM is compared against mild, moderate, and severe thresholds. Lower values are more concerning.",
    source:
      "Default thresholds are project heuristics based on expected excursion ranges in observational gait review.",
  },
  {
    id: "side_lean_of_trunk",
    kind: "feature",
    label: "Side Lean of Trunk",
    shortDescription: "Flags excessive side-to-side body lean.",
    detailDescription:
      "This feature estimates how far the trunk leans sideways relative to the hips during the session.",
    inputs: ["trunk lateral lean"],
    formula:
      "Absolute lateral lean is compared against mild, moderate, and severe degree thresholds.",
    source:
      "Default thresholds are project heuristics informed by common observational gait scoring ranges.",
  },
  {
    id: "combined_bent_knee_forefoot",
    kind: "feature",
    label: "Combined Bent-Knee and Forefoot Pattern",
    shortDescription: "Flags a combined multi-joint pattern.",
    detailDescription:
      "This feature checks whether knee bend, ankle plantarflexion, and increased hip flexion appear together in the same capture.",
    inputs: ["knee bend", "ankle landing angle", "hip flexion"],
    formula:
      "Boolean combination of multiple threshold checks across knee, ankle, and hip features.",
    source:
      "Internal project heuristic for an observational combined pattern, not a diagnosis.",
  },
  {
    id: "knee_overextension",
    kind: "feature",
    label: "Knee Overextension",
    shortDescription: "Flags when the knee appears to go past straight.",
    detailDescription:
      "This feature checks whether the knee appears to extend beyond neutral during the observed capture.",
    inputs: ["left peak knee extension", "right peak knee extension"],
    formula:
      "Worst side is compared against negative extension thresholds. More negative values are more concerning.",
    source:
      "Internal project heuristic informed by common recurvatum screening ranges.",
  },
  {
    id: "limited_arm_swing",
    kind: "feature",
    label: "Limited Arm Swing",
    shortDescription: "Flags reduced arm movement during walking.",
    detailDescription:
      "This feature compares observed arm swing range against low-range thresholds and highlights when the arms appear held stiff or guarded.",
    inputs: ["left shoulder swing angle", "right shoulder swing angle"],
    formula:
      "Average arm swing range is compared against mild, moderate, and severe low-range thresholds.",
    source:
      "Internal project heuristic informed by expected observational arm swing ranges.",
  },
  {
    id: "narrow_step_width",
    kind: "feature",
    label: "Narrow Step Width",
    shortDescription: "Flags when the feet appear to pass very close together.",
    detailDescription:
      "This feature uses normalized pose spacing to estimate whether the steps are unusually narrow. It is especially camera-dependent.",
    inputs: ["step width estimate"],
    formula:
      "Observed step width is compared against mild, moderate, and severe lower-bound thresholds.",
    source:
      "Internal project heuristic. Strongly affected by framing and camera setup.",
  },
  {
    id: "left_knee_angle",
    kind: "timeline",
    label: "Left Knee Angle Trace",
    shortDescription: "Frame-by-frame left knee motion.",
    detailDescription:
      "Plots the raw MediaPipe left knee angle over time to show how the knee bends and straightens during the session.",
    inputs: ["left hip, knee, ankle landmarks"],
    formula: "Angle between hip-knee-ankle landmarks per frame.",
    source: "Direct pose-derived geometric angle.",
  },
  {
    id: "right_knee_angle",
    kind: "timeline",
    label: "Right Knee Angle Trace",
    shortDescription: "Frame-by-frame right knee motion.",
    detailDescription:
      "Plots the raw MediaPipe right knee angle over time to show how the knee bends and straightens during the session.",
    inputs: ["right hip, knee, ankle landmarks"],
    formula: "Angle between hip-knee-ankle landmarks per frame.",
    source: "Direct pose-derived geometric angle.",
  },
  {
    id: "left_hip_angle",
    kind: "timeline",
    label: "Left Hip Angle Trace",
    shortDescription: "Frame-by-frame left hip motion.",
    detailDescription:
      "Plots the raw MediaPipe left hip angle over time to show how the hip opens and closes during walking.",
    inputs: ["left shoulder, hip, knee landmarks"],
    formula: "Angle between shoulder-hip-knee landmarks per frame.",
    source: "Direct pose-derived geometric angle.",
  },
  {
    id: "right_hip_angle",
    kind: "timeline",
    label: "Right Hip Angle Trace",
    shortDescription: "Frame-by-frame right hip motion.",
    detailDescription:
      "Plots the raw MediaPipe right hip angle over time to show how the hip opens and closes during walking.",
    inputs: ["right shoulder, hip, knee landmarks"],
    formula: "Angle between shoulder-hip-knee landmarks per frame.",
    source: "Direct pose-derived geometric angle.",
  },
  {
    id: "left_ankle_angle",
    kind: "timeline",
    label: "Left Ankle Angle Trace",
    shortDescription: "Frame-by-frame left ankle position.",
    detailDescription:
      "Plots the raw left ankle angle over time. Interpretation depends heavily on view angle and pose quality.",
    inputs: ["left knee, ankle, foot landmarks"],
    formula: "Angle between knee-ankle-foot landmarks per frame.",
    source: "Direct pose-derived geometric angle.",
  },
  {
    id: "trunk_forward_lean",
    kind: "timeline",
    label: "Trunk Forward Lean Trace",
    shortDescription: "Frame-by-frame trunk lean from vertical.",
    detailDescription:
      "Plots the trunk line angle from vertical over time to show changes in forward body lean.",
    inputs: ["shoulder midpoint", "hip midpoint"],
    formula: "Angle of the shoulder-hip line from vertical per frame.",
    source: "Pose-derived geometric angle.",
  },
  {
    id: "trunk_lateral_lean",
    kind: "timeline",
    label: "Trunk Lateral Lean Trace",
    shortDescription: "Frame-by-frame side lean of the trunk.",
    detailDescription:
      "Plots how far the trunk leans left or right relative to the hips over time.",
    inputs: ["left/right shoulders", "left/right hips"],
    formula: "Signed lateral lean estimate from shoulder and hip midpoints per frame.",
    source: "Pose-derived geometric angle.",
  },
  {
    id: "head_tilt",
    kind: "timeline",
    label: "Head Tilt Trace",
    shortDescription: "Frame-by-frame lateral head tilt.",
    detailDescription:
      "Plots the ear-to-ear line angle over time to show whether the head stays level or tilts during walking.",
    inputs: ["left ear landmark", "right ear landmark"],
    formula: "Angle of the ear line from horizontal per frame.",
    source: "Pose-derived geometric angle.",
  },
  {
    id: "knee_symmetry",
    kind: "timeline",
    label: "Knee Symmetry Trace",
    shortDescription: "Frame-by-frame knee symmetry signal.",
    detailDescription:
      "Plots the per-frame comparison between left and right knee motion, where higher values mean the two sides are behaving more similarly.",
    inputs: ["left knee angle", "right knee angle"],
    formula: "1 - |left - right| / max(left, right), computed per frame.",
    source: "Standard symmetry-index style comparison applied frame by frame.",
  },
];

export function mergeMetricPreferences(
  input?: Partial<MetricPreferences> | null
): MetricPreferences {
  return {
    summary: {
      ...defaultSummary,
      ...(input?.summary ?? {}),
    },
    features: {
      ...defaultFeatures,
      ...Object.fromEntries(
        Object.entries(input?.features ?? {}).map(([key, value]) => [
          key,
          {
            ...defaultFeatures[key as FeatureMetricId],
            ...value,
            thresholds: {
              ...defaultFeatures[key as FeatureMetricId].thresholds,
              ...(value?.thresholds ?? {}),
            },
          },
        ])
      ),
    } as MetricPreferences["features"],
    timelines: {
      ...defaultTimelines,
      ...(input?.timelines ?? {}),
    },
  };
}

export function getMetricDefinition(metricId: string) {
  return METRIC_DEFINITIONS.find((definition) => definition.id === metricId) ?? null;
}

export function getSummaryMetricOrder(): SummaryMetricId[] {
  return [
    "movement_score",
    "overall_symmetry",
    "knee_symmetry",
    "cadence",
    "trunk_stability",
    "head_stability",
  ];
}

export function getFeatureMetricOrder(): FeatureMetricId[] {
  return [
    "persistent_knee_bend",
    "forefoot_first_landing",
    "reduced_knee_motion",
    "side_lean_of_trunk",
    "combined_bent_knee_forefoot",
    "knee_overextension",
    "limited_arm_swing",
    "narrow_step_width",
  ];
}

export function getTimelineMetricOrder(): TimelineMetricId[] {
  return [
    "left_knee_angle",
    "right_knee_angle",
    "left_hip_angle",
    "right_hip_angle",
    "left_ankle_angle",
    "trunk_forward_lean",
    "trunk_lateral_lean",
    "head_tilt",
    "knee_symmetry",
  ];
}
