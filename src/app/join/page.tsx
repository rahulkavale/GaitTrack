"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { getSessionByJoinCode } from "@/lib/db";

export default function JoinPage() {
  const router = useRouter();
  const [code, setCode] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleJoin = async () => {
    setError("");
    if (code.length !== 4) {
      setError("Enter the 4-digit code shown on the other device");
      return;
    }
    setLoading(true);
    try {
      const session = await getSessionByJoinCode(code);
      if (!session) {
        setError("No active session found with this code");
        setLoading(false);
        return;
      }
      router.push(`/join/${session.id as string}/record`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-950 flex items-center justify-center p-6">
      <div className="w-full max-w-sm">
        <h1 className="text-2xl font-bold text-white text-center mb-2">Join Session</h1>
        <p className="text-gray-400 text-center text-sm mb-8">
          Enter the 4-digit code shown on the other device to add your camera angle.
        </p>

        <div className="space-y-4">
          <div>
            <label className="block text-sm text-gray-400 mb-1">Session code</label>
            <input
              type="text"
              inputMode="numeric"
              maxLength={4}
              value={code}
              onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
              autoFocus
              placeholder="0000"
              className="w-full bg-gray-800 text-white text-center text-3xl font-mono tracking-[0.5em] rounded-xl px-4 py-4 focus:outline-none focus:ring-2 focus:ring-green-500"
            />
          </div>

          {error && <p className="text-red-400 text-sm">{error}</p>}

          <button
            onClick={handleJoin}
            disabled={loading || code.length !== 4}
            className="w-full bg-green-600 text-white py-3 rounded-xl font-medium text-lg active:bg-green-700 disabled:opacity-50"
          >
            {loading ? "Looking up..." : "Join"}
          </button>
        </div>

        <button
          onClick={() => router.push("/dashboard")}
          className="w-full text-gray-500 text-sm mt-6 py-2"
        >
          Back to dashboard
        </button>
      </div>
    </div>
  );
}
