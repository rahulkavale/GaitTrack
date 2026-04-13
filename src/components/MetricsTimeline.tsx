"use client";

import { useMemo } from "react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
} from "recharts";
import type { FrameMetrics } from "@/lib/types";
import type { MetricPreferences, TimelineMetricId } from "@/lib/metric-settings";

interface MetricsTimelineProps {
  frameMetrics: FrameMetrics[];
  metric: keyof FrameMetrics;
  title: string;
  unit: string;
  // Optional: overlay data from another session for comparison
  comparisonData?: FrameMetrics[];
  comparisonLabel?: string;
  // Optional: reference lines for normal ranges
  normalMin?: number;
  normalMax?: number;
}

export function MetricsTimeline({
  frameMetrics,
  metric,
  title,
  unit,
  comparisonData,
  comparisonLabel,
  normalMin,
  normalMax,
}: MetricsTimelineProps) {
  const data = useMemo(() => {
    // Downsample to max ~200 points for performance
    const maxPoints = 200;
    const step = Math.max(1, Math.floor(frameMetrics.length / maxPoints));

    return frameMetrics
      .filter((_, i) => i % step === 0)
      .map((fm) => ({
        time: Math.round((fm.timestamp / 1000) * 10) / 10, // seconds, 1 decimal
        value: Math.round((fm[metric] as number) * 10) / 10,
        ...(comparisonData ? {} : {}),
      }));
  }, [frameMetrics, metric, comparisonData]);

  const compData = useMemo(() => {
    if (!comparisonData) return null;
    const maxPoints = 200;
    const step = Math.max(1, Math.floor(comparisonData.length / maxPoints));
    return comparisonData
      .filter((_, i) => i % step === 0)
      .map((fm) => ({
        time: Math.round((fm.timestamp / 1000) * 10) / 10,
        comparison: Math.round((fm[metric] as number) * 10) / 10,
      }));
  }, [comparisonData, metric]);

  // Merge comparison data by time alignment (normalize to 0-100% of session)
  const mergedData = useMemo(() => {
    if (!compData) return data;

    // Normalize both to percentage of session duration
    const maxTime1 = data.length > 0 ? data[data.length - 1].time : 1;
    const maxTime2 = compData.length > 0 ? compData[compData.length - 1].time : 1;

    const points = 100;
    const merged = [];
    for (let i = 0; i <= points; i++) {
      const pct = i / points;
      const idx1 = Math.min(Math.floor(pct * data.length), data.length - 1);
      const idx2 = Math.min(Math.floor(pct * compData.length), compData.length - 1);
      merged.push({
        pct: `${Math.round(pct * 100)}%`,
        time: Math.round(pct * maxTime1 * 10) / 10,
        value: data[idx1]?.value ?? 0,
        comparison: compData[idx2]?.comparison ?? 0,
      });
    }
    return merged;
  }, [data, compData]);

  return (
    <div className="bg-gray-800 rounded-xl p-4">
      <h3 className="text-sm font-medium text-gray-300 mb-1">{title}</h3>
      <ResponsiveContainer width="100%" height={180}>
        <LineChart data={comparisonData ? mergedData : data}>
          <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
          <XAxis
            dataKey={comparisonData ? "pct" : "time"}
            tick={{ fontSize: 9, fill: "#6B7280" }}
            label={
              comparisonData
                ? { value: "% of session", position: "insideBottom", fontSize: 9, fill: "#6B7280", offset: -5 }
                : { value: "seconds", position: "insideBottom", fontSize: 9, fill: "#6B7280", offset: -5 }
            }
          />
          <YAxis
            tick={{ fontSize: 9, fill: "#6B7280" }}
            label={{ value: unit, angle: -90, position: "insideLeft", fontSize: 9, fill: "#6B7280" }}
          />
          <Tooltip
            contentStyle={{
              backgroundColor: "#1F2937",
              border: "none",
              borderRadius: 8,
              fontSize: 11,
            }}
            formatter={(value, name) => [
              `${value}${unit}`,
              name === "comparison" ? comparisonLabel || "Previous" : "Current",
            ]}
          />

          {/* Normal range reference lines */}
          {normalMin != null && (
            <ReferenceLine y={normalMin} stroke="#4ADE80" strokeDasharray="4 4" strokeOpacity={0.5} />
          )}
          {normalMax != null && (
            <ReferenceLine y={normalMax} stroke="#4ADE80" strokeDasharray="4 4" strokeOpacity={0.5} />
          )}

          <Line
            type="monotone"
            dataKey="value"
            stroke="#34D399"
            strokeWidth={1.5}
            dot={false}
            name="Current"
          />
          {comparisonData && (
            <Line
              type="monotone"
              dataKey="comparison"
              stroke="#60A5FA"
              strokeWidth={1.5}
              dot={false}
              strokeDasharray="4 4"
              name={comparisonLabel || "Previous"}
            />
          )}
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

// Preset timeline charts for common gait metrics
interface GaitTimelineProps {
  frameMetrics: FrameMetrics[];
  comparisonMetrics?: FrameMetrics[];
  comparisonLabel?: string;
  metricPreferences?: MetricPreferences;
}

export function GaitTimelines({
  frameMetrics,
  comparisonMetrics,
  comparisonLabel,
  metricPreferences,
}: GaitTimelineProps) {
  if (frameMetrics.length === 0) return null;

  const enabled = (metricId: TimelineMetricId) => metricPreferences?.timelines[metricId]?.enabled ?? true;

  return (
    <div className="space-y-3">
      <h2 className="text-sm font-medium text-gray-400">Frame-by-Frame Analysis</h2>

      {enabled("left_knee_angle") && (
        <MetricsTimeline
          frameMetrics={frameMetrics}
          metric="leftKneeAngle"
          title="Left Knee Angle"
          unit="°"
          comparisonData={comparisonMetrics}
          comparisonLabel={comparisonLabel}
          normalMin={160}
          normalMax={180}
        />
      )}
      {enabled("right_knee_angle") && (
        <MetricsTimeline
          frameMetrics={frameMetrics}
          metric="rightKneeAngle"
          title="Right Knee Angle"
          unit="°"
          comparisonData={comparisonMetrics}
          comparisonLabel={comparisonLabel}
          normalMin={160}
          normalMax={180}
        />
      )}
      {enabled("left_hip_angle") && (
        <MetricsTimeline
          frameMetrics={frameMetrics}
          metric="leftHipAngle"
          title="Left Hip Angle"
          unit="°"
          comparisonData={comparisonMetrics}
          comparisonLabel={comparisonLabel}
        />
      )}
      {enabled("right_hip_angle") && (
        <MetricsTimeline
          frameMetrics={frameMetrics}
          metric="rightHipAngle"
          title="Right Hip Angle"
          unit="°"
          comparisonData={comparisonMetrics}
          comparisonLabel={comparisonLabel}
        />
      )}
      {enabled("left_ankle_angle") && (
        <MetricsTimeline
          frameMetrics={frameMetrics}
          metric="leftAnkleAngle"
          title="Left Ankle Angle"
          unit="°"
          comparisonData={comparisonMetrics}
          comparisonLabel={comparisonLabel}
          normalMin={85}
          normalMax={95}
        />
      )}
      {enabled("trunk_forward_lean") && (
        <MetricsTimeline
          frameMetrics={frameMetrics}
          metric="trunkForwardLean"
          title="Trunk Forward Lean"
          unit="°"
          comparisonData={comparisonMetrics}
          comparisonLabel={comparisonLabel}
        />
      )}
      {enabled("trunk_lateral_lean") && (
        <MetricsTimeline
          frameMetrics={frameMetrics}
          metric="trunkLateralLean"
          title="Trunk Lateral Lean"
          unit="°"
          comparisonData={comparisonMetrics}
          comparisonLabel={comparisonLabel}
        />
      )}
      {enabled("head_tilt") && (
        <MetricsTimeline
          frameMetrics={frameMetrics}
          metric="headTilt"
          title="Head Tilt (Lateral)"
          unit="°"
          comparisonData={comparisonMetrics}
          comparisonLabel={comparisonLabel}
        />
      )}
      {enabled("knee_symmetry") && (
        <MetricsTimeline
          frameMetrics={frameMetrics}
          metric="kneeSymmetry"
          title="Knee Symmetry (per frame)"
          unit=""
          comparisonData={comparisonMetrics}
          comparisonLabel={comparisonLabel}
        />
      )}
    </div>
  );
}
