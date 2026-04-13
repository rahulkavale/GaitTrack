"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  CartesianGrid,
  Line,
  LineChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { FrameMetrics, PoseFrame } from "@/lib/types";
import type { MetricPreferences, TimelineMetricId } from "@/lib/metric-settings";
import { getMetricDefinition } from "@/lib/metric-settings";
import { captureEvent } from "@/lib/analytics/posthog";
import { getVideo } from "@/lib/videoStore";
import {
  findFrameIndexForTime,
  getMetricReplayConfig,
  getMetricSeverity,
  getMetricValue,
  getSeverityColor,
  METRIC_REPLAY_CONFIGS,
} from "@/lib/metric-replay";

interface MetricReplayProps {
  recordingId: string;
  frameData: PoseFrame[];
  frameMetrics: FrameMetrics[];
  metricPreferences?: MetricPreferences | null;
  title?: string;
  initialMetricId?: TimelineMetricId;
}

function formatMetricValue(value: number, unit: string) {
  if (unit === "") return `${Math.round(value * 100)}%`;
  if (unit === "%") return `${Math.round(value)}%`;
  return `${Math.round(value * 10) / 10}${unit}`;
}

function describeHighlight(metricId: TimelineMetricId) {
  switch (metricId) {
    case "left_knee_angle":
      return "The overlay highlights the left thigh and lower leg, centered on the knee joint.";
    case "right_knee_angle":
      return "The overlay highlights the right thigh and lower leg, centered on the knee joint.";
    case "left_hip_angle":
      return "The overlay highlights the left side of the trunk and upper leg, centered on the hip joint.";
    case "right_hip_angle":
      return "The overlay highlights the right side of the trunk and upper leg, centered on the hip joint.";
    case "left_ankle_angle":
      return "The overlay highlights the lower leg and foot on the left side, centered on the ankle.";
    case "left_arm_swing":
      return "The overlay highlights the left upper arm and forearm to show how the left arm is swinging through the step cycle.";
    case "right_arm_swing":
      return "The overlay highlights the right upper arm and forearm to show how the right arm is swinging through the step cycle.";
    case "weight_shift":
      return "The overlay highlights both legs and the pelvis so you can see which side appears to be taking more support at each moment.";
    case "fall_risk":
      return "The overlay highlights the trunk, pelvis, and head so you can see where directional balance loss is building during the replay.";
    case "trunk_forward_lean":
      return "The overlay highlights the trunk lines from shoulders to hips to show forward body posture.";
    case "trunk_lateral_lean":
      return "The overlay highlights shoulder and hip alignment to show side-to-side body lean.";
    case "head_tilt":
      return "The overlay highlights the head line across the ears and nose to show tilt.";
    case "knee_symmetry":
      return "The overlay highlights both legs together to compare left and right knee behavior.";
  }
}

function describeSeverity(metricLabel: string, severity: "good" | "watch" | "concern", unit: string) {
  switch (severity) {
    case "good":
      return `${metricLabel} is inside the current expected range, so the overlay stays green.`;
    case "watch":
      return `${metricLabel} is slightly outside the expected range, so the overlay turns yellow as a watch signal.`;
    case "concern":
      return `${metricLabel} is clearly outside the expected range, so the overlay turns red to draw attention.`;
  }
}

