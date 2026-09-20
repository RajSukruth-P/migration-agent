import type { JobPhase } from "@/lib/agent/types";

export interface Stage {
  id: string;
  label: string;
  hint: string;
  phases: JobPhase[];
}

/** The run in five steps a consultant can name, not eleven internal phases. */
export const STAGES: Stage[] = [
  { id: "files", label: "Read files", hint: "Ingest every export", phases: ["ingesting"] },
  { id: "columns", label: "Map columns", hint: "Source columns to Darwinbox fields", phases: ["mapping", "awaiting_mapping"] },
  { id: "rows", label: "Clean rows", hint: "Normalize, merge, validate", phases: ["profiling", "cleaning", "reconciling", "validating"] },
  { id: "review", label: "Your review", hint: "Only what cannot be decided", phases: ["awaiting_human"] },
  { id: "push", label: "Push", hint: "Write to Darwinbox, retry, roll back", phases: ["pushing", "complete"] },
];

export type StageState = "done" | "active" | "todo" | "failed";

export function stageStates(phase: JobPhase | null): StageState[] {
  if (!phase || phase === "idle") return STAGES.map(() => "todo");
  if (phase === "complete") return STAGES.map(() => "done");
  if (phase === "failed") return STAGES.map((_, index) => (index === 0 ? "failed" : "todo"));
  const current = STAGES.findIndex((stage) => stage.phases.includes(phase));
  if (current === -1) return STAGES.map(() => "todo");
  return STAGES.map((_, index) => (index < current ? "done" : index === current ? "active" : "todo"));
}

export const PHASE_LABEL: Record<JobPhase, string> = {
  idle: "Waiting for files",
  ingesting: "Reading files",
  mapping: "Mapping columns",
  awaiting_mapping: "Waiting on your column decision",
  profiling: "Reading column formats",
  cleaning: "Cleaning values",
  reconciling: "Merging people across files",
  validating: "Validating records",
  awaiting_human: "Waiting on your review",
  pushing: "Writing to Darwinbox",
  complete: "Run complete",
  failed: "Run failed",
};

export function isRunning(phase: JobPhase | null): boolean {
  if (!phase) return false;
  return !["idle", "awaiting_mapping", "awaiting_human", "complete", "failed"].includes(phase);
}
