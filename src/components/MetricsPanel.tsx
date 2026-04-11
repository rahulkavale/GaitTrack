"use client";

import type { FrameMetrics } from "@/lib/types";

interface MetricsPanelProps {
  metrics: FrameMetrics | null;
  isRecording: boolean;
  elapsedSeconds: number;
}

export function MetricsPanel({ metrics, isRecording, elapsedSeconds }: MetricsPanelProps) {
  const formatAngle = (v: number) => `${Math.round(v)}°`;
  const formatSymmetry = (v: number) => `${Math.round(v * 100)}%`;
  const formatTime = (s: number) => {
    const mins = Math.floor(s / 60);
    const secs = Math.floor(s % 60);
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  };

  return (
    <div className="absolute top-0 left-0 right-0 z-10 bg-black/60 text-white p-3 safe-top">
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          {isRecording && (
            <span className="w-3 h-3 bg-red-500 rounded-full animate-pulse" />
          )}
          <span className="text-sm font-mono">{formatTime(elapsedSeconds)}</span>
        </div>
        {metrics && (
          <span className="text-xs text-green-400">Pose detected</span>
        )}
        {!metrics && isRecording && (
          <span className="text-xs text-yellow-400">No pose detected</span>
        )}
      </div>

      {metrics && (
        <div className="grid grid-cols-3 gap-2 text-xs">
          <div>
            <div className="text-gray-400">L Knee</div>
            <div className="font-mono">{formatAngle(metrics.leftKneeAngle)}</div>
          </div>
          <div>
            <div className="text-gray-400">R Knee</div>
            <div className="font-mono">{formatAngle(metrics.rightKneeAngle)}</div>
          </div>
          <div>
            <div className="text-gray-400">Knee Sym</div>
            <div className="font-mono">{formatSymmetry(metrics.kneeSymmetry)}</div>
          </div>
          <div>
            <div className="text-gray-400">L Hip</div>
            <div className="font-mono">{formatAngle(metrics.leftHipAngle)}</div>
          </div>
          <div>
            <div className="text-gray-400">R Hip</div>
            <div className="font-mono">{formatAngle(metrics.rightHipAngle)}</div>
          </div>
          <div>
            <div className="text-gray-400">Hip Sym</div>
            <div className="font-mono">{formatSymmetry(metrics.hipSymmetry)}</div>
          </div>
        </div>
      )}
    </div>
  );
}
