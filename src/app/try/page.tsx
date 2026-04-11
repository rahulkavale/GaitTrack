"use client";

import { useRouter } from "next/navigation";

export default function TryPage() {
  const router = useRouter();

  return (
    <div className="min-h-screen bg-gray-950 flex items-center justify-center p-6">
      <div className="w-full max-w-sm text-center">
        <h1 className="text-2xl font-bold text-white mb-2">
          Try Gait Analysis
        </h1>
        <p className="text-gray-400 text-sm mb-8">
          No account needed. Record a walking session and see the full analysis
          instantly. Nothing is saved — this is just a demo.
        </p>

        <button
          onClick={() => router.push("/try/record")}
          className="w-full bg-green-600 text-white py-4 rounded-xl font-medium text-lg active:bg-green-700 mb-4"
        >
          Start camera
        </button>

        <p className="text-gray-600 text-xs">
          Want to save sessions and track progress?{" "}
          <button onClick={() => router.push("/signup")} className="text-green-400">
            Create a free account
          </button>
        </p>
      </div>
    </div>
  );
}
