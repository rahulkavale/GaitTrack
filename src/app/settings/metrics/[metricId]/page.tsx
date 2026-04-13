"use client";

import { use } from "react";
import { useRouter } from "next/navigation";
import { getMetricDefinition } from "@/lib/metric-settings";

export default function MetricDetailPage({
  params,
}: {
  params: Promise<{ metricId: string }>;
}) {
  const { metricId } = use(params);
  const router = useRouter();
  const definition = getMetricDefinition(metricId);

  if (!definition) {
    return (
      <div className="min-h-screen bg-gray-950 text-white flex items-center justify-center p-6">
        <div className="text-center">
          <p className="text-sm text-gray-400">Metric definition not found.</p>
          <button onClick={() => router.push("/settings")} className="mt-4 text-sm text-green-400">
            Back to settings
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-950 text-white pb-10">
      <div className="bg-gray-900 p-4 safe-top">
        <button onClick={() => router.push("/settings")} className="text-green-400 text-sm mb-2">
          &larr; Back to settings
        </button>
        <p className="text-xs uppercase tracking-[0.2em] text-gray-500">{definition.kind}</p>
        <h1 className="text-2xl font-bold mt-1">{definition.label}</h1>
        <p className="text-sm text-gray-400 mt-2">{definition.shortDescription}</p>
      </div>

      <div className="p-4 space-y-4">
        <div className="bg-gray-900 rounded-xl p-4">
          <h2 className="text-sm font-medium text-white mb-2">What It Measures</h2>
          <p className="text-sm text-gray-300">{definition.detailDescription}</p>
        </div>

        <div className="bg-gray-900 rounded-xl p-4">
          <h2 className="text-sm font-medium text-white mb-2">Inputs</h2>
          <ul className="space-y-1 text-sm text-gray-300">
            {definition.inputs.map((input) => (
              <li key={input}>• {input}</li>
            ))}
          </ul>
        </div>

        <div className="bg-gray-900 rounded-xl p-4">
          <h2 className="text-sm font-medium text-white mb-2">Formula / Logic</h2>
          <p className="text-sm text-gray-300">{definition.formula}</p>
        </div>

        <div className="bg-gray-900 rounded-xl p-4">
          <h2 className="text-sm font-medium text-white mb-2">Source</h2>
          <p className="text-sm text-gray-300">{definition.source}</p>
        </div>
      </div>
    </div>
  );
}
