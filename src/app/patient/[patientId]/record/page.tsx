"use client";

import { useRef, useState, useCallback, useEffect, use } from "react";
import { useRouter } from "next/navigation";
import { drawStickFigure } from "@/components/StickFigure";
import { MetricsPanel } from "@/components/MetricsPanel";
import { SetupGuide } from "@/components/SetupGuide";
import { SessionContextFields, hasMeaningfulSessionContext } from "@/components/SessionContextFields";
import { computeFrameMetrics, computeSessionMetrics } from "@/lib/gait-metrics";
import {
  createSession,
  getMetricPreferences,
  getSessions,
  saveRecording,
  consolidateSessionMetrics,
  updateSessionContext,
} from "@/lib/db";
import { putVideo } from "@/lib/videoStore";
import { DEFAULT_SESSION_CONTEXT, type PoseFrame, type FrameMetrics, type SessionContext } from "@/lib/types";
import { DEFAULT_METRIC_PREFERENCES, type MetricPreferences } from "@/lib/metric-settings";
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
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Session state
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [joinCode, setJoinCode] = useState<string>("");
  const [viewAngle] = useState<ViewAngle>("front"); // default front for new sessions
  const [recordingCount, setRecordingCount] = useState(0);
  const [showGuide, setShowGuide] = useState(true);
  const [showDone, setShowDone] = useState(false);
  const [sessionContext, setSessionContext] = useState<SessionContext>(DEFAULT_SESSION_CONTEXT);
  const [savingContext, setSavingContext] = useState(false);

  // Camera / recording state
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

  const [isLoading, setIsLoading] = useState(false);
  const [loadingStatus, setLoadingStatus] = useState("");
  const [isRecording, setIsRecording] = useState(false);
  const [currentMetrics, setCurrentMetrics] = useState<FrameMetrics | null>(null);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [isSaving, setIsSaving] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [recordedMimeType, setRecordedMimeType] = useState<string>("video/webm");
  const [sourceMode, setSourceMode] = useState<"camera" | "upload">("camera");
  const [uploadedVideoUrl, setUploadedVideoUrl] = useState<string | null>(null);
  const [selectedVideoName, setSelectedVideoName] = useState<string | null>(null);
  const [sourceDurationSeconds, setSourceDurationSeconds] = useState<number | null>(null);
  const [metricPreferences, setMetricPreferences] = useState<MetricPreferences>(DEFAULT_METRIC_PREFERENCES);

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

  useEffect(() => {
    getSessions(patientId)
      .then((rows) => {
        const lastWithContext = (rows as Array<{ session_context?: SessionContext | null }>).find(
          (row) => row.session_context && hasMeaningfulSessionContext(row.session_context)
        );
        if (lastWithContext?.session_context) {
          setSessionContext(lastWithContext.session_context);
        }
      })
      .catch(() => {});
  }, [patientId]);

  const persistSessionContext = useCallback(async () => {
    if (!sessionId) return;
    setSavingContext(true);
    try {
      await updateSessionContext(sessionId, hasMeaningfulSessionContext(sessionContext) ? sessionContext : null);
    } finally {
      setSavingContext(false);
    }
  }, [sessionContext, sessionId]);

  useEffect(() => {
    getMetricPreferences()
      .then(setMetricPreferences)
      .catch((err) => console.warn("Failed to load metric preferences:", err));
  }, []);

  const startCamera = useCallback(async () => {
    setIsLoading(true);
    setCameraError(null);
    setSourceMode("camera");
    setSourceDurationSeconds(null);
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
      await ensureLandmarker();
      setIsLoading(false);
      setLoadingStatus("");
    } catch (err) {
      setIsLoading(false);
      if (err instanceof DOMException && err.name === "NotAllowedError") {
        setCameraError("Camera access denied. Please allow camera access and reload.");
      } else {
        setCameraError(`Failed to start: ${err instanceof Error ? err.message : "Unknown error"}`);
      }
    }
  }, [ensureLandmarker]);

  const analyzeUploadedVideo = useCallback(async (file: File) => {
    setIsLoading(true);
    setCameraError(null);
    setSourceMode("upload");
    setSelectedVideoName(file.name);
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
          landmarks: landmarks.map(l => ({ x: l.x, y: l.y, z: l.z, visibility: l.visibility ?? 0 })),
          worldLandmarks: worldLandmarks.map(l => ({ x: l.x, y: l.y, z: l.z, visibility: l.visibility ?? 0 })),
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
    setSourceMode("camera");
    setSelectedVideoName(null);

    // Begin recording the composited canvas (video frame + skeleton overlay).
    // The video stays entirely on-device — chunks are held in memory and exposed
    // via a blob URL on the done screen for replay/download.
    const canvas = canvasRef.current;
    const captureStream =
      canvas && typeof canvas.captureStream === "function"
        ? canvas.captureStream.bind(canvas)
        : null;
    const recordingStream =
      captureStream?.(30) ??
      streamRef.current;

    if (recordingStream && typeof MediaRecorder !== "undefined") {
      try {
        const candidates = [
          "video/webm;codecs=vp9",
          "video/webm;codecs=vp8",
          "video/webm",
          "video/mp4",
        ];
        const mimeType = candidates.find(t => MediaRecorder.isTypeSupported(t)) ?? "";
        const mr = new MediaRecorder(recordingStream, {
          ...(mimeType ? { mimeType } : {}),
          // ~600kbps is plenty for a stick-figure overlay at 480p and keeps
          // a 30s clip under ~2MB so IndexedDB storage stays bounded.
          videoBitsPerSecond: 600_000,
        });
        recordedChunksRef.current = [];
        mr.ondataavailable = (e) => {
          if (e.data && e.data.size > 0) recordedChunksRef.current.push(e.data);
        };
        mediaRecorderRef.current = mr;
        setRecordedMimeType(mimeType || "video/webm");
        mr.start(1000);
      } catch (err) {
        console.warn("Video recording unavailable:", err);
        mediaRecorderRef.current = null;
      }
    }
  }, []);

  const stopRecording = useCallback(async () => {
    setIsRecording(false);
    setIsSaving(true);

    // Finalize the canvas MediaRecorder and assemble a single blob.
    let videoBlob: Blob | null = null;
    const mr = mediaRecorderRef.current;
    if (sourceMode === "camera" && mr && mr.state !== "inactive") {
      await new Promise<void>((resolve) => {
        mr.onstop = () => resolve();
        mr.stop();
      });
      if (recordedChunksRef.current.length > 0) {
        videoBlob = new Blob(recordedChunksRef.current, { type: recordedMimeType });
      }
      mediaRecorderRef.current = null;
      recordedChunksRef.current = [];
    }

    try {
      const durationMs = sourceMode === "upload"
        ? Math.round((framesRef.current.at(-1)?.timestamp ?? 0))
        : performance.now() - startTimeRef.current;
      const frames = framesRef.current;
      const fMetrics = frameMetricsRef.current;
      const metrics = computeSessionMetrics(fMetrics, frames, durationMs);
      const { id: recordingId } = await saveRecording(
        sessionId!,
        viewAngle,
        Math.round(durationMs),
        metrics,
        frames,
        fMetrics,
        metricPreferences,
      );
      await consolidateSessionMetrics(sessionId!);

      if (sourceMode === "upload" && uploadedVideoUrl) {
        const response = await fetch(uploadedVideoUrl);
        videoBlob = await response.blob();
      }

      // Persist the video on-device, keyed to the recording we just saved.
      // Failures here should never block the user from seeing their report.
      if (videoBlob) {
        try {
          await putVideo({
            recordingId,
            patientId,
            sessionId: sessionId!,
            mimeType: recordedMimeType,
            blob: videoBlob,
            createdAt: Date.now(),
          });
        } catch (err) {
          console.warn("Video persist failed:", err);
        }
      }

      setRecordingCount(c => c + 1);
      setShowDone(true);
      cancelAnimationFrame(animationRef.current);
      if (sourceMode === "camera") {
        streamRef.current?.getTracks().forEach(t => t.stop());
      } else {
        videoRef.current?.pause();
      }
    } catch (err) {
      console.error("Failed to save:", err);
      setCameraError(`Failed to save: ${err instanceof Error ? err.message : JSON.stringify(err)}`);
    } finally {
      setIsSaving(false);
    }
  }, [sessionId, viewAngle, recordedMimeType, patientId, sourceMode, uploadedVideoUrl, metricPreferences]);

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
      const mr = mediaRecorderRef.current;
      if (mr && mr.state !== "inactive") mr.stop();
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
      navigator.wakeLock.request("screen").then(wl => { wakeLock = wl; }).catch(() => {});
    }
    return () => { wakeLock?.release(); };
  }, [isRecording]);

  // ---- Setup guide ----
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
          onDismiss={async () => {
            await persistSessionContext();
            setShowGuide(false);
            startCamera();
          }}
          secondaryActionLabel="Use Existing Video"
          onSecondaryAction={async () => {
            await persistSessionContext();
            fileInputRef.current?.click();
          }}
        >
          <SessionContextFields
            value={sessionContext}
            onChange={setSessionContext}
            saving={savingContext}
          />
        </SetupGuide>
      </>
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
          <div className="bg-gray-900 border border-white/10 rounded-xl p-4 mb-6 text-left">
            <p className="text-sm text-white">Replay is stored on this device</p>
            <p className="text-xs text-gray-400 mt-1">
              Open the new Replay tab from this same phone or browser to watch the recording. The video is not uploaded to cloud storage.
            </p>
          </div>

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
        <video ref={videoRef} playsInline muted className="absolute inset-0 w-full h-full object-cover opacity-0" />
        <canvas ref={canvasRef} className="absolute inset-0 w-full h-full object-contain" />
        <MetricsPanel
          metrics={currentMetrics}
          isRecording={isRecording}
          elapsedSeconds={elapsedSeconds}
          recordingMode={isSaving ? "saving" : isRecording ? "recording" : "idle"}
        />
        <div className="absolute top-20 left-4 right-4 z-10">
          <div className="rounded-xl border border-white/10 bg-black/65 px-3 py-2 text-[11px] text-gray-200 shadow-lg backdrop-blur-sm">
            {sourceMode === "upload"
              ? "Selected videos are analyzed locally in this browser, and replay stays on this device only. Nothing is uploaded."
              : "Video replay is recorded on this device only and stored locally in this browser. Nothing is uploaded to cloud storage."}
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

        {/* Join code shown during recording so second person can join */}
        {joinCode && (
          <div className="absolute bottom-4 right-4 bg-black/70 text-green-400 text-xs px-3 py-2 rounded-lg font-mono">
            Code: {joinCode}
          </div>
        )}
        <div className="absolute bottom-4 left-4 bg-black/70 text-white text-xs px-3 py-1.5 rounded-lg">
          {selectedVideoName ? `Uploaded: ${selectedVideoName}` : VIEW_LABELS[viewAngle]}
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
