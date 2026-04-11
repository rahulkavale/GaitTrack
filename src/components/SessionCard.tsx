"use client";

import Link from "next/link";
import type { GaitSession } from "@/lib/types";

interface SessionCardProps {
  session: GaitSession;
}

export function SessionCard({ session }: SessionCardProps) {
  const date = new Date(session.createdAt);
  const formattedDate = date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
  const formattedTime = date.toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
  });

  const { metrics } = session;

  return (
    <Link href={`/review/${session.id}`}>
      <div className="bg-gray-800 rounded-xl p-4 active:bg-gray-700 transition-colors">
        <div className="flex justify-between items-start mb-2">
          <div>
            <h3 className="font-medium text-white">{session.label}</h3>
            <p className="text-xs text-gray-400">
              {formattedDate} at {formattedTime}
            </p>
          </div>
          <span className="text-xs text-gray-500 uppercase">{session.viewAngle}</span>
        </div>

        <div className="grid grid-cols-3 gap-3 text-sm">
          <div>
            <div className="text-gray-500 text-xs">Duration</div>
            <div className="text-white font-mono">
              {Math.round(metrics.durationSeconds)}s
            </div>
          </div>
          <div>
            <div className="text-gray-500 text-xs">Knee Sym</div>
            <div className="text-white font-mono">
              {Math.round(metrics.kneeSymmetryIndex * 100)}%
            </div>
          </div>
          <div>
            <div className="text-gray-500 text-xs">Steps</div>
            <div className="text-white font-mono">{metrics.totalSteps}</div>
          </div>
        </div>
      </div>
    </Link>
  );
}
