"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { getMetricPreferences, saveMetricPreferences } from "@/lib/db";
import {
  METRIC_DEFINITIONS,
  getFeatureMetricOrder,
  getSummaryMetricOrder,
  getTimelineMetricOrder,
  type FeatureMetricId,
  type MetricPreferences,
  type SummaryMetricId,
  type TimelineMetricId,
} from "@/lib/metric-settings";

function definitionFor(metricId: string) {
  return METRIC_DEFINITIONS.find((metric) => metric.id === metricId);
}

export default function SettingsPage() {
  const router = useRouter();
  const [preferences, setPreferences] = useState<MetricPreferences | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState("");

  useEffect(() => {
    getMetricPreferences()
      .then((data) => {
        setPreferences(data);
        setLoading(false);
      })
      .catch((err) => {
        setStatus(err instanceof Error ? err.message : "Failed to load settings");
        setLoading(false);
      });
  }, []);

  const toggleSummary = (metricId: SummaryMetricId) => {
    setPreferences((current) => current ? {
      ...current,
      summary: {
        ...current.summary,
        [metricId]: {
          enabled: !current.summary[metricId].enabled,
        },
      },
    } : current);
  };

  const toggleFeature = (metricId: FeatureMetricId) => {
    setPreferences((current) => current ? {
      ...current,
      features: {
        ...current.features,
        [metricId]: {
          ...current.features[metricId],
          enabled: !current.features[metricId].enabled,
        },
      },
    } : current);
  };

  const toggleTimeline = (metricId: TimelineMetricId) => {
    setPreferences((current) => current ? {
      ...current,
      timelines: {
        ...current.timelines,
        [metricId]: {
          enabled: !current.timelines[metricId].enabled,
        },
      },
    } : current);
  };

  const updateThreshold = (
    metricId: FeatureMetricId,
    threshold: "mild" | "moderate" | "severe",
    value: string
  ) => {
    const numericValue = Number(value);
    setPreferences((current) => current ? {
      ...current,
      features: {
        ...current.features,
        [metricId]: {
          ...current.features[metricId],
          thresholds: {
            ...current.features[metricId].thresholds,
            [threshold]: Number.isFinite(numericValue)
              ? numericValue
              : current.features[metricId].thresholds[threshold],
          },
        },
      },
    } : current);
  };

  const handleSave = async () => {
    if (!preferences) return;
    setSaving(true);
    setStatus("");
    try {
      await saveMetricPreferences(preferences);
      setStatus("Saved. New recordings will use these settings.");
    } catch (err) {
      setStatus(err instanceof Error ? err.message : "Failed to save settings");
    } finally {
      setSaving(false);
    }
  };

  if (loading || !preferences) {
    if (!loading && !preferences) {
      return (
        <div className="min-h-screen bg-gray-950 text-white flex items-center justify-center p-6">
          <div className="text-center">
            <p className="text-sm text-gray-400">{status || "Unable to load metric settings."}</p>
            <button onClick={() => router.push("/dashboard")} className="mt-4 text-sm text-green-400">
              Back to dashboard
            </button>
          </div>
        </div>
      );
    }
    return (
      <div className="min-h-screen bg-gray-950 text-white flex items-center justify-center">
        <p className="text-sm text-gray-400">Loading metric settings...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-950 text-white pb-10">
      <div className="bg-gray-900 p-4 safe-top">
        <button onClick={() => router.push("/dashboard")} className="text-green-400 text-sm mb-2">
          &larr; Back to dashboard
        </button>
        <h1 className="text-2xl font-bold">Metric Settings</h1>
        <p className="text-sm text-gray-400 mt-1">
          Enable only the measures you care about and tune thresholds for future recordings.
        </p>
      </div>

      <div className="p-4 space-y-4">
        <div className="bg-blue-900/20 border border-blue-800/60 rounded-xl p-4 text-sm text-blue-200">
          Changes apply to new recordings only. Past sessions keep their original analysis.
        </div>

        <div className="bg-gray-900 rounded-xl p-4">
          <div className="flex items-center justify-between gap-4">
            <div>
              <h2 className="text-sm font-medium text-white">Retrospective Re-evaluation</h2>
              <p className="text-xs text-gray-400 mt-1">
                Re-run older sessions with updated settings.
              </p>
            </div>
            <button
              disabled
              className="rounded-lg border border-gray-700 px-3 py-2 text-xs text-gray-500 cursor-not-allowed"
            >
              Coming Soon
            </button>
          </div>
        </div>

        <section className="space-y-3">
          <h2 className="text-sm font-medium text-gray-400">Summary Cards</h2>
          {getSummaryMetricOrder().map((metricId) => {
            const definition = definitionFor(metricId);
            return (
              <div key={metricId} className="bg-gray-900 rounded-xl p-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <Link href={`/settings/metrics/${metricId}`} className="text-sm font-medium text-white underline-offset-2 hover:underline">
                      {definition?.label ?? metricId}
                    </Link>
                    <p className="text-xs text-gray-400 mt-1">{definition?.shortDescription}</p>
                  </div>
                  <button
                    onClick={() => toggleSummary(metricId)}
                    className={`rounded-full px-3 py-1 text-xs font-medium ${
                      preferences.summary[metricId].enabled
                        ? "bg-green-600 text-white"
                        : "bg-gray-800 text-gray-400"
                    }`}
                  >
                    {preferences.summary[metricId].enabled ? "Enabled" : "Hidden"}
                  </button>
                </div>
              </div>
            );
          })}
        </section>

        <section className="space-y-3">
          <h2 className="text-sm font-medium text-gray-400">Observed Movement Features</h2>
          {getFeatureMetricOrder().map((metricId) => {
            const definition = definitionFor(metricId);
            const settings = preferences.features[metricId];
            return (
              <div key={metricId} className="bg-gray-900 rounded-xl p-4">
                <div className="flex items-start justify-between gap-3 mb-3">
                  <div>
                    <Link href={`/settings/metrics/${metricId}`} className="text-sm font-medium text-white underline-offset-2 hover:underline">
                      {definition?.label ?? metricId}
                    </Link>
                    <p className="text-xs text-gray-400 mt-1">{definition?.shortDescription}</p>
                  </div>
                  <button
                    onClick={() => toggleFeature(metricId)}
                    className={`rounded-full px-3 py-1 text-xs font-medium ${
                      settings.enabled
                        ? "bg-green-600 text-white"
                        : "bg-gray-800 text-gray-400"
                    }`}
                  >
                    {settings.enabled ? "Enabled" : "Hidden"}
                  </button>
                </div>

                <div className="grid grid-cols-3 gap-2">
                  {(["mild", "moderate", "severe"] as const).map((thresholdKey) => (
                    <label key={thresholdKey} className="text-xs text-gray-400">
                      <span className="mb-1 block capitalize">{thresholdKey}</span>
                      <input
                        type="number"
                        step="0.1"
                        value={settings.thresholds[thresholdKey]}
                        onChange={(event) => updateThreshold(metricId, thresholdKey, event.target.value)}
                        className="w-full rounded-lg bg-gray-800 px-3 py-2 text-white focus:outline-none focus:ring-2 focus:ring-green-500"
                      />
                    </label>
                  ))}
                </div>
              </div>
            );
          })}
        </section>

        <section className="space-y-3">
          <h2 className="text-sm font-medium text-gray-400">Frame Traces</h2>
          {getTimelineMetricOrder().map((metricId) => {
            const definition = definitionFor(metricId);
            return (
              <div key={metricId} className="bg-gray-900 rounded-xl p-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <Link href={`/settings/metrics/${metricId}`} className="text-sm font-medium text-white underline-offset-2 hover:underline">
                      {definition?.label ?? metricId}
                    </Link>
                    <p className="text-xs text-gray-400 mt-1">{definition?.shortDescription}</p>
                  </div>
                  <button
                    onClick={() => toggleTimeline(metricId)}
                    className={`rounded-full px-3 py-1 text-xs font-medium ${
                      preferences.timelines[metricId].enabled
                        ? "bg-green-600 text-white"
                        : "bg-gray-800 text-gray-400"
                    }`}
                  >
                    {preferences.timelines[metricId].enabled ? "Enabled" : "Hidden"}
                  </button>
                </div>
              </div>
            );
          })}
        </section>

        <button
          onClick={handleSave}
          disabled={saving}
          className="w-full rounded-xl bg-green-600 py-3 text-sm font-medium text-white active:bg-green-700 disabled:opacity-60"
        >
          {saving ? "Saving..." : "Save Settings"}
        </button>

        {status && (
          <p className="text-center text-xs text-gray-400">{status}</p>
        )}
      </div>
    </div>
  );
}
