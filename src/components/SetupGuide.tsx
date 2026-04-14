"use client";

import type { ReactNode } from "react";

interface SetupGuideProps {
  onDismiss: () => void;
  secondaryActionLabel?: string;
  onSecondaryAction?: () => void;
  children?: ReactNode;
}

export function SetupGuide({
  onDismiss,
  secondaryActionLabel,
  onSecondaryAction,
  children,
}: SetupGuideProps) {
  return (
    <div className="fixed inset-0 z-50 bg-black/90 flex items-center justify-center p-6">
      <div className="max-h-[calc(100vh-3rem)] w-full max-w-sm overflow-y-auto rounded-2xl bg-gray-900 p-6 text-white">
        <h2 className="text-xl font-bold mb-4">How to Record</h2>

        <div className="space-y-4 text-sm">
          <div className="flex gap-3">
            <span className="flex-shrink-0 w-8 h-8 bg-green-600 rounded-full flex items-center justify-center font-bold">
              1
            </span>
            <div>
              <p className="font-medium">Position the camera</p>
              <p className="text-gray-400">
                Stand to the <strong>side</strong> of the child, about 2-3 meters away.
                The full body should be visible.
              </p>
            </div>
          </div>

          <div className="flex gap-3">
            <span className="flex-shrink-0 w-8 h-8 bg-green-600 rounded-full flex items-center justify-center font-bold">
              2
            </span>
            <div>
              <p className="font-medium">Good lighting</p>
              <p className="text-gray-400">
                Make sure the area is well lit. Avoid strong backlighting
                (don&apos;t face a bright window).
              </p>
            </div>
          </div>

          <div className="flex gap-3">
            <span className="flex-shrink-0 w-8 h-8 bg-green-600 rounded-full flex items-center justify-center font-bold">
              3
            </span>
            <div>
              <p className="font-medium">Hold steady or prop up</p>
              <p className="text-gray-400">
                Lean the phone against something or have someone hold it still.
                Less movement = better tracking.
              </p>
            </div>
          </div>

          <div className="flex gap-3">
            <span className="flex-shrink-0 w-8 h-8 bg-green-600 rounded-full flex items-center justify-center font-bold">
              4
            </span>
            <div>
              <p className="font-medium">Let the child walk</p>
              <p className="text-gray-400">
                Have the child walk across the camera view. You&apos;ll see a stick
                figure overlay when tracking is working.
              </p>
            </div>
          </div>
        </div>

        {children && (
          <div className="mt-5 border-t border-white/10 pt-5">
            {children}
          </div>
        )}

        <button
          onClick={onDismiss}
          className="mt-6 w-full bg-green-600 text-white py-3 rounded-xl font-medium text-lg active:bg-green-700"
        >
          Got it, start camera
        </button>
        {secondaryActionLabel && onSecondaryAction && (
          <button
            onClick={onSecondaryAction}
            className="mt-3 w-full bg-gray-800 text-white py-3 rounded-xl font-medium text-sm active:bg-gray-700"
          >
            {secondaryActionLabel}
          </button>
        )}
      </div>
    </div>
  );
}
