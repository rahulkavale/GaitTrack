"use client";

import Link from "next/link";

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-gray-950 text-white flex flex-col">
      <div className="flex-1 flex flex-col items-center justify-center p-6 text-center">
        <h1 className="text-3xl font-bold mb-3">Gait Tracker</h1>
        <p className="text-gray-400 text-sm max-w-xs mb-8">
          Track your child&apos;s walking progress with just a phone camera.
          Free, private, no install needed.
        </p>

        <Link href="/try">
          <div className="bg-green-600 text-white px-8 py-4 rounded-2xl text-lg font-bold active:bg-green-700 mb-4 w-64 text-center">
            Try it now
          </div>
        </Link>
        <p className="text-xs text-gray-500 mb-8">No sign-up required</p>

        <Link href="/login">
          <div className="bg-gray-800 text-gray-300 px-8 py-3 rounded-xl text-sm active:bg-gray-700 w-64 text-center mb-3">
            Sign in to your account
          </div>
        </Link>

        <Link href="/join">
          <div className="bg-gray-800 text-gray-500 px-8 py-3 rounded-xl text-sm active:bg-gray-700 w-64 text-center">
            Join a session (enter code)
          </div>
        </Link>
      </div>

      <div className="p-6 pb-8 safe-bottom">
        <div className="bg-gray-900 rounded-xl p-4 text-sm text-gray-400 space-y-2">
          <p><strong className="text-gray-300">How it works:</strong></p>
          <p>1. Point your camera at your child walking</p>
          <p>2. See real-time stick figure tracking</p>
          <p>3. Get joint angle and symmetry measurements</p>
          <p>4. Track progress over time</p>
        </div>
      </div>
    </div>
  );
}