export function MetricReplay({
  recordingId,
  frameData,
  frameMetrics,
  metricPreferences,
  title,
  initialMetricId = "left_knee_angle",
}: MetricReplayProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const overlayCanvasRef = useRef<HTMLCanvasElement>(null);
  const [url, setUrl] = useState<string | null>(null);
  const [missing, setMissing] = useState(false);
  const [selectedMetricId, setSelectedMetricId] = useState<TimelineMetricId>(initialMetricId);
  const [currentFrameIndex, setCurrentFrameIndex] = useState(0);
  const openedMetricRef = useRef<string | null>(null);

  useEffect(() => {
    setSelectedMetricId(initialMetricId);
  }, [initialMetricId]);

  useEffect(() => {
    let disposed = false;
    let objectUrl: string | null = null;
    setUrl(null);
    setMissing(false);

    getVideo(recordingId)
      .then((record) => {
        if (!record || record.blob.size === 0) {
          if (!disposed) setMissing(true);
          return;
        }
        objectUrl = URL.createObjectURL(record.blob);
        if (!disposed) setUrl(objectUrl);
      })
      .catch(() => {
        if (!disposed) setMissing(true);
      });

    return () => {
      disposed = true;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [recordingId]);

  const visibleMetrics = useMemo(
    () =>
      METRIC_REPLAY_CONFIGS.filter(
        (config) => metricPreferences?.timelines[config.id]?.enabled ?? true
      ),
    [metricPreferences]
  );

  useEffect(() => {
    if (!visibleMetrics.some((metric) => metric.id === selectedMetricId) && visibleMetrics.length > 0) {
      setSelectedMetricId(visibleMetrics[0].id);
    }
  }, [visibleMetrics, selectedMetricId]);

  const selectedMetric = getMetricReplayConfig(selectedMetricId);
  const selectedMetricDefinition = getMetricDefinition(selectedMetricId);
  const currentMetric = frameMetrics[currentFrameIndex];
  const computedValue = currentMetric ? getMetricValue(selectedMetricId, currentMetric) : 0;
  const metricValue = selectedMetric.absoluteValue ? Math.abs(computedValue) : computedValue;
  const severity = getMetricSeverity(metricValue, selectedMetric);
  const severityColor = getSeverityColor(severity);

  const chartData = useMemo(() => {
    const maxPoints = 160;
    const step = Math.max(1, Math.floor(frameMetrics.length / maxPoints));
    return frameMetrics.filter((_, index) => index % step === 0).map((metric) => {
      const value = getMetricValue(selectedMetric.id, metric);
      return {
        time: Math.round(metric.timestamp / 100) / 10,
        value: selectedMetric.absoluteValue ? Math.abs(value) : value,
      };
    });
  }, [frameMetrics, selectedMetric]);

  const dynamicExplanation = useMemo(() => {
    if (!currentMetric) return null;
    if (selectedMetricId === "weight_shift") {
      if (metricValue > 12) return "At this moment, more support appears to shift onto the right leg, so the trace moves right of center and the overlay escalates in color.";
      if (metricValue < -12) return "At this moment, more support appears to shift onto the left leg, so the trace moves left of center and the overlay escalates in color.";
      return "At this moment, support looks fairly centered between both legs, so the replay stays in the expected band.";
    }
    if (selectedMetricId === "fall_risk") {
      const lateral = currentMetric.trunkLateralLean;
      if (Math.abs(lateral) >= 5 && Math.abs(lateral) >= currentMetric.headForwardAngle / 2) {
        return `The strongest current balance signal is a ${lateral > 0 ? "right" : "left"}ward lean of the trunk, which raises the fall-tendency trace.`;
      }
      if (currentMetric.trunkForwardLean >= 10 || currentMetric.headForwardAngle >= 12) {
        return "The strongest current balance signal is forward lean, so the fall-tendency trace rises as the body pitches ahead of neutral.";
      }
      return "Current posture signals stay close to neutral, so the fall-tendency trace remains in the lower band.";
    }
    return null;
  }, [currentMetric, metricValue, selectedMetricId]);

  const abnormalWindow = useMemo(() => {
    if (chartData.length === 0 || selectedMetric.normalMin == null || selectedMetric.normalMax == null) {
      return null;
    }

    let bestStart = 0;
    let bestEnd = 0;
    let bestScore = 0;
    let runStart = -1;
    let runScore = 0;

    const distanceFromRange = (value: number) => {
      if (value < selectedMetric.normalMin!) return selectedMetric.normalMin! - value;
      if (value > selectedMetric.normalMax!) return value - selectedMetric.normalMax!;
      return 0;
    };

    chartData.forEach((point, index) => {
      const distance = distanceFromRange(point.value);
      if (distance > 0) {
        if (runStart === -1) {
          runStart = index;
          runScore = 0;
        }
        runScore += distance;
        if (runScore >= bestScore) {
          bestScore = runScore;
          bestStart = runStart;
          bestEnd = index;
        }
      } else {
        runStart = -1;
        runScore = 0;
      }
    });

    if (bestScore === 0) return null;

    return {
      start: chartData[bestStart]?.time ?? 0,
      end: chartData[bestEnd]?.time ?? chartData[bestStart]?.time ?? 0,
    };
  }, [chartData, selectedMetric.normalMax, selectedMetric.normalMin]);

  useEffect(() => {
    if (!url) return;
    const eventName = openedMetricRef.current ? "metric_focus_metric_changed" : "metric_focus_opened";
    captureEvent(eventName, {
      recording_id: recordingId,
      metric_id: selectedMetricId,
      has_local_video: true,
    });
    openedMetricRef.current = selectedMetricId;
  }, [recordingId, selectedMetricId, url]);

  useEffect(() => {
    const video = videoRef.current;
    const canvas = overlayCanvasRef.current;
    if (!video || !canvas || !url) return;

    let rafId = 0;
    const draw = () => {
      const currentTimeMs = video.currentTime * 1000;
      const frameIndex = findFrameIndexForTime(frameData, currentTimeMs);
      setCurrentFrameIndex(frameIndex);

      const frame = frameData[frameIndex];
      const ctx = canvas.getContext("2d");
      if (!ctx || !frame || video.videoWidth === 0 || video.videoHeight === 0) {
        rafId = requestAnimationFrame(draw);
        return;
      }

      canvas.width = video.clientWidth;
      canvas.height = video.clientHeight;
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      const width = canvas.width;
      const height = canvas.height;

      const renderX = (x: number) => x * width;
      const renderY = (y: number) => y * height;

      ctx.lineCap = "round";
      ctx.lineWidth = 5;
      ctx.strokeStyle = severityColor;
      ctx.shadowColor = severityColor;
      ctx.shadowBlur = 10;

      for (const [startIndex, endIndex] of selectedMetric.segments) {
        const start = frame.landmarks[startIndex];
        const end = frame.landmarks[endIndex];
        if (!start || !end || start.visibility < 0.35 || end.visibility < 0.35) continue;
        ctx.beginPath();
        ctx.moveTo(renderX(start.x), renderY(start.y));
        ctx.lineTo(renderX(end.x), renderY(end.y));
        ctx.stroke();
      }

      ctx.shadowBlur = 0;
      ctx.fillStyle = severityColor;
      for (const jointIndex of selectedMetric.joints) {
        const point = frame.landmarks[jointIndex];
        if (!point || point.visibility < 0.35) continue;
        ctx.beginPath();
        ctx.arc(renderX(point.x), renderY(point.y), 7, 0, Math.PI * 2);
        ctx.fill();
      }

      ctx.fillStyle = "rgba(3, 7, 18, 0.72)";
      ctx.fillRect(12, 12, 220, 54);
      ctx.fillStyle = "#ffffff";
      ctx.font = "600 14px system-ui";
      ctx.fillText(selectedMetric.label, 24, 32);
      ctx.fillStyle = severityColor;
      ctx.font = "700 18px system-ui";
      ctx.fillText(formatMetricValue(metricValue, selectedMetric.unit), 24, 54);

      rafId = requestAnimationFrame(draw);
    };

    rafId = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(rafId);
  }, [frameData, frameMetrics, metricValue, recordingId, selectedMetric, severityColor, url]);

  if (frameData.length === 0 || frameMetrics.length === 0) {
    return (
      <div className="bg-gray-800 rounded-xl p-4 text-sm text-gray-400">
        Metric-focused replay is not available because frame-level data was not saved for this recording.
      </div>
    );
  }

  if (missing) {
    return (
      <div className="bg-gray-800 rounded-xl p-4 text-sm text-gray-400">
        Local replay video is not available on this device. Metric overlays only work on the device that saved the replay.
      </div>
    );
  }

  if (!url) {
    return (
      <div className="bg-gray-800 rounded-xl p-4 text-sm text-gray-400">Loading metric replay...</div>
    );
  }

  return (
    <div className="bg-gray-900 rounded-xl p-4 space-y-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="text-sm font-medium text-white">{title ?? "Metric Focus Replay"}</h3>
          <p className="text-xs text-gray-400 mt-1">
            Video stays local on this device. The overlay is drawn in-browser from saved pose frames and metric values.
          </p>
        </div>
        <div
          className="rounded-full px-3 py-1 text-xs font-medium"
          style={{
            backgroundColor: `${severityColor}22`,
            color: severityColor,
          }}
        >
          {severity === "good" ? "Within range" : severity === "watch" ? "Watch" : "Outside range"}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2 md:grid-cols-3">
        {visibleMetrics.map((metric) => (
          <button
            key={metric.id}
            onClick={() => setSelectedMetricId(metric.id)}
            className={`rounded-lg px-3 py-2 text-left text-xs ${
              selectedMetricId === metric.id
                ? "bg-green-600 text-white"
                : "bg-gray-800 text-gray-300"
            }`}
          >
            {metric.label}
          </button>
        ))}
      </div>

      <div className="relative overflow-hidden rounded-xl bg-black">
        <video
          ref={videoRef}
          src={url}
          controls
          playsInline
          preload="metadata"
          className="w-full"
        />
        <canvas
          ref={overlayCanvasRef}
          className="pointer-events-none absolute inset-0 h-full w-full"
        />
      </div>

      <div className="grid gap-3 md:grid-cols-[220px_minmax(0,1fr)]">
        <div className="rounded-xl bg-gray-800 p-3">
          <div className="text-[11px] uppercase tracking-[0.18em] text-gray-500">Selected Metric</div>
          <div className="mt-2 text-sm font-medium text-white">{selectedMetric.label}</div>
          <div className="mt-3 text-3xl font-mono font-bold" style={{ color: severityColor }}>
            {formatMetricValue(metricValue, selectedMetric.unit)}
          </div>
          <div className="mt-2 text-xs text-gray-400">
            Focus area is highlighted directly on the replay using green, yellow, and red severity bands.
          </div>
        </div>

        <div className="rounded-xl bg-gray-800 p-3">
          <div className="mb-2 text-xs text-gray-400">Metric trace</div>
          <ResponsiveContainer width="100%" height={180}>
            <LineChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
              <XAxis dataKey="time" tick={{ fontSize: 10, fill: "#6B7280" }} />
              <YAxis tick={{ fontSize: 10, fill: "#6B7280" }} />
              <Tooltip
                contentStyle={{
                  backgroundColor: "#111827",
                  border: "none",
                  borderRadius: 8,
                  fontSize: 11,
                }}
                formatter={(value) => [formatMetricValue(Number(value), selectedMetric.unit), selectedMetric.label]}
              />
              {selectedMetric.normalMin != null && (
                <ReferenceLine y={selectedMetric.normalMin} stroke="#4ade80" strokeDasharray="4 4" strokeOpacity={0.5} />
              )}
              {selectedMetric.normalMax != null && (
                <ReferenceLine y={selectedMetric.normalMax} stroke="#4ade80" strokeDasharray="4 4" strokeOpacity={0.5} />
              )}
              <ReferenceLine
                x={chartData[Math.min(chartData.length - 1, Math.floor((currentFrameIndex / Math.max(frameMetrics.length - 1, 1)) * Math.max(chartData.length - 1, 0)))]?.time}
                stroke={severityColor}
              />
              <Line
                type="monotone"
                dataKey="value"
                stroke={severityColor}
                strokeWidth={2}
                dot={false}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="grid gap-3 md:grid-cols-3">
        <div className="rounded-xl bg-gray-800 p-3">
          <div className="text-[11px] uppercase tracking-[0.18em] text-gray-500">What Is Highlighted</div>
          <p className="mt-2 text-xs text-gray-300">
            {describeHighlight(selectedMetricId)}
          </p>
        </div>
        <div className="rounded-xl bg-gray-800 p-3">
          <div className="text-[11px] uppercase tracking-[0.18em] text-gray-500">Why The Color Changed</div>
          <p className="mt-2 text-xs text-gray-300">
            {dynamicExplanation ?? describeSeverity(selectedMetric.label, severity, selectedMetric.unit)}
          </p>
        </div>
        <div className="rounded-xl bg-gray-800 p-3">
          <div className="text-[11px] uppercase tracking-[0.18em] text-gray-500">Most Abnormal Window</div>
          <p className="mt-2 text-xs text-gray-300">
            {abnormalWindow
              ? `${abnormalWindow.start.toFixed(1)}s to ${abnormalWindow.end.toFixed(1)}s shows the largest sustained deviation from the current expected range.`
              : "No sustained out-of-range window was detected for this metric in the current replay."}
          </p>
        </div>
      </div>

      {selectedMetricDefinition && (
        <div className="rounded-xl bg-gray-800 p-3">
          <div className="text-[11px] uppercase tracking-[0.18em] text-gray-500">Metric Logic</div>
          <p className="mt-2 text-xs text-gray-300">{selectedMetricDefinition.detailDescription}</p>
        </div>
      )}
    </div>
  );
}
