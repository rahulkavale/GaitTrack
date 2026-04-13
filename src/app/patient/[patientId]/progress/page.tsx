"use client";

import { useEffect, useState, use } from "react";
import { useRouter } from "next/navigation";
import { getSessions } from "@/lib/db";
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Legend,
} from "recharts";
import type { SessionContext, SessionMetrics } from "@/lib/types";

interface SessionRow {
  id: string;
  label: string;
  knee_symmetry_index: number | null;
  hip_symmetry_index: number | null;
  stride_cadence: number | null;
  total_steps: number | null;
  duration_seconds: number | null;
  computed_metrics: SessionMetrics | null;
  session_context?: SessionContext | null;
  created_at: string;
}

function TrendChart({
  data,
  title,
  lines,
  unit,
  domain,
}: {
  data: Array<Record<string, unknown>>;
  title: string;
  lines: Array<{ key: string; color: string; name: string }>;
  unit: string;
  domain?: [number, number];
}) {
  return (
    <div className="bg-gray-800 rounded-xl p-4">
      <h3 className="text-sm font-medium text-gray-300 mb-3">{title}</h3>
      <ResponsiveContainer width="100%" height={180}>
        <LineChart data={data}>
          <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
          <XAxis dataKey="date" tick={{ fontSize: 9, fill: "#6B7280" }} />
          <YAxis
            tick={{ fontSize: 9, fill: "#6B7280" }}
            domain={domain}
            label={{ value: unit, angle: -90, position: "insideLeft", fontSize: 9, fill: "#6B7280" }}
          />
          <Tooltip
            contentStyle={{ backgroundColor: "#1F2937", border: "none", borderRadius: 8, fontSize: 11 }}
          />
          {lines.length > 1 && <Legend wrapperStyle={{ fontSize: 10 }} />}
          {lines.map((line) => (
            <Line
              key={line.key}
              type="monotone"
              dataKey={line.key}
              stroke={line.color}
              strokeWidth={2}
              dot={{ r: 3 }}
              name={line.name}
            />
          ))}
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

function DeltaBadge({ label, current, previous, unit, higherIsBetter }: {
  label: string; current: number; previous: number; unit: string; higherIsBetter: boolean;
}) {
  const delta = current - previous;
  const pct = previous !== 0 ? Math.round((delta / previous) * 100) : 0;
  const improved = higherIsBetter ? delta > 0 : delta < 0;
  const color = improved ? "text-green-400" : delta === 0 ? "text-gray-400" : "text-red-400";
  const arrow = improved ? "↑" : delta === 0 ? "→" : "↓";

  return (
    <div className="flex justify-between items-center py-1.5">
      <span className="text-xs text-gray-400">{label}</span>
      <div className="text-right">
        <span className="text-xs font-mono text-white">{Math.round(current)}{unit}</span>
        <span className={`text-xs font-mono ml-2 ${color}`}>
          {arrow} {Math.abs(pct)}%
        </span>
      </div>
    </div>
  );
}

function ConfidenceBadge({ value }: { value: SessionMetrics["walkingConfidence"] }) {
  const color =
    value === "steady"
      ? "text-green-400"
      : value === "watch"
      ? "text-yellow-400"
      : "text-red-400";
  return <span className={`text-xs font-medium capitalize ${color}`}>{value.replace("-", " ")}</span>;
}

export default function ProgressPage({ params }: { params: Promise<{ patientId: string }> }) {
  const { patientId } = use(params);
  const router = useRouter();
  const [sessions, setSessions] = useState<SessionRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [timeRange, setTimeRange] = useState<"week" | "month" | "all">("all");

  useEffect(() => {
    getSessions(patientId).then((rows) => {
      setSessions(rows as unknown as SessionRow[]);
      setLoading(false);
    });
  }, [patientId]);

  const filtered = sessions
    .filter((s) => {
      if (timeRange === "all") return true;
      const d = new Date(s.created_at);
      const now = new Date();
      const ms = timeRange === "week" ? 7 * 86400000 : 30 * 86400000;
      return now.getTime() - d.getTime() < ms;
    })
    .sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());

  // Build chart data - prefer computed_metrics, fall back to column values
  const chartData = filtered.map((s) => {
    const m = s.computed_metrics;
    const date = new Date(s.created_at).toLocaleDateString("en-US", { month: "short", day: "numeric" });
    return {
      date,
      gdi: m?.gaitDeviationIndex ?? 50,
      overallSym: Math.round((m?.overallSymmetry ?? s.knee_symmetry_index ?? 0) * 100),
      kneeSym: Math.round((m?.kneeSymmetryIndex ?? s.knee_symmetry_index ?? 0) * 100),
      hipSym: Math.round((m?.hipSymmetryIndex ?? s.hip_symmetry_index ?? 0) * 100),
      cadence: Math.round(m?.strideCadence ?? s.stride_cadence ?? 0),
      crouchSeverity: Math.round((m?.crouchSeverity ?? 0) * 100),
      toeWalkSeverity: Math.round((m?.toeWalkingSeverity ?? 0) * 100),
      trunkStability: Math.round((m?.trunkStability ?? 0) * 100),
      headStability: Math.round((m?.headStability ?? 0) * 100),
      armSwingSym: Math.round((m?.armSwingSymmetry ?? 0) * 100),
      stepAsymmetry: Math.round((m?.stepTimeAsymmetry ?? 0) * 100),
      supportPhaseAsym: Math.round((m?.supportPhaseAsymmetry ?? 0) * 100),
      stepLengthAsym: Math.round((m?.estimatedStepLengthAsymmetry ?? 0) * 100),
      forwardLean: Math.round(m?.avgForwardLean ?? 0),
      headTilt: Math.round(m?.avgHeadTilt ?? 0),
      dblSupport: Math.round(m?.doubleSupportPercent ?? 0),
      weightShift: Math.round((m?.weightShiftAsymmetry ?? 0) * 100),
      leftToeClearance: Math.round((m?.leftToeClearance ?? 0) * 1000) / 1000,
      rightToeClearance: Math.round((m?.rightToeClearance ?? 0) * 1000) / 1000,
      fatigueDrift: Math.round((m?.fatigueDriftScore ?? 0) * 100),
      pelvicObliquity: Math.round((m?.avgPelvicObliquity ?? 0) * 10) / 10,
      walkingConfidence: m?.walkingConfidence ?? "steady",
    };
  });

  // Before/after: compare first and last session in range
  const first = filtered.length > 0 ? filtered[0].computed_metrics : null;
  const last = filtered.length > 1 ? filtered[filtered.length - 1].computed_metrics : null;

  if (loading) {
    return <div className="min-h-screen bg-gray-950 flex items-center justify-center text-gray-400">Loading...</div>;
  }

  return (
    <div className="min-h-screen bg-gray-950 text-white pb-8">
      <div className="bg-gray-900 p-4 safe-top">
        <button onClick={() => router.push(`/patient/${patientId}`)} className="text-green-400 text-sm mb-2">
          &larr; Back
        </button>
        <h1 className="text-xl font-bold">Progress Over Time</h1>
        <p className="text-sm text-gray-400">{sessions.length} sessions</p>
      </div>

      <div className="p-4 space-y-4">
        {/* Time range */}
        <div className="flex gap-2">
          {(["week", "month", "all"] as const).map((range) => (
            <button
              key={range}
              onClick={() => setTimeRange(range)}
              className={`flex-1 py-2 rounded-lg text-sm ${
                timeRange === range ? "bg-green-600 text-white" : "bg-gray-800 text-gray-400"
              }`}
            >
              {range === "week" ? "7 Days" : range === "month" ? "30 Days" : "All Time"}
            </button>
          ))}
        </div>

        {filtered.length < 2 ? (
          <div className="bg-gray-800 rounded-xl p-6 text-center">
            <p className="text-gray-400">Need at least 2 sessions in this range to show trends.</p>
          </div>
        ) : (
          <>
            {/* Before / After summary */}
            {first && last && (
              <div className="bg-gray-800 rounded-xl p-4">
                <h2 className="text-sm font-medium text-gray-300 mb-2">
                  Before → After ({filtered.length} sessions)
                </h2>
                <p className="text-[10px] text-gray-500 mb-3">
                  {new Date(filtered[0].created_at).toLocaleDateString()} → {new Date(filtered[filtered.length - 1].created_at).toLocaleDateString()}
                </p>
                <DeltaBadge label="Gait Deviation Index" current={last.gaitDeviationIndex} previous={first.gaitDeviationIndex} unit="" higherIsBetter={true} />
                <DeltaBadge label="Overall Symmetry" current={last.overallSymmetry * 100} previous={first.overallSymmetry * 100} unit="%" higherIsBetter={true} />
                <DeltaBadge label="Knee Symmetry" current={last.kneeSymmetryIndex * 100} previous={first.kneeSymmetryIndex * 100} unit="%" higherIsBetter={true} />
                <DeltaBadge label="Trunk Stability" current={last.trunkStability * 100} previous={first.trunkStability * 100} unit="%" higherIsBetter={true} />
                <DeltaBadge label="Head Stability" current={last.headStability * 100} previous={first.headStability * 100} unit="%" higherIsBetter={true} />
                <DeltaBadge label="Crouch Severity" current={last.crouchSeverity * 100} previous={first.crouchSeverity * 100} unit="%" higherIsBetter={false} />
                <DeltaBadge label="Toe Walking" current={last.toeWalkingSeverity * 100} previous={first.toeWalkingSeverity * 100} unit="%" higherIsBetter={false} />
                <DeltaBadge label="Forward Lean" current={last.avgForwardLean} previous={first.avgForwardLean} unit="°" higherIsBetter={false} />
                <DeltaBadge label="Step Asymmetry" current={last.stepTimeAsymmetry * 100} previous={first.stepTimeAsymmetry * 100} unit="%" higherIsBetter={false} />
                <DeltaBadge label="Weight Shift Asymmetry" current={last.weightShiftAsymmetry * 100} previous={first.weightShiftAsymmetry * 100} unit="%" higherIsBetter={false} />
                <DeltaBadge label="Toe Drag Risk (clearance)" current={Math.min(last.leftToeClearance, last.rightToeClearance) * 1000} previous={Math.min(first.leftToeClearance, first.rightToeClearance) * 1000} unit="" higherIsBetter={true} />
                <DeltaBadge label="Fatigue Drift" current={last.fatigueDriftScore * 100} previous={first.fatigueDriftScore * 100} unit="%" higherIsBetter={false} />
                <DeltaBadge label="Pelvic Obliquity" current={last.avgPelvicObliquity} previous={first.avgPelvicObliquity} unit="°" higherIsBetter={false} />
                <div className="flex justify-between items-center py-1.5">
                  <span className="text-xs text-gray-400">Walking confidence estimate</span>
                  <ConfidenceBadge value={last.walkingConfidence} />
                </div>
              </div>
            )}

            {/* Trend charts */}
            <TrendChart
              data={chartData}
              title="Gait Deviation Index"
              lines={[{ key: "gdi", color: "#34D399", name: "GDI" }]}
              unit=""
              domain={[0, 100]}
            />

            <TrendChart
              data={chartData}
              title="Symmetry"
              lines={[
                { key: "overallSym", color: "#34D399", name: "Overall" },
                { key: "kneeSym", color: "#60A5FA", name: "Knee" },
                { key: "hipSym", color: "#F59E0B", name: "Hip" },
              ]}
              unit="%"
              domain={[0, 100]}
            />

            <TrendChart
              data={chartData}
              title="Cadence (steps/min)"
              lines={[{ key: "cadence", color: "#34D399", name: "Cadence" }]}
              unit=""
            />

            <TrendChart
              data={chartData}
              title="Gait Patterns (lower = better)"
              lines={[
                { key: "crouchSeverity", color: "#F87171", name: "Crouch" },
                { key: "toeWalkSeverity", color: "#FB923C", name: "Toe Walk" },
              ]}
              unit="%"
              domain={[0, 100]}
            />

            <TrendChart
              data={chartData}
              title="Stability"
              lines={[
                { key: "trunkStability", color: "#34D399", name: "Trunk" },
                { key: "headStability", color: "#60A5FA", name: "Head" },
              ]}
              unit="%"
              domain={[0, 100]}
            />

            <TrendChart
              data={chartData}
              title="Posture (lower = better)"
              lines={[
                { key: "forwardLean", color: "#F87171", name: "Forward Lean °" },
                { key: "headTilt", color: "#FB923C", name: "Head Tilt °" },
              ]}
              unit="°"
            />

            <TrendChart
              data={chartData}
              title="Arm Swing Symmetry"
              lines={[{ key: "armSwingSym", color: "#34D399", name: "Arm Swing" }]}
              unit="%"
              domain={[0, 100]}
            />

            <TrendChart
              data={chartData}
              title="Double Support Time"
              lines={[{ key: "dblSupport", color: "#60A5FA", name: "Double Support %" }]}
              unit="%"
            />

            <TrendChart
              data={chartData}
              title="Support & Loading (lower asymmetry = better)"
              lines={[
                { key: "weightShift", color: "#F59E0B", name: "Weight Shift %" },
                { key: "supportPhaseAsym", color: "#60A5FA", name: "Support Phase %" },
                { key: "stepLengthAsym", color: "#F87171", name: "Step Length %" },
              ]}
              unit="%"
              domain={[0, 100]}
            />

            <TrendChart
              data={chartData}
              title="Toe Clearance (higher = more ground clearance)"
              lines={[
                { key: "leftToeClearance", color: "#34D399", name: "Left Toe" },
                { key: "rightToeClearance", color: "#60A5FA", name: "Right Toe" },
              ]}
              unit=""
            />

            <TrendChart
              data={chartData}
              title="Fatigue & Pelvis (lower = steadier)"
              lines={[
                { key: "fatigueDrift", color: "#F87171", name: "Fatigue Drift %" },
                { key: "pelvicObliquity", color: "#F59E0B", name: "Pelvic Obliquity °" },
              ]}
              unit=""
            />

            <div className="bg-gray-800 rounded-xl p-4">
              <h3 className="text-sm font-medium text-gray-300 mb-3">Walking Confidence Trend</h3>
              <div className="space-y-2">
                {filtered.map((session) => (
                  <div key={session.id} className="flex items-center justify-between rounded-lg bg-gray-900/60 px-3 py-2">
                    <div>
                      <div className="text-sm text-white">{session.label}</div>
                      <div className="text-[11px] text-gray-500">
                        {new Date(session.created_at).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                      </div>
                      {session.session_context && (
                        <div className="mt-1 flex flex-wrap gap-1.5 text-[10px] text-gray-400">
                          <span className="rounded-full bg-gray-800 px-2 py-0.5">AFO: {session.session_context.afo.replace("_", " ")}</span>
                          <span className="rounded-full bg-gray-800 px-2 py-0.5">Footwear: {session.session_context.footwear.replace("_", " ")}</span>
                          <span className="rounded-full bg-gray-800 px-2 py-0.5">Support: {session.session_context.supportLevel.replace("_", " ")}</span>
                          <span className="rounded-full bg-gray-800 px-2 py-0.5">Env: {session.session_context.environment}</span>
                          <span className="rounded-full bg-gray-800 px-2 py-0.5">Pain: {session.session_context.painLevel ?? "?"}</span>
                          <span className="rounded-full bg-gray-800 px-2 py-0.5">Fatigue: {session.session_context.fatigueToday}</span>
                        </div>
                      )}
                    </div>
                    <ConfidenceBadge value={session.computed_metrics?.walkingConfidence ?? "steady"} />
                  </div>
                ))}
              </div>
              <p className="mt-3 text-xs text-gray-500">
                Confidence is a video-based estimate from balance, toe drag, support timing, and fatigue drift. It is useful for tracking trend, not for assigning mobility level by itself.
              </p>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
