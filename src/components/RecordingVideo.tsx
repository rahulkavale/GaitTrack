"use client";

import { useEffect, useState } from "react";
import { getVideo } from "@/lib/videoStore";

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
      </div>
      {shareError && <p className="text-[10px] text-red-400 mt-2">{shareError}</p>}
      <p className="text-[10px] text-gray-500 mt-2">
        Stored only on this device. Not uploaded.
      </p>
    </div>
  );
}
