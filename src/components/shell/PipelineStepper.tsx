"use client";

import type { JobPhase } from "@/lib/agent/types";
import { STAGES, stageStates, type StageState } from "./stages";

export function PipelineStepper({ phase, compact = false }: { phase: JobPhase | null; compact?: boolean }) {
  const states = stageStates(phase);

  return (
    <ol className="flex flex-wrap items-stretch gap-1">
      {STAGES.map((stage, index) => {
        const state = states[index];
        return (
          <li key={stage.id} className="flex min-w-0 flex-1 items-center gap-1">
            <div
              className={`min-w-0 flex-1 rounded-lg border px-3 ${compact ? "py-1.5" : "py-2"} ${shell(state)}`}
            >
              <div className="flex items-center gap-2">
                <Marker state={state} index={index} />
                <span className={`truncate text-xs font-medium ${label(state)}`}>{stage.label}</span>
              </div>
              {compact ? null : (
                <p className="mt-0.5 hidden truncate pl-6 text-[11px] text-subtle xl:block">{stage.hint}</p>
              )}
            </div>
          </li>
        );
      })}
    </ol>
  );
}

function Marker({ state, index }: { state: StageState; index: number }) {
  if (state === "done") {
    return (
      <span className="flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-teal text-[9px] font-bold text-white">
        ✓
      </span>
    );
  }
  if (state === "active") {
    return <span className="live-dot h-4 w-4 shrink-0 rounded-full border-2 border-teal bg-teal-soft" />;
  }
  if (state === "failed") {
    return (
      <span className="flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-danger text-[9px] font-bold text-white">
        !
      </span>
    );
  }
  return (
    <span className="flex h-4 w-4 shrink-0 items-center justify-center rounded-full border border-stroke-strong text-[9px] text-subtle">
      {index + 1}
    </span>
  );
}

function shell(state: StageState): string {
  if (state === "active") return "border-teal bg-teal-soft/50";
  if (state === "done") return "border-stroke bg-surface";
  if (state === "failed") return "border-danger bg-danger-soft";
  return "border-dashed border-stroke bg-surface-muted";
}

function label(state: StageState): string {
  if (state === "active") return "text-teal";
  if (state === "todo") return "text-subtle";
  if (state === "failed") return "text-danger";
  return "text-navy";
}
