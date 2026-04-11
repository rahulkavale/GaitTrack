"use client";

import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from "recharts";
import type { GaitSession } from "@/lib/types";

interface ProgressChartProps {
  sessions: GaitSession[];
  metric: "kneeSymmetry" | "hipSymmetry" | "cadence" | "kneeAngles" | "hipAngles";
}

export function ProgressChart({ sessions, metric }: ProgressChartProps) {
  const sorted = [...sessions].sort(
    (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
  );

  const data = sorted.map((s) => {
    const date = new Date(s.createdAt).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
    });

    switch (metric) {
      case "kneeSymmetry":
        return { date, value: Math.round(s.metrics.kneeSymmetryIndex * 100) };
      case "hipSymmetry":
        return { date, value: Math.round(s.metrics.hipSymmetryIndex * 100) };
      case "cadence":
        return { date, value: Math.round(s.metrics.strideCadence) };
      case "kneeAngles":
        return {
          date,
          left: Math.round(s.metrics.avgLeftKneeAngle),
          right: Math.round(s.metrics.avgRightKneeAngle),
        };
      case "hipAngles":
        return {
          date,
          left: Math.round(s.metrics.avgLeftHipAngle),
          right: Math.round(s.metrics.avgRightHipAngle),
        };
    }
  });

  const titles: Record<string, string> = {
    kneeSymmetry: "Knee Symmetry (%)",
    hipSymmetry: "Hip Symmetry (%)",
    cadence: "Stride Cadence (steps/min)",
    kneeAngles: "Knee Angles (degrees)",
    hipAngles: "Hip Angles (degrees)",
  };

  const hasLeftRight = metric === "kneeAngles" || metric === "hipAngles";

  return (
    <div className="bg-gray-800 rounded-xl p-4">
      <h3 className="text-sm font-medium text-gray-300 mb-3">{titles[metric]}</h3>
      <ResponsiveContainer width="100%" height={200}>
        <LineChart data={data}>
          <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
          <XAxis dataKey="date" tick={{ fontSize: 10, fill: "#9CA3AF" }} />
          <YAxis tick={{ fontSize: 10, fill: "#9CA3AF" }} />
          <Tooltip
            contentStyle={{
              backgroundColor: "#1F2937",
              border: "none",
              borderRadius: 8,
              fontSize: 12,
            }}
          />
          {hasLeftRight ? (
            <>
              <Legend />
              <Line
                type="monotone"
                dataKey="left"
                stroke="#34D399"
                strokeWidth={2}
                dot={{ r: 4 }}
                name="Left"
              />
              <Line
                type="monotone"
                dataKey="right"
                stroke="#60A5FA"
                strokeWidth={2}
                dot={{ r: 4 }}
                name="Right"
              />
            </>
          ) : (
            <Line
              type="monotone"
              dataKey="value"
              stroke="#34D399"
              strokeWidth={2}
              dot={{ r: 4 }}
            />
          )}
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
