"use client";

import { useEffect, useState, use } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { getSessions, inviteToPatient } from "@/lib/db";
import { createClient } from "@/lib/supabase/client";
import { TABLES } from "@/lib/tables";

interface Recording {
  id: string;
  view_angle: string;
  knee_symmetry_index: number | null;
  total_steps: number | null;
}

interface Session {
  id: string;
  label: string;
  notes: string | null;
  knee_symmetry_index: number | null;
  hip_symmetry_index: number | null;
  stride_cadence: number | null;
  total_steps: number | null;
  duration_seconds: number | null;
  created_at: string;
  recordings: Recording[];
}

interface Patient {
  id: string;
  name: string;
}

export default function PatientPage({ params }: { params: Promise<{ patientId: string }> }) {
  const { patientId } = use(params);
  const router = useRouter();
  const [patient, setPatient] = useState<Patient | null>(null);
  const [sessions, setSessions] = useState<Session[]>([]);
  const [loading, setLoading] = useState(true);
  const [showInvite, setShowInvite] = useState(false);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState("therapist");
  const [inviteStatus, setInviteStatus] = useState("");

  useEffect(() => {
    async function load() {
      const supabase = createClient();
      const { data: p } = await supabase
        .from(TABLES.patients)
        .select("id, name")
        .eq("id", patientId)
        .single();
      setPatient(p);

      const s = await getSessions(patientId);
      setSessions(s as unknown as Session[]);
      setLoading(false);
    }
    load();
  }, [patientId]);

  const handleInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    setInviteStatus("");
    try {
      await inviteToPatient(patientId, inviteEmail.trim(), inviteRole);
      setInviteStatus("Invitation sent!");
      setInviteEmail("");
      setShowInvite(false);
    } catch (err) {
      setInviteStatus(err instanceof Error ? err.message : "Failed to send");
    }
  };

  // Group sessions by date
  const groupedSessions: Record<string, Session[]> = {};
  for (const session of sessions) {
    const dateKey = new Date(session.created_at).toLocaleDateString("en-US", {
      weekday: "long",
      month: "long",
      day: "numeric",
    });
    if (!groupedSessions[dateKey]) groupedSessions[dateKey] = [];
    groupedSessions[dateKey].push(session);
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-950 flex items-center justify-center text-gray-400">
        Loading...
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-950 text-white pb-8">
      <div className="bg-gray-900 p-4 safe-top">
        <button onClick={() => router.push("/")} className="text-green-400 text-sm mb-2">
          &larr; Back
        </button>
        <h1 className="text-xl font-bold">{patient?.name}</h1>
        <div className="flex gap-2 mt-3">
          <Link
            href={`/patient/${patientId}/record`}
            className="flex-1 bg-green-600 text-white py-2.5 rounded-xl text-sm font-medium text-center active:bg-green-700"
          >
            Record Session
          </Link>
          {sessions.length > 1 && (
            <Link
              href={`/patient/${patientId}/progress`}
              className="flex-1 bg-gray-700 text-white py-2.5 rounded-xl text-sm font-medium text-center active:bg-gray-600"
            >
              View Progress
            </Link>
          )}
        </div>
      </div>

      <div className="p-4 space-y-4">
        {/* Share / Invite */}
        <button
          onClick={() => setShowInvite(!showInvite)}
          className="w-full bg-gray-800 rounded-xl p-3 text-sm text-gray-300 text-center active:bg-gray-700"
        >
          Share with therapist or family
        </button>

        {showInvite && (
          <form onSubmit={handleInvite} className="bg-gray-800 rounded-xl p-4 space-y-3">
            <input
              type="email"
              value={inviteEmail}
              onChange={(e) => setInviteEmail(e.target.value)}
              placeholder="Their email address"
              required
              className="w-full bg-gray-900 text-white rounded-lg px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
            />
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setInviteRole("therapist")}
                className={`flex-1 py-2 rounded-lg text-sm ${
                  inviteRole === "therapist"
                    ? "bg-green-600 text-white"
                    : "bg-gray-700 text-gray-300"
                }`}
              >
                Therapist
              </button>
              <button
                type="button"
                onClick={() => setInviteRole("viewer")}
                className={`flex-1 py-2 rounded-lg text-sm ${
                  inviteRole === "viewer"
                    ? "bg-green-600 text-white"
                    : "bg-gray-700 text-gray-300"
                }`}
              >
                Viewer
              </button>
            </div>
            <button
              type="submit"
              className="w-full bg-green-600 text-white py-2 rounded-lg text-sm active:bg-green-700"
            >
              Send Invitation
            </button>
            {inviteStatus && (
              <p className="text-xs text-green-400">{inviteStatus}</p>
            )}
          </form>
        )}

        {/* Sessions grouped by day */}
        {sessions.length === 0 ? (
          <div className="text-center py-12">
            <p className="text-gray-500 mb-2">No sessions yet</p>
            <p className="text-gray-600 text-sm">
              Tap &quot;Record Session&quot; to capture the first walking session
            </p>
          </div>
        ) : (
          Object.entries(groupedSessions).map(([date, daySessions]) => (
            <div key={date}>
              <h2 className="text-sm font-medium text-gray-400 mb-2">{date}</h2>
              <div className="space-y-2">
                {daySessions.map((session) => (
                  <Link key={session.id} href={`/review/${session.id}`}>
                    <div className="bg-gray-800 rounded-xl p-4 active:bg-gray-700 transition-colors mb-2">
                      <div className="flex justify-between items-start mb-2">
                        <div>
                          <h3 className="font-medium text-white text-sm">
                            {session.label}
                          </h3>
                          <p className="text-xs text-gray-500">
                            {new Date(session.created_at).toLocaleTimeString("en-US", {
                              hour: "numeric",
                              minute: "2-digit",
                            })}
                            {" - "}
                            {session.recordings.length} angle
                            {session.recordings.length !== 1 ? "s" : ""}
                          </p>
                        </div>
                      </div>
                      {session.knee_symmetry_index != null && (
                        <div className="grid grid-cols-3 gap-2 text-xs">
                          <div>
                            <span className="text-gray-500">Knee Sym</span>
                            <p className="font-mono text-white">
                              {Math.round(session.knee_symmetry_index * 100)}%
                            </p>
                          </div>
                          <div>
                            <span className="text-gray-500">Cadence</span>
                            <p className="font-mono text-white">
                              {Math.round(session.stride_cadence ?? 0)}
                            </p>
                          </div>
                          <div>
                            <span className="text-gray-500">Duration</span>
                            <p className="font-mono text-white">
                              {Math.round(session.duration_seconds ?? 0)}s
                            </p>
                          </div>
                        </div>
                      )}
                    </div>
                  </Link>
                ))}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
