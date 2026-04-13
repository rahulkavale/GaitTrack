"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { getPatients, createPatient, deletePatient, getPendingInvitations, acceptInvitation } from "@/lib/db";
import { captureEvent, identifyUser, resetAnalytics } from "@/lib/analytics/posthog";

interface Patient {
  id: string;
  name: string;
  birth_date: string | null;
  created_at: string;
  patient_access: Array<{ role: string; user_id: string }>;
}

interface Invitation {
  id: string;
  role: string;
  patients: { name: string };
}

export default function DashboardPage() {
  const router = useRouter();
  const [patients, setPatients] = useState<Patient[]>([]);
  const [invitations, setInvitations] = useState<Invitation[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddPatient, setShowAddPatient] = useState(false);
  const [newPatientName, setNewPatientName] = useState("");
  const [userName, setUserName] = useState("");

  useEffect(() => {
    const supabase = createClient();
    let active = true;

    async function load() {
      setLoading(true);
      const { data: { user } } = await supabase.auth.getUser();
      if (!active) return;

      if (!user) {
        setUserName("");
        setPatients([]);
        setInvitations([]);
        setLoading(false);
        return;
      }

      setUserName(user.user_metadata?.name || user.email || "");
      identifyUser(user.id, {
        email: user.email ?? "",
        has_name: Boolean(user.user_metadata?.name),
      });

      const [patientsResult, invitationsResult] = await Promise.allSettled([
        getPatients(user.id),
        getPendingInvitations(),
      ]);

      if (!active) return;

      if (patientsResult.status === "fulfilled") {
        setPatients(patientsResult.value as unknown as Patient[]);
      } else {
        console.error("Failed to load patients:", patientsResult.reason);
        setPatients([]);
      }

      if (invitationsResult.status === "fulfilled") {
        setInvitations(invitationsResult.value as unknown as Invitation[]);
      } else {
        console.error("Failed to load invitations:", invitationsResult.reason);
        setInvitations([]);
      }

      if (active) setLoading(false);
    }

    void load();

    const { data: authListener } = supabase.auth.onAuthStateChange(() => {
      void load();
    });

    return () => {
      active = false;
      authListener.subscription.unsubscribe();
    };
  }, []);

  const handleAddPatient = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newPatientName.trim()) return;
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    await createPatient(newPatientName.trim());
    captureEvent("child_profile_created", {
      source: "dashboard",
      child_name_length: newPatientName.trim().length,
    });
    setNewPatientName("");
    setShowAddPatient(false);
    const p = await getPatients(user.id);
    setPatients(p as unknown as Patient[]);
  };

  const handleAcceptInvitation = async (id: string) => {
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    await acceptInvitation(id);
    captureEvent("invitation_accepted", {
      source: "dashboard",
    });
    const [patientsResult, invitationsResult] = await Promise.allSettled([
      getPatients(user.id),
      getPendingInvitations(),
    ]);
    if (patientsResult.status === "fulfilled") {
      setPatients(patientsResult.value as unknown as Patient[]);
    }
    if (invitationsResult.status === "fulfilled") {
      setInvitations(invitationsResult.value as unknown as Invitation[]);
    }
  };

  const handleDeletePatient = async (patientId: string, patientName: string) => {
    if (!confirm(`Remove "${patientName}"'s profile and all session data? This cannot be undone.`)) return;
    try {
      await deletePatient(patientId);
      captureEvent("child_profile_deleted", {
        source: "dashboard",
      });
      setPatients(prev => prev.filter(p => p.id !== patientId));
    } catch (err) {
      console.error("Failed to delete:", err);
      alert("Failed to delete. You may not have permission.");
    }
  };

  const handleSignOut = async () => {
    const supabase = createClient();
    captureEvent("signed_out", {
      source: "dashboard",
    });
    resetAnalytics();
    await supabase.auth.signOut();
    router.push("/");
    router.refresh();
  };

  return (
    <div className="min-h-screen bg-gray-950 text-white">
      <div className="bg-gray-900 p-4 pb-6 safe-top">
        <div className="flex justify-between items-start">
          <div>
            <h1 className="text-2xl font-bold mb-1">Gait Tracker</h1>
            <p className="text-sm text-gray-400">Hi, {userName}</p>
            <p className="text-xs text-gray-500 mt-2">Choose a child profile or create a new one to start recording.</p>
          </div>
          <div className="rounded-full bg-green-500/10 px-3 py-1 text-[10px] font-medium tracking-[0.18em] text-green-300">
            TRACKING HOME
          </div>
        </div>
      </div>

      <div className="p-4 space-y-4">
        {invitations.length > 0 && (
          <div className="space-y-2">
            <h2 className="text-xs font-medium uppercase tracking-[0.18em] text-blue-300/80">Invitations</h2>
            {invitations.map((inv) => (
              <div key={inv.id} className="bg-blue-900/30 border border-blue-800 rounded-xl p-4">
                <p className="text-sm text-blue-300 mb-2">
                  You&apos;ve been invited as <strong>{inv.role}</strong> for{" "}
                  <strong>{inv.patients?.name}</strong>
                </p>
                <button
                  onClick={() => handleAcceptInvitation(inv.id)}
                  className="bg-blue-600 text-white text-sm px-4 py-2 rounded-lg active:bg-blue-700"
                >
                  Accept
                </button>
              </div>
            ))}
          </div>
        )}

        <div className="bg-gray-900 rounded-xl p-4">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h2 className="text-sm font-medium text-white">Your children</h2>
              <p className="text-xs text-gray-400 mt-1">Profiles and session history stay here.</p>
            </div>
            <div className="flex items-center gap-2">
              <Link
                href="/settings"
                className="text-xs text-gray-300 bg-gray-800 px-3 py-1.5 rounded-lg active:bg-gray-700"
              >
                Settings
              </Link>
              <button
                onClick={handleSignOut}
                className="text-xs text-gray-500 bg-gray-800 px-3 py-1.5 rounded-lg active:bg-gray-700"
              >
                Sign out
              </button>
            </div>
          </div>
        </div>

        {showAddPatient ? (
          <form onSubmit={handleAddPatient} className="bg-gray-800 rounded-xl p-4">
            <label className="block text-sm text-gray-400 mb-2">Child&apos;s name</label>
            <input
              type="text"
              value={newPatientName}
              onChange={(e) => setNewPatientName(e.target.value)}
              autoFocus
              className="w-full bg-gray-900 text-white rounded-lg px-4 py-3 text-sm mb-3 focus:outline-none focus:ring-2 focus:ring-green-500"
              placeholder="e.g., Arjun"
            />
            <div className="flex gap-2">
              <button
                type="submit"
                className="flex-1 bg-green-600 text-white py-2 rounded-lg text-sm active:bg-green-700"
              >
                Add
              </button>
              <button
                type="button"
                onClick={() => setShowAddPatient(false)}
                className="flex-1 bg-gray-700 text-white py-2 rounded-lg text-sm active:bg-gray-600"
              >
                Cancel
              </button>
            </div>
          </form>
        ) : (
          <button
            onClick={() => setShowAddPatient(true)}
            className="w-full bg-green-600 rounded-xl p-4 text-center active:bg-green-700 transition-colors"
          >
            <div className="text-lg font-bold">Add a Child</div>
            <div className="text-sm text-green-200">Start tracking their progress</div>
          </button>
        )}

        {loading ? (
          <div className="text-center text-gray-500 py-8">Loading...</div>
        ) : patients.length === 0 ? (
          <div className="text-center py-12">
            <p className="text-gray-500 mb-2">No children added yet</p>
            <p className="text-gray-600 text-sm">
              Add a child to start recording walking sessions
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {patients.map((patient) => (
              <div key={patient.id} className="bg-gray-800 rounded-xl p-4 mb-3">
                <Link href={`/patient/${patient.id}`}>
                  <div className="flex justify-between items-center active:opacity-70">
                    <div>
                      <h3 className="font-medium text-white text-lg">{patient.name}</h3>
                      <p className="text-xs text-gray-400">
                        Added {new Date(patient.created_at).toLocaleDateString()}
                      </p>
                    </div>
                    <span className="text-gray-600 text-2xl">&rsaquo;</span>
                  </div>
                </Link>
                <button
                  onClick={() => handleDeletePatient(patient.id, patient.name)}
                  className="mt-2 text-xs text-red-400/60 active:text-red-400"
                >
                  Remove profile and all data
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
