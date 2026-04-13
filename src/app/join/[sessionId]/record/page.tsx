"use client";

import { useRef, useState, useCallback, useEffect, use } from "react";
import { useRouter } from "next/navigation";
import { drawStickFigure } from "@/components/StickFigure";
import { MetricsPanel } from "@/components/MetricsPanel";
import { SetupGuide } from "@/components/SetupGuide";
import { computeFrameMetrics, computeSessionMetrics } from "@/lib/gait-metrics";
import { saveRecording, consolidateSessionMetrics, getSession } from "@/lib/db";
import { putVideo } from "@/lib/videoStore";
import type { PoseFrame, FrameMetrics } from "@/lib/types";
import type { PoseLandmarker } from "@mediapipe/tasks-vision";

type ViewAngle = "side-left" | "side-right" | "front" | "back";

const VIEW_LABELS: Record<ViewAngle, string> = {
  "side-left": "Left Side",
  "side-right": "Right Side",
  front: "Front",
  back: "Back",
};

export default function JoinRecordPage({
  params,
}: {
  params: Promise<{ sessionId: string }>;
}) {
  const { sessionId } = use(params);
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [phase, setPhase] = useState<"angle-select" | "guide" | "recording" | "done">("angle-select");
  const [viewAngle, setViewAngle] = useState<ViewAngle>("front");
  const [existingAngles, setExistingAngles] = useState<string[]>([]);
  const [patientId, setPatientId] = useState<string | null>(null);

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

  const metricsUpdateCounter = useRef(0);

  const ensureLandmarker = useCallback(async () => {
    if (landmarkerRef.current) return landmarkerRef.current;
    setLoadingStatus("Loading pose detection model...");
    const { createPoseLandmarker } = await import("@/lib/mediapipe");
    landmarkerRef.current = await createPoseLandmarker();
    return landmarkerRef.current;
  }, []);

  // Load existing recordings to know which angles are taken
  useEffect(() => {
    getSession(sessionId).then((s) => {
      if (s) {
        const recordings = (s.recordings || []) as Array<{ view_angle: string }>;
        const angles = recordings.map(r => r.view_angle);
        setExistingAngles(angles);
        setPatientId((s as { patient_id?: string }).patient_id ?? null);
        // Suggest an angle not yet recorded
        if (angles.includes("side-left") || angles.includes("side-right")) {
          setViewAngle("front");
        } else if (angles.includes("front")) {
          setViewAngle("side-left");
        }
      }
    });
  }, [sessionId]);

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
      setCameraError(err instanceof Error ? err.message : "Camera failed");
    }
  }, [ensureLandmarker]);

  const analyzeUploadedVideo = useCallback(async (file: File) => {
    setIsLoading(true);
    setCameraError(null);
    setSourceMode("upload");
    setSelectedVideoName(file.name);
    setSourceDurationSeconds(null);

    try {
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
      setPhase("recording");
      setIsRecording(true);
      await video.play();
    } catch (err) {
      setIsLoading(false);
      setCameraError(err instanceof Error ? err.message : "Failed to analyze video");
    }
  }, [ensureLandmarker]);

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

  const startRecordingCapture = () => {
    framesRef.current = [];
    frameMetricsRef.current = [];
    startTimeRef.current = performance.now();
    setIsRecording(true);
    setCurrentMetrics(null);
    setElapsedSeconds(0);
    setSourceMode("camera");
    setSelectedVideoName(null);

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
  };

  const stopRecordingCapture = async () => {
    setIsRecording(false);
    setIsSaving(true);

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

    try {
      const durationMs = sourceMode === "upload"
        ? Math.round((framesRef.current.at(-1)?.timestamp ?? 0))
        : performance.now() - startTimeRef.current;
      const metrics = computeSessionMetrics(frameMetricsRef.current, framesRef.current, durationMs);
      const { id: recordingId } = await saveRecording(
        sessionId,
        viewAngle,
        durationMs,
        metrics,
        framesRef.current,
        frameMetricsRef.current
      );
      await consolidateSessionMetrics(sessionId);

      if (sourceMode === "upload" && uploadedVideoUrl) {
        const response = await fetch(uploadedVideoUrl);
        videoBlob = await response.blob();
      }

      if (videoBlob && patientId) {
        try {
          await putVideo({
            recordingId,
            patientId,
            sessionId,
            mimeType: recordedMimeType,
            blob: videoBlob,
            createdAt: Date.now(),
          });
        } catch (err) {
          console.warn("Video persist failed:", err);
        }
      }

      cancelAnimationFrame(animationRef.current);
      if (sourceMode === "camera") {
        streamRef.current?.getTracks().forEach(t => t.stop());
      } else {
        videoRef.current?.pause();
      }
      setPhase("done");
    } catch (err) {
      setCameraError(`Failed to save: ${err instanceof Error ? err.message : "Unknown error"}`);
    }
    setIsSaving(false);
  };

  useEffect(() => {
    if (phase === "recording" && !isLoading && !cameraError && landmarkerRef.current) {
      animationRef.current = requestAnimationFrame(runDetection);
      return () => cancelAnimationFrame(animationRef.current);
    }
  }, [phase, isLoading, cameraError, runDetection]);

  useEffect(() => {
    return () => {
      cancelAnimationFrame(animationRef.current);
      streamRef.current?.getTracks().forEach(t => t.stop());
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
        void stopRecordingCapture();
      }
    };
    video.addEventListener("ended", handleEnded);
    return () => video.removeEventListener("ended", handleEnded);
  }, [isRecording, isSaving, sourceMode]);

  // ---- Angle selection ----
  if (phase === "angle-select") {
    return (
      <div className="min-h-screen bg-gray-950 text-white p-6 safe-top">
        <h1 className="text-xl font-bold mb-2">Choose Your Angle</h1>
        <p className="text-sm text-gray-400 mb-4">
          Pick which angle you&apos;ll be recording from.
        </p>
        <div className="bg-gray-900 border border-white/10 rounded-xl p-3 mb-4 text-xs text-gray-300">
          Replay video is saved only on the device that records it. It stays in local browser storage and is not uploaded.
        </div>
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

        {existingAngles.length > 0 && (
          <p className="text-xs text-green-400 mb-4">
            Already recorded: {existingAngles.map(a => VIEW_LABELS[a as ViewAngle] || a).join(", ")}
          </p>
        )}

        <div className="grid grid-cols-2 gap-2 mb-6">
          {(["side-left", "side-right", "front", "back"] as ViewAngle[]).map((angle) => {
            const taken = existingAngles.includes(angle);
            return (
              <button
                key={angle}
                onClick={() => setViewAngle(angle)}
                className={`py-3 rounded-xl text-sm font-medium ${
                  viewAngle === angle
                    ? "bg-green-600 text-white"
                    : taken
                    ? "bg-gray-800 text-gray-600"
                    : "bg-gray-800 text-gray-300 active:bg-gray-700"
                }`}
              >
                {VIEW_LABELS[angle]}
                {taken && <span className="block text-[10px] text-gray-600">already recorded</span>}
              </button>
            );
          })}
        </div>

        <button
          onClick={() => setPhase("guide")}
          className="w-full bg-green-600 text-white py-4 rounded-xl text-lg font-bold active:bg-green-700"
        >
          Start Recording ({VIEW_LABELS[viewAngle]})
        </button>
        <button
          onClick={() => fileInputRef.current?.click()}
          className="w-full mt-3 bg-gray-800 text-white py-3 rounded-xl text-sm font-medium active:bg-gray-700"
        >
          Use Existing Video ({VIEW_LABELS[viewAngle]})
        </button>
      </div>
    );
  }

  // ---- Setup guide ----
  if (phase === "guide") {
    return <SetupGuide onDismiss={() => { setPhase("recording"); startCamera(); }} />;
  }

  // ---- Done ----
  if (phase === "done") {
    return (
      <div className="min-h-screen bg-gray-950 text-white flex items-center justify-center p-6">
        <div className="text-center max-w-sm">
          <div className="text-4xl mb-4">&#10003;</div>
          <h1 className="text-xl font-bold mb-2">Recording Added!</h1>
          <p className="text-sm text-gray-400 mb-6">
            Your {VIEW_LABELS[viewAngle]} recording has been added to the session.
            The session owner can see the combined analysis.
          </p>
          <div className="bg-gray-900 border border-white/10 rounded-xl p-4 mb-6 text-left">
            <p className="text-sm text-white">Replay remains on this recording device</p>
            <p className="text-xs text-gray-400 mt-1">
              The local replay will only be visible from this same device and browser because the video is not uploaded.
            </p>
          </div>
          <button
            onClick={() => router.push("/")}
            className="bg-gray-800 text-white px-6 py-3 rounded-xl active:bg-gray-700"
          >
            Done
          </button>
        </div>
      </div>
    );
  }

  // ---- Recording ----
  return (
    <div className="fixed inset-0 bg-black flex flex-col">
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
              : "This recording's replay is saved only on this device. It is kept in local browser storage and not uploaded."}
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
        <div className="absolute bottom-4 left-4 bg-black/60 text-white text-xs px-3 py-1.5 rounded-full">
          {selectedVideoName ? `Uploaded: ${selectedVideoName}` : `${VIEW_LABELS[viewAngle]} (joined)`}
        </div>
      </div>

      <div className="bg-black/80 p-4 pb-8 flex items-center justify-center gap-6 safe-bottom">
        <div className="w-12 h-12" />
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
          <button onClick={stopRecordingCapture} className="w-16 h-16 rounded-2xl bg-red-600 flex items-center justify-center active:bg-red-700">
            <div className="w-6 h-6 bg-white rounded-sm" />
          </button>
        ) : (
          <button onClick={startRecordingCapture} className="w-16 h-16 rounded-full bg-red-600 flex items-center justify-center active:bg-red-700">
            <div className="w-6 h-6 bg-white rounded-full" />
          </button>
        )}
        <div className="w-12 h-12" />
      </div>

      {cameraError && (
        <div className="absolute inset-0 bg-black/90 flex items-center justify-center p-6">
          <div className="bg-gray-900 rounded-xl p-6 text-center max-w-sm">
            <p className="text-red-400 mb-4">{cameraError}</p>
            <button onClick={() => router.push("/")} className="bg-gray-700 text-white px-6 py-2 rounded-lg">Go back</button>
          </div>
        </div>
      )}
    </div>
  );
}
