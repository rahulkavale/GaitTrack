"use client";

import { useRef, useState, useCallback, useEffect } from "react";
import { useRouter } from "next/navigation";
import { drawStickFigure } from "@/components/StickFigure";
import { MetricsPanel } from "@/components/MetricsPanel";
import { RecordingVideo } from "@/components/RecordingVideo";
import { MetricReplay } from "@/components/MetricReplay";
import { SetupGuide } from "@/components/SetupGuide";
import { computeFrameMetrics, computeSessionMetrics } from "@/lib/gait-metrics";
import { GaitReport } from "@/components/GaitReport";
import { putVideo } from "@/lib/videoStore";
import type { PoseFrame, FrameMetrics, SessionMetrics } from "@/lib/types";
import type { TimelineMetricId } from "@/lib/metric-settings";
import type { PoseLandmarker } from "@mediapipe/tasks-vision";

export default function TryRecordPage() {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const landmarkerRef = useRef<PoseLandmarker | null>(null);
  const animationRef = useRef<number>(0);
  const streamRef = useRef<MediaStream | null>(null);
  const startTimeRef = useRef<number>(0);
  const framesRef = useRef<PoseFrame[]>([]);
  const frameMetricsRef = useRef<FrameMetrics[]>([]);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const recordedChunksRef = useRef<Blob[]>([]);

  const [showGuide, setShowGuide] = useState(true);
  const [isLoading, setIsLoading] = useState(false);
  const [loadingStatus, setLoadingStatus] = useState("");
  const [isRecording, setIsRecording] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [currentMetrics, setCurrentMetrics] = useState<FrameMetrics | null>(null);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [sessionResult, setSessionResult] = useState<SessionMetrics | null>(null);
  const [recordedMimeType, setRecordedMimeType] = useState<string>("video/webm");
  const [recordingId, setRecordingId] = useState<string | null>(null);
  const [activeSection, setActiveSection] = useState<"analysis" | "replay">("analysis");
  const [replayMode, setReplayMode] = useState<"standard" | "metric">("standard");
  const [sourceMode, setSourceMode] = useState<"camera" | "upload">("camera");
  const [uploadedVideoUrl, setUploadedVideoUrl] = useState<string | null>(null);
  const [selectedVideoName, setSelectedVideoName] = useState<string | null>(null);
  const [sourceDurationSeconds, setSourceDurationSeconds] = useState<number | null>(null);
  const [focusedMetricId, setFocusedMetricId] = useState<TimelineMetricId | null>(null);

  const metricsUpdateCounter = useRef(0);

  const waitForRecordingSurface = useCallback(async () => {
    await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
  }, []);

  const ensureLandmarker = useCallback(async () => {
    if (landmarkerRef.current) return landmarkerRef.current;
    setLoadingStatus("Loading pose detection model...");
    const { createPoseLandmarker } = await import("@/lib/mediapipe");
    landmarkerRef.current = await createPoseLandmarker();
    return landmarkerRef.current;
  }, []);

  const startCamera = useCallback(async () => {
    setIsLoading(true);
    setCameraError(null);
    setSourceMode("camera");
    setSourceDurationSeconds(null);

    try {
      setLoadingStatus("Requesting camera access...");
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: "environment",
          width: { ideal: 640 },
          height: { ideal: 480 },
        },
        audio: false,
      });
      streamRef.current = stream;

      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }

      await ensureLandmarker();

      setIsLoading(false);
      setLoadingStatus("");
    } catch (err) {
      setIsLoading(false);
      if (err instanceof DOMException && err.name === "NotAllowedError") {
        setCameraError(
          "Camera access denied. Please allow camera access in your browser settings and reload."
        );
      } else {
        setCameraError(
          `Failed to start: ${err instanceof Error ? err.message : "Unknown error"}`
        );
      }
    }
  }, [ensureLandmarker]);

  const analyzeUploadedVideo = useCallback(async (file: File) => {
    setIsLoading(true);
    setCameraError(null);
    setSourceMode("upload");
    setSelectedVideoName(file.name);
    setRecordingId(null);
    setSourceDurationSeconds(null);

    try {
      setShowGuide(false);
      await waitForRecordingSurface();
      await ensureLandmarker();

      const objectUrl = URL.createObjectURL(file);
      setUploadedVideoUrl((current) => {
        if (current) URL.revokeObjectURL(current);
        return objectUrl;
      });

      framesRef.current = [];
      frameMetricsRef.current = [];
      metricsUpdateCounter.current = 0;
      setCurrentMetrics(null);
      setElapsedSeconds(0);

      const video = videoRef.current;
      if (!video) throw new Error("Video element unavailable");

      streamRef.current?.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
      video.srcObject = null;
      video.src = objectUrl;
      video.currentTime = 0;
      video.muted = true;
      video.playsInline = true;

      await new Promise<void>((resolve, reject) => {
        video.onloadedmetadata = () => resolve();
        video.onerror = () => reject(new Error("Failed to load the selected video"));
      });
      setSourceDurationSeconds(Number.isFinite(video.duration) ? video.duration : null);

      startTimeRef.current = 0;
      setIsLoading(false);
      setLoadingStatus("");
      setShowGuide(false);
      setIsRecording(true);
      await video.play();
    } catch (err) {
      setIsLoading(false);
      setCameraError(err instanceof Error ? err.message : "Failed to analyze video");
    }
  }, [ensureLandmarker, waitForRecordingSurface]);

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
    const timestamp = sourceMode === "upload" ? video.currentTime * 1000 : now - startTimeRef.current;
    const result = landmarker.detectForVideo(video, now);

    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

    if (result.landmarks && result.landmarks.length > 0) {
      const landmarks = result.landmarks[0];
      const worldLandmarks = result.worldLandmarks?.[0] ?? landmarks;

      drawStickFigure(ctx, landmarks, canvas.width, canvas.height);

      if (isRecording) {
        const frame: PoseFrame = {
          timestamp,
          landmarks: landmarks.map((l) => ({
            x: l.x,
            y: l.y,
            z: l.z,
            visibility: l.visibility ?? 0,
          })),
          worldLandmarks: worldLandmarks.map((l) => ({
            x: l.x,
            y: l.y,
            z: l.z,
            visibility: l.visibility ?? 0,
          })),
        };
        framesRef.current.push(frame);

        const metrics = computeFrameMetrics(frame.worldLandmarks, timestamp);
        frameMetricsRef.current.push(metrics);

        metricsUpdateCounter.current++;
        if (metricsUpdateCounter.current % 4 === 0) {
          setCurrentMetrics(metrics);
          setElapsedSeconds(timestamp / 1000);
        }
      }
    }

    animationRef.current = requestAnimationFrame(runDetection);
  }, [isRecording, sourceMode]);

  const startRecording = useCallback(() => {
    framesRef.current = [];
    frameMetricsRef.current = [];
    startTimeRef.current = performance.now();
    setIsRecording(true);
    setCurrentMetrics(null);
    setElapsedSeconds(0);
    setRecordingId(null);
    setSourceMode("camera");

    const canvas = canvasRef.current;
    const captureStream =
      canvas && typeof canvas.captureStream === "function"
        ? canvas.captureStream.bind(canvas)
        : null;
    const recordingStream = captureStream?.(30) ?? streamRef.current;

    if (recordingStream && typeof MediaRecorder !== "undefined") {
      try {
        const candidates = [
          "video/webm;codecs=vp9",
          "video/webm;codecs=vp8",
          "video/webm",
          "video/mp4",
        ];
        const mimeType = candidates.find((type) => MediaRecorder.isTypeSupported(type)) ?? "";
        const mediaRecorder = new MediaRecorder(recordingStream, {
          ...(mimeType ? { mimeType } : {}),
          videoBitsPerSecond: 600_000,
        });
        recordedChunksRef.current = [];
        mediaRecorder.ondataavailable = (event) => {
          if (event.data && event.data.size > 0) recordedChunksRef.current.push(event.data);
        };
        mediaRecorderRef.current = mediaRecorder;
        setRecordedMimeType(mimeType || "video/webm");
        mediaRecorder.start(1000);
      } catch (err) {
        console.warn("Video recording unavailable:", err);
        mediaRecorderRef.current = null;
      }
    }
  }, []);

  const stopRecording = useCallback(async () => {
    setIsRecording(false);
    setIsSaving(true);
    cancelAnimationFrame(animationRef.current);

    if (sourceMode === "camera") {
      streamRef.current?.getTracks().forEach((t) => t.stop());
    } else if (videoRef.current) {
      videoRef.current.pause();
    }

    let videoBlob: Blob | null = null;
    const mediaRecorder = mediaRecorderRef.current;
    if (sourceMode === "camera" && mediaRecorder && mediaRecorder.state !== "inactive") {
      await new Promise<void>((resolve) => {
        mediaRecorder.onstop = () => resolve();
        mediaRecorder.stop();
      });
      if (recordedChunksRef.current.length > 0) {
        videoBlob = new Blob(recordedChunksRef.current, { type: recordedMimeType });
      }
      mediaRecorderRef.current = null;
      recordedChunksRef.current = [];
    }

    const durationMs = performance.now() - startTimeRef.current;
    const frames = framesRef.current;
    const fMetrics = frameMetricsRef.current;
    const metrics = computeSessionMetrics(fMetrics, frames, durationMs);
    const localRecordingId = crypto.randomUUID();

    if (sourceMode === "upload" && uploadedVideoUrl) {
      const response = await fetch(uploadedVideoUrl);
      videoBlob = await response.blob();
      setRecordedMimeType(videoBlob.type || "video/mp4");
    }

    if (videoBlob) {
      try {
        await putVideo({
          recordingId: localRecordingId,
          patientId: "try-demo",
          sessionId: "try-demo",
          mimeType: recordedMimeType,
          blob: videoBlob,
          createdAt: Date.now(),
        });
        setRecordingId(localRecordingId);
      } catch (err) {
        console.warn("Video persist failed:", err);
      }
    }

    setSessionResult(metrics);
    setActiveSection("analysis");
    setReplayMode("standard");
    setIsSaving(false);
  }, [recordedMimeType, sourceMode, uploadedVideoUrl]);

  useEffect(() => {
    if (!isLoading && !showGuide && !cameraError && landmarkerRef.current && !sessionResult) {
      animationRef.current = requestAnimationFrame(runDetection);
      return () => cancelAnimationFrame(animationRef.current);
    }
  }, [isLoading, showGuide, cameraError, runDetection, sessionResult]);

  useEffect(() => {
    return () => {
      cancelAnimationFrame(animationRef.current);
      streamRef.current?.getTracks().forEach((t) => t.stop());
      const mediaRecorder = mediaRecorderRef.current;
      if (mediaRecorder && mediaRecorder.state !== "inactive") mediaRecorder.stop();
      if (uploadedVideoUrl) URL.revokeObjectURL(uploadedVideoUrl);
    };
  }, [uploadedVideoUrl]);

  useEffect(() => {
    const video = videoRef.current;
    if (!video || sourceMode !== "upload") return;

    const handleEnded = () => {
      if (isRecording && !isSaving) {
        void stopRecording();
      }
    };

    video.addEventListener("ended", handleEnded);
    return () => video.removeEventListener("ended", handleEnded);
  }, [isRecording, isSaving, sourceMode, stopRecording]);

  useEffect(() => {
    if (!isRecording) return;
    let wakeLock: WakeLockSentinel | null = null;
    if ("wakeLock" in navigator) {
      navigator.wakeLock.request("screen").then((wl) => { wakeLock = wl; }).catch(() => {});
    }
    return () => { wakeLock?.release(); };
  }, [isRecording]);

  if (showGuide) {
    return (
      <>
        <input
          ref={fileInputRef}
          type="file"
          accept="video/*"
          className="hidden"
          onChange={(event) => {
            const file = event.target.files?.[0];
            if (!file) return;
            void analyzeUploadedVideo(file);
            event.currentTarget.value = "";
          }}
        />
        <SetupGuide
          onDismiss={() => {
            setShowGuide(false);
            startCamera();
          }}
          secondaryActionLabel="Use Existing Video"
          onSecondaryAction={() => fileInputRef.current?.click()}
        />
      </>
    );
  }

  // Show results after recording
  if (sessionResult) {
    return (
      <div className="min-h-screen bg-gray-950 text-white p-6 pb-8">
        <h1 className="text-2xl font-bold mb-2">Gait Analysis Report</h1>
        <p className="text-sm text-gray-400 mb-6">
          Comprehensive analysis of the recorded walking session.
        </p>
        <div className="bg-gray-900 border border-white/10 rounded-xl p-4 mb-4 text-sm text-gray-300">
          Replay is stored only on this device in local browser storage. It is not uploaded.
        </div>
        <div className="flex gap-1 bg-gray-900 rounded-xl p-1 mb-4">
          <button
            onClick={() => setActiveSection("analysis")}
            className={`flex-1 px-3 py-2 rounded-lg text-sm font-medium ${
              activeSection === "analysis" ? "bg-green-600 text-white" : "text-gray-400"
            }`}
          >
            Analysis
          </button>
          <button
            onClick={() => setActiveSection("replay")}
            className={`flex-1 px-3 py-2 rounded-lg text-sm font-medium ${
              activeSection === "replay" ? "bg-green-600 text-white" : "text-gray-400"
            }`}
          >
            Replay
          </button>
        </div>

        {activeSection === "analysis" ? (
          <GaitReport
            metrics={sessionResult}
            frameMetrics={frameMetricsRef.current}
            onFocusMetric={(metricId) => {
              setFocusedMetricId(metricId);
              setReplayMode("metric");
              setActiveSection("replay");
            }}
          />
        ) : recordingId ? (
          <div className="space-y-4">
            <div className="flex gap-1 bg-gray-900 rounded-xl p-1">
              <button
                onClick={() => setReplayMode("standard")}
                className={`flex-1 px-3 py-2 rounded-lg text-xs font-medium ${
                  replayMode === "standard" ? "bg-green-600 text-white" : "text-gray-400"
                }`}
              >
                Standard Replay
              </button>
              <button
                onClick={() => setReplayMode("metric")}
                className={`flex-1 px-3 py-2 rounded-lg text-xs font-medium ${
                  replayMode === "metric" ? "bg-green-600 text-white" : "text-gray-400"
                }`}
              >
                Focused Replay
              </button>
            </div>
            {replayMode === "metric" ? (
              focusedMetricId ? (
                <MetricReplay
                  recordingId={recordingId}
                  frameData={framesRef.current}
                  frameMetrics={frameMetricsRef.current}
                  initialMetricId={focusedMetricId}
                  title="On-demand metric replay"
                />
              ) : (
                <div className="rounded-xl border border-white/10 bg-gray-800 p-4 text-sm text-gray-400">
                  Open Summary or Detailed View and tap <span className="font-medium text-white">Watch Focused Replay</span> on a supported metric.
                </div>
              )
            ) : (
              <RecordingVideo recordingId={recordingId} label="This device's replay" />
            )}
          </div>
        ) : (
          <div className="bg-gray-800 rounded-xl p-4 text-sm text-gray-400">
            Replay is not available for this capture on this device.
          </div>
        )}

        <div className="mt-6">
        {/* Signup prompt */}
        <div className="bg-green-900/30 border border-green-800 rounded-xl p-4 mb-4">
          <h3 className="font-medium text-green-300 mb-2">
            Want to track progress over time?
          </h3>
          <p className="text-sm text-gray-400 mb-3">
            Create a free account to save sessions, see weekly/monthly trends,
            and share data with your therapist.
          </p>
          <button
            onClick={() => router.push("/signup")}
            className="w-full bg-green-600 text-white py-3 rounded-xl font-medium active:bg-green-700"
          >
            Create free account
          </button>
        </div>

        <div className="flex gap-3">
          <button
            onClick={() => {
              setSessionResult(null);
              setRecordingId(null);
              setSelectedVideoName(null);
              setSourceDurationSeconds(null);
              setFocusedMetricId(null);
              setReplayMode("standard");
              setShowGuide(true);
            }}
            className="flex-1 bg-gray-800 text-white py-3 rounded-xl text-sm active:bg-gray-700"
          >
            Record another
          </button>
          <button
            onClick={() => router.push("/")}
            className="flex-1 bg-gray-800 text-gray-400 py-3 rounded-xl text-sm active:bg-gray-700"
          >
            Back to home
          </button>
        </div>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-black flex flex-col">
      <input
        ref={fileInputRef}
        type="file"
        accept="video/*"
        className="hidden"
        onChange={(event) => {
          const file = event.target.files?.[0];
          if (!file) return;
          void analyzeUploadedVideo(file);
          event.currentTarget.value = "";
        }}
      />
      <div className="relative flex-1">
        <video
          ref={videoRef}
          playsInline
          muted
          className="absolute inset-0 w-full h-full object-cover opacity-0"
        />
        <canvas
          ref={canvasRef}
          className="absolute inset-0 w-full h-full object-contain"
        />
        <div className="absolute top-20 left-4 right-4 z-10">
          <div className="rounded-xl border border-white/10 bg-black/65 px-3 py-2 text-[11px] text-gray-200 shadow-lg backdrop-blur-sm">
            {sourceMode === "upload"
              ? "Selected videos are analyzed locally in this browser, and replay stays on this device only. Nothing is uploaded."
              : "Demo replay is recorded on this device only and stored locally in this browser. Nothing is uploaded."}
          </div>
        </div>
        {sourceMode === "upload" && isRecording && sourceDurationSeconds && (
          <div className="absolute top-36 left-4 right-4 z-10">
            <div className="rounded-xl border border-white/10 bg-black/65 px-3 py-2 text-[11px] text-gray-200 shadow-lg backdrop-blur-sm">
              <div className="flex items-center justify-between">
                <span>Analyzing uploaded video</span>
                <span>{Math.min(100, Math.round((elapsedSeconds / sourceDurationSeconds) * 100))}%</span>
              </div>
              <div className="mt-2 h-1.5 rounded-full bg-white/10">
                <div
                  className="h-1.5 rounded-full bg-green-500"
                  style={{ width: `${Math.min(100, (elapsedSeconds / sourceDurationSeconds) * 100)}%` }}
                />
              </div>
            </div>
          </div>
        )}
        <MetricsPanel
          metrics={currentMetrics}
          isRecording={isRecording}
          elapsedSeconds={elapsedSeconds}
          recordingMode={isSaving ? "saving" : isRecording ? "recording" : "idle"}
        />
        {selectedVideoName && (
          <div className="absolute bottom-4 left-4 bg-black/70 text-white text-xs px-3 py-1.5 rounded-lg max-w-[70%] truncate">
            Uploaded: {selectedVideoName}
          </div>
        )}
      </div>

      <div className="bg-black/80 p-4 pb-8 flex items-center justify-center gap-6 safe-bottom">
        <button
          onClick={() => {
            cancelAnimationFrame(animationRef.current);
            streamRef.current?.getTracks().forEach((t) => t.stop());
            router.push("/");
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
              onClick={() => router.push("/")}
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
