"use client";

import { useEffect, useState } from "react";
import { captureEvent } from "@/lib/analytics/posthog";
import { deleteVideo, estimateVideoStorage, getVideo } from "@/lib/videoStore";

interface Props {
  recordingId: string;
  label?: string;
}

export function RecordingVideo({ recordingId, label }: Props) {
  const [url, setUrl] = useState<string | null>(null);
  const [mimeType, setMimeType] = useState<string>("video/webm");
  const [blob, setBlob] = useState<Blob | null>(null);
  const [missing, setMissing] = useState(false);
  const [shareError, setShareError] = useState<string | null>(null);
  const [sizeLabel, setSizeLabel] = useState<string | null>(null);
  const [storageLabel, setStorageLabel] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);

  const formatBytes = (bytes: number) => {
    if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(bytes > 50 * 1024 * 1024 ? 0 : 1)} MB`;
  };

  useEffect(() => {
    let revoked = false;
    let objectUrl: string | null = null;
    setMissing(false);
    setUrl(null);
    setBlob(null);
    setShareError(null);
    getVideo(recordingId)
      .then((rec) => {
        if (!rec || rec.blob.size === 0) {
          if (!revoked) setMissing(true);
          return;
        }
        objectUrl = URL.createObjectURL(rec.blob);
        if (revoked) {
          URL.revokeObjectURL(objectUrl);
          return;
        }
        setUrl(objectUrl);
        setMimeType(rec.mimeType);
        setBlob(rec.blob);
        setSizeLabel(formatBytes(rec.blob.size));
        captureEvent("local_replay_loaded", {
          recording_id: recordingId,
          replay_size_bytes: rec.blob.size,
        });
        if (rec.blob.size > 20 * 1024 * 1024) {
          captureEvent("large_replay_warning_shown", {
            recording_id: recordingId,
            replay_size_bytes: rec.blob.size,
          });
        }
        void estimateVideoStorage().then((estimate) => {
          if (estimate.usageBytes && estimate.quotaBytes) {
            setStorageLabel(
              `${formatBytes(estimate.usageBytes)} used of ${formatBytes(estimate.quotaBytes)} browser storage`
            );
          }
        });
      })
      .catch(() => {
        if (!revoked) setMissing(true);
      });
    return () => {
      revoked = true;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [recordingId]);

  const handleShare = async () => {
    if (!blob) return;
    setShareError(null);
    const ext = mimeType.includes("mp4") ? "mp4" : "webm";
    const file = new File([blob], `gait-${recordingId}.${ext}`, { type: mimeType });
    const canShareFiles =
      typeof navigator !== "undefined" &&
      typeof navigator.canShare === "function" &&
      navigator.canShare({ files: [file] });
    if (canShareFiles) {
      try {
        await navigator.share({ files: [file], title: "Gait recording" });
        captureEvent("local_replay_shared", {
          recording_id: recordingId,
          share_method: "navigator_share",
        });
        return;
      } catch (err) {
        if (err instanceof DOMException && err.name === "AbortError") return;
        setShareError("Share cancelled or unavailable");
      }
    } else {
      // Fallback: trigger a download so the user can share from their file manager.
      const a = document.createElement("a");
      a.href = url ?? URL.createObjectURL(blob);
      a.download = `gait-${recordingId}.${ext}`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      captureEvent("local_replay_shared", {
        recording_id: recordingId,
        share_method: "download",
      });
    }
  };

  const handleDeleteLocalReplay = async () => {
    if (!confirm("Delete this local replay from this device? The analysis numbers will remain saved.")) return;
    setDeleting(true);
    try {
      await deleteVideo(recordingId);
      captureEvent("local_replay_deleted", {
        recording_id: recordingId,
      });
      if (url) URL.revokeObjectURL(url);
      setUrl(null);
      setBlob(null);
      setMissing(true);
    } finally {
      setDeleting(false);
    }
  };

  if (missing) {
    return (
      <div className="bg-gray-800 rounded-xl p-3 text-xs text-gray-500">
        Video not available on this device. Videos are stored locally and only accessible from the device that recorded them.
      </div>
    );
  }

  if (!url) {
    return (
      <div className="bg-gray-800 rounded-xl p-3 text-xs text-gray-500">Loading video…</div>
    );
  }

  return (
    <div className="bg-gray-800 rounded-xl p-3">
      {label && <p className="text-xs text-gray-400 mb-2">{label}</p>}
      {blob && blob.size > 20 * 1024 * 1024 && (
        <div className="mb-3 rounded-lg border border-yellow-700/70 bg-yellow-900/20 p-3 text-xs text-yellow-200">
          This local replay uses {sizeLabel}. Keep it for replay, or delete it after review to free space on this device.
        </div>
      )}
      <video
        src={url}
        controls
        playsInline
        preload="metadata"
        className="w-full rounded-lg bg-black"
      />
      <div className="flex gap-2 mt-3">
        <button
          onClick={handleShare}
          className="flex-1 bg-green-600 text-white text-sm py-2 rounded-lg active:bg-green-700"
        >
          Share video
        </button>
        <button
          onClick={handleDeleteLocalReplay}
          disabled={deleting}
          className="flex-1 bg-gray-700 text-white text-sm py-2 rounded-lg active:bg-gray-600 disabled:opacity-60"
        >
          {deleting ? "Deleting..." : "Delete local replay"}
        </button>
      </div>
      {shareError && <p className="text-[10px] text-red-400 mt-2">{shareError}</p>}
      <p className="text-[10px] text-gray-500 mt-2">
        Stored only on this device. Not uploaded.
      </p>
      {sizeLabel && <p className="text-[10px] text-gray-500 mt-1">Replay size: {sizeLabel}</p>}
      {storageLabel && <p className="text-[10px] text-gray-500 mt-1">{storageLabel}</p>}
    </div>
  );
}
