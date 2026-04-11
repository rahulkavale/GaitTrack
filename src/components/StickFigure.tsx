"use client";

import { SKELETON_CONNECTIONS, MIN_VISIBILITY } from "@/lib/landmarks";

interface Landmark {
  x: number;
  y: number;
  z: number;
  visibility: number;
}

export function drawStickFigure(
  ctx: CanvasRenderingContext2D,
  landmarks: Landmark[],
  width: number,
  height: number
) {
  if (!landmarks || landmarks.length === 0) return;

  // Draw connections
  ctx.strokeStyle = "#00FF88";
  ctx.lineWidth = 3;
  ctx.lineCap = "round";

  for (const [startIdx, endIdx] of SKELETON_CONNECTIONS) {
    const start = landmarks[startIdx];
    const end = landmarks[endIdx];

    if (
      start &&
      end &&
      start.visibility > MIN_VISIBILITY &&
      end.visibility > MIN_VISIBILITY
    ) {
      ctx.beginPath();
      ctx.moveTo(start.x * width, start.y * height);
      ctx.lineTo(end.x * width, end.y * height);
      ctx.stroke();
    }
  }

  // Draw joints
  for (const landmark of landmarks) {
    if (landmark.visibility > MIN_VISIBILITY) {
      ctx.beginPath();
      ctx.arc(landmark.x * width, landmark.y * height, 5, 0, 2 * Math.PI);
      ctx.fillStyle = "#FFFFFF";
      ctx.fill();
      ctx.strokeStyle = "#00FF88";
      ctx.lineWidth = 2;
      ctx.stroke();
    }
  }
}
