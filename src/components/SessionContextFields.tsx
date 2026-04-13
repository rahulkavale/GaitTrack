"use client";

import type { SessionContext } from "@/lib/types";

interface SessionContextFieldsProps {
  value: SessionContext;
  onChange: (next: SessionContext) => void;
  saving?: boolean;
  title?: string;
  description?: string;
}

export function hasMeaningfulSessionContext(context: SessionContext) {
  return (
    context.afo !== "unknown" ||
    context.footwear !== "unknown" ||
    context.supportLevel !== "unknown" ||
    context.environment !== "unknown" ||
    context.painLevel != null ||
    context.fatigueToday !== "unknown"
  );
}

export function SessionContextFields({
  value,
  onChange,
  saving = false,
  title = "Session Context",
  description = "Add the conditions for this recording so future comparisons stay meaningful.",
}: SessionContextFieldsProps) {
  return (
    <div className="space-y-3">
      <div>
        <h3 className="text-sm font-medium text-white">{title}</h3>
        <p className="mt-1 text-xs text-gray-400">{description}</p>
      </div>

      <div className="grid grid-cols-2 gap-2">
        <label className="text-xs text-gray-400">
          AFO
          <select
            value={value.afo}
            onChange={(e) => onChange({ ...value, afo: e.target.value as SessionContext["afo"] })}
            className="mt-1 w-full rounded-lg bg-gray-800 px-3 py-2 text-sm text-white"
          >
            <option value="unknown">Unknown</option>
            <option value="on">On</option>
            <option value="off">Off</option>
            <option value="not_applicable">Not applicable</option>
          </select>
        </label>
        <label className="text-xs text-gray-400">
          Footwear
          <select
            value={value.footwear}
            onChange={(e) => onChange({ ...value, footwear: e.target.value as SessionContext["footwear"] })}
            className="mt-1 w-full rounded-lg bg-gray-800 px-3 py-2 text-sm text-white"
          >
            <option value="unknown">Unknown</option>
            <option value="barefoot">Barefoot</option>
            <option value="shoes">Shoes</option>
            <option value="orthotics">Orthotics</option>
          </select>
        </label>
        <label className="text-xs text-gray-400">
          Support
          <select
            value={value.supportLevel}
            onChange={(e) => onChange({ ...value, supportLevel: e.target.value as SessionContext["supportLevel"] })}
            className="mt-1 w-full rounded-lg bg-gray-800 px-3 py-2 text-sm text-white"
          >
            <option value="unknown">Unknown</option>
            <option value="independent">Independent</option>
            <option value="hand_support">Hand support</option>
            <option value="walker">Walker</option>
            <option value="other">Other</option>
          </select>
        </label>
        <label className="text-xs text-gray-400">
          Environment
          <select
            value={value.environment}
            onChange={(e) => onChange({ ...value, environment: e.target.value as SessionContext["environment"] })}
            className="mt-1 w-full rounded-lg bg-gray-800 px-3 py-2 text-sm text-white"
          >
            <option value="unknown">Unknown</option>
            <option value="indoor">Indoor</option>
            <option value="outdoor">Outdoor</option>
          </select>
        </label>
        <label className="text-xs text-gray-400">
          Pain today
          <input
            type="number"
            min={0}
            max={10}
            value={value.painLevel ?? ""}
            onChange={(e) =>
              onChange({
                ...value,
                painLevel: e.target.value === "" ? null : Math.max(0, Math.min(10, Number(e.target.value))),
              })
            }
            placeholder="0-10"
            className="mt-1 w-full rounded-lg bg-gray-800 px-3 py-2 text-sm text-white placeholder:text-gray-500"
          />
        </label>
        <label className="text-xs text-gray-400">
          Fatigue today
          <select
            value={value.fatigueToday}
            onChange={(e) => onChange({ ...value, fatigueToday: e.target.value as SessionContext["fatigueToday"] })}
            className="mt-1 w-full rounded-lg bg-gray-800 px-3 py-2 text-sm text-white"
          >
            <option value="unknown">Unknown</option>
            <option value="low">Low</option>
            <option value="medium">Medium</option>
            <option value="high">High</option>
          </select>
        </label>
      </div>
      {saving && <p className="text-xs text-gray-500">Saving session context...</p>}
    </div>
  );
}
