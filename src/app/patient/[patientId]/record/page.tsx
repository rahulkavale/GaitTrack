"use client";

import { useRef, useState, useCallback, useEffect, use } from "react";
import { useRouter } from "next/navigation";
import { drawStickFigure } from "@/components/StickFigure";
import { MetricsPanel } from "@/components/MetricsPanel";
import { SetupGuide } from "@/components/SetupGuide";
import { computeFrameMetrics, computeSessionMetrics } from "@/lib/gait-metrics";
import {
  createSession,
  saveRecording,
  consolidateSessionMetrics,
} from "@/lib/db";
import type { PoseFrame, FrameMetrics } from "@/lib/types";
import type { PoseLandmarker } from "@mediapipe/tasks-vision";

type ViewAngle = "side-left" | "side-right" | "front" | "back";

const VIEW_LABELS: Record<ViewAngle, string> = {
  "side-left": "Left Side",
  "side-right": "Right Side",
  front: "Front",
  back: "Back",
};

export default function RecordPage({
  params,
}: {
  params: Promise<{ patientId: string }>;
}) {
  const { patientId } = use(params);
  const router = useRouter();

  // Session state
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [joinCode, setJoinCode] = useState<string>("");
  const [viewAngle] = useState<ViewAngle>("front"); // default front for new sessions
  const [recordingCount, setRecordingCount] = useState(0);
  const [showGuide, setShowGuide] = useState(true);
  const [showDone, setShowDone] = useState(false);

  // Camera / recording state
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const landmarkerRef = useRef<PoseLandmarker | null>(null);
  const animationRef = useRef<number>(0);
  const streamRef = useRef<MediaStream | null>(null);
  const startTimeRef = useRef<number>(0);
  const framesRef = useRef<PoseFrame[]>([]);
  const frameMetricsRef = useRef<FrameMetrics[]>([]);

  const [isLoading, setIsLoading] = useState(false);
  const [loadingStatus, setLoadingStatus] = useState("");
  const [isRecording, setIsRecording] = useState(false);
  const [currentMetrics, setCurrentMetrics] = useState<FrameMetrics | null>(null);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [isSaving, setIsSaving] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);

  const metricsUpdateCounter = useRef(0);

  // Create session immediately on mount
  useEffect(() => {
    async function init() {
      try {
        const label = `Session - ${new Date().toLocaleDateString("en-US", {
          month: "short",
          day: "numeric",
          hour: "numeric",
          minute: "2-digit",
        })}`;
        const session = await createSession(patientId, label);
        setSessionId(session.id);
        setJoinCode(session.join_code);
      } catch (err) {
        console.error("Failed to create session:", err);
      }
    }
    init();
  }, [patientId]);

  const startCamera = useCallback(async () => {
    setIsLoading(true);
    setCameraError(null);
    try {
      setLoadingStatus("Requesting camera access...");
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "environment", width: { ideal: 640 }, height: { ideal: 480 } },
        audio: false,
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }
      setLoadingStatus("Loading pose detection model...");
      const { createPoseLandmarker } = await import("@/lib/mediapipe");
      landmarkerRef.current = await createPoseLandmarker();
      setIsLoading(false);
    } catch (err) {
      setIsLoading(false);
      if (err instanceof DOMException && err.name === "NotAllowedError") {
        setCameraError("Camera access denied. Please allow camera access and reload.");
      } else {
        setCameraError(`Failed to start: ${err instanceof Error ? err.message : "Unknown error"}`);
      }
    }
  }, []);

  const runDetection = useCallback(() => {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    const landmarker = landmarkerRef.current;
    if (!video || !canvas || !landmarker || video.readyState < 2) {
      animationRef.current = requestAnimationFrame(runDetection);
      return;
    }
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const now = performance.now();
    const result = landmarker.detectForVideo(video, now);
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    if (result.landmarks && result.landmarks.length > 0) {
      const landmarks = result.landmarks[0];
      const worldLandmarks = result.worldLandmarks?.[0] ?? landmarks;
      drawStickFigure(ctx, landmarks, canvas.width, canvas.height);
      if (isRecording) {
        const timestamp = now - startTimeRef.current;
        const frame: PoseFrame = {
          timestamp,
          landmarks: landmarks.map(l => ({ x: l.x, y: l.y, z: l.z, visibility: l.visibility ?? 0 })),
          worldLandmarks: worldLandmarks.map(l => ({ x: l.x, y: l.y, z: l.z, visibility: l.visibility ?? 0 })),
        };
        framesRef.current.push(frame);
        const metrics = computeFrameMetrics(frame.worldLandmarks, timestamp);
        frameMetricsRef.current.push(metrics);
        metricsUpdateCounter.current++;
        if (metricsUpdateCounter.current % 4 === 0) {
          setCurrentMetrics(metrics);
          setElapsedSeconds((now - startTimeRef.current) / 1000);
        }
      }
    }
    animationRef.current = requestAnimationFrame(runDetection);
  }, [isRecording]);

  const startRecording = useCallback(() => {
    framesRef.current = [];
    frameMetricsRef.current = [];
    startTimeRef.current = performance.now();
    setIsRecording(true);
    setCurrentMetrics(null);
    setElapsedSeconds(0);
  }, []);

  const stopRecording = useCallback(async () => {
    setIsRecording(false);
    setIsSaving(true);
    try {
      const durationMs = performance.now() - startTimeRef.current;
      const frames = framesRef.current;
      const fMetrics = frameMetricsRef.current;
      const metrics = computeSessionMetrics(fMetrics, frames, durationMs);
      await saveRecording(sessionId!, viewAngle, Math.round(durationMs), metrics, frames, fMetrics);
      await consolidateSessionMetrics(sessionId!);
      setRecordingCount(c => c + 1);
      setShowDone(true);
      cancelAnimationFrame(animationRef.current);
      streamRef.current?.getTracks().forEach(t => t.stop());
    } catch (err) {
      console.error("Failed to save:", err);
      setCameraError(`Failed to save: ${err instanceof Error ? err.message : JSON.stringify(err)}`);
    } finally {
      setIsSaving(false);
    }
  }, [sessionId, viewAngle]);

  // Effects
  useEffect(() => {
    if (!showGuide && !isLoading && !cameraError && !showDone && landmarkerRef.current) {
      animationRef.current = requestAnimationFrame(runDetection);
      return () => cancelAnimationFrame(animationRef.current);
    }
  }, [showGuide, isLoading, cameraError, showDone, runDetection]);

  useEffect(() => {
    return () => {
      cancelAnimationFrame(animationRef.current);
      streamRef.current?.getTracks().forEach(t => t.stop());
    };
  }, []);

  useEffect(() => {
    if (!isRecording) return;
    let wakeLock: WakeLockSentinel | null = null;
    if ("wakeLock" in navigator) {
      navigator.wakeLock.request("screen").then(wl => { wakeLock = wl; }).catch(() => {});
    }
    return () => { wakeLock?.release(); };
  }, [isRecording]);

  // ---- Setup guide ----
  if (showGuide) {
    return (
      <SetupGuide
        onDismiss={() => {
          setShowGuide(false);
          startCamera();
        }}
      />
    );
  }

  // ---- Done screen ----
  if (showDone) {
    return (
      <div className="min-h-screen bg-gray-950 text-white flex items-center justify-center p-6">
        <div className="max-w-sm w-full text-center">
          <h1 className="text-xl font-bold mb-2">Recording Saved!</h1>
          <p className="text-sm text-gray-400 mb-6">
            {recordingCount} recording{recordingCount !== 1 ? "s" : ""} in this session.
          </p>

          {/* Join code for second device */}
          {joinCode && (
            <div className="bg-gray-800 rounded-xl p-4 mb-6">
              <p className="text-xs text-gray-400 mb-1">Want another angle? Share this code:</p>
              <p className="text-3xl font-mono font-bold tracking-[0.3em] text-green-400">{joinCode}</p>
              <p className="text-xs text-gray-500 mt-2">
                Other person: sign in, tap &quot;Join Session&quot;, enter this code
              </p>
            </div>
          )}

          <button
            onClick={() => router.push(`/review/${sessionId}`)}
            className="w-full bg-green-600 text-white py-3 rounded-xl font-medium active:bg-green-700 mb-3"
          >
            View Results
          </button>

          <button
            onClick={() => router.push(`/patient/${patientId}`)}
            className="w-full bg-gray-800 text-gray-400 py-3 rounded-xl text-sm active:bg-gray-700"
          >
            Back to sessions
          </button>
        </div>
      </div>
    );
  }

  // ---- Recording screen ----
  return (
    <div className="fixed inset-0 bg-black flex flex-col">
      <div className="relative flex-1">
        <video ref={videoRef} playsInline muted className="absolute inset-0 w-full h-full object-cover opacity-0" />
        <canvas ref={canvasRef} className="absolute inset-0 w-full h-full object-contain" />
        <MetricsPanel metrics={currentMetrics} isRecording={isRecording} elapsedSeconds={elapsedSeconds} />

        {/* Join code shown during recording so second person can join */}
        {joinCode && (
          <div className="absolute bottom-4 right-4 bg-black/70 text-green-400 text-xs px-3 py-2 rounded-lg font-mono">
            Code: {joinCode}
          </div>
        )}
        <div className="absolute bottom-4 left-4 bg-black/70 text-white text-xs px-3 py-1.5 rounded-lg">
          {VIEW_LABELS[viewAngle]}
        </div>
      </div>

      <div className="bg-black/80 p-4 pb-8 flex items-center justify-center gap-6 safe-bottom">
        <button
          onClick={() => {
            cancelAnimationFrame(animationRef.current);
            streamRef.current?.getTracks().forEach(t => t.stop());
            router.push(`/patient/${patientId}`);
          }}
          className="w-12 h-12 rounded-full bg-gray-700 flex items-center justify-center text-white text-sm active:bg-gray-600"
        >
          Back
        </button>

        {isLoading ? (
          <div className="flex flex-col items-center gap-2">
            <div className="w-16 h-16 rounded-full border-4 border-gray-600 border-t-green-500 animate-spin" />
            <span className="text-xs text-gray-400">{loadingStatus}</span>
          </div>
        ) : isSaving ? (
          <div className="flex flex-col items-center gap-2">
            <div className="w-16 h-16 rounded-full border-4 border-gray-600 border-t-blue-500 animate-spin" />
            <span className="text-xs text-gray-400">Saving...</span>
          </div>
        ) : isRecording ? (
          <button
            onClick={stopRecording}
            className="w-16 h-16 rounded-2xl bg-red-600 flex items-center justify-center active:bg-red-700"
          >
            <div className="w-6 h-6 bg-white rounded-sm" />
          </button>
        ) : (
          <button
            onClick={startRecording}
            className="w-16 h-16 rounded-full bg-red-600 flex items-center justify-center active:bg-red-700"
          >
            <div className="w-6 h-6 bg-white rounded-full" />
          </button>
        )}

        <div className="w-12 h-12" />
      </div>

      {cameraError && (
        <div className="absolute inset-0 bg-black/90 flex items-center justify-center p-6">
          <div className="bg-gray-900 rounded-xl p-6 text-center max-w-sm">
            <p className="text-red-400 mb-4">{cameraError}</p>
            <button
              onClick={() => { setCameraError(null); router.push(`/patient/${patientId}`); }}
              className="bg-gray-700 text-white px-6 py-2 rounded-lg active:bg-gray-600"
            >
              Go back
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
