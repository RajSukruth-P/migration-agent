"use client";

import { sourceFiles } from "@/lib/agent/compare";
import type { CanonicalRecord, JobPhase } from "@/lib/agent/types";

const GRID = "grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)_84px]";

export function RecordsPanel({
  records,
  selectedId,
  onSelect,
  phase,
  mappingPending,
}: {
  records: CanonicalRecord[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  phase: JobPhase | "idle";
  mappingPending: boolean;
}) {
  const rows = records.filter((record) => record.status !== "dropped");

  return (
    <section className="flex h-full min-h-0 flex-col overflow-hidden bg-white">
      <div className="flex shrink-0 items-baseline justify-between gap-3 border-b border-stroke px-4 py-2">
        <h2 className="text-sm font-semibold text-navy">People</h2>
        <p className="truncate text-xs text-muted">{rows.length ? `${rows.length} rows · click for detail` : ""}</p>
      </div>
      {rows.length ? (
        <>
          <div
            className={`grid shrink-0 ${GRID} gap-3 border-b border-stroke bg-background px-4 py-1 text-[10px] uppercase tracking-wide text-muted`}
          >
            <span>Person</span>
            <span>Source file</span>
            <span>Status</span>
          </div>
          <ul className="min-h-0 flex-1 overflow-y-auto">
            {rows.map((record) => {
              const active = record.id === selectedId;
              const files = sourceFiles(record).join(" + ");
              return (
                <li key={record.id}>
                  <button
                    onClick={() => onSelect(record.id)}
                    className={`grid w-full ${GRID} items-center gap-3 border-b border-stroke px-4 py-1.5 text-left ${
                      active ? "bg-[#f1efe9]" : "bg-white hover:bg-[#faf9f6]"
                    }`}
                  >
                    <span className="min-w-0">
                      <span className="block truncate text-xs font-medium text-navy">
                        {record.data.firstName} {record.data.lastName}
                      </span>
                      <span className="block truncate text-[11px] text-muted">
                        {record.data.email || "No email"}
                      </span>
                    </span>
                    <span className="truncate text-[11px] text-muted" title={files}>
                      {files || "—"}
                    </span>
                    <span className={`truncate text-[11px] ${statusTone(record)}`}>{statusLabel(record)}</span>
                  </button>
                </li>
              );
            })}
          </ul>
        </>
      ) : (
        <p className="px-4 py-6 text-sm leading-6 text-muted">{emptyCopy(phase, mappingPending)}</p>
      )}
    </section>
  );
}

function emptyCopy(phase: JobPhase | "idle", mappingPending: boolean): string {
  if (phase === "idle") return "Upload a file or run the sample. I’ll acknowledge it, then map columns.";
  if (phase === "ingesting") return "File received. Reading columns and rows…";
  if (phase === "mapping") return "File received. Mapping columns first — rows wait until that is done.";
  if (mappingPending || phase === "awaiting_mapping") {
    return "Column mapping needs a decision. Row migration starts after you confirm the columns.";
  }
  if (phase === "profiling" || phase === "cleaning" || phase === "reconciling" || phase === "validating") {
    return "Columns are mapped. Migrating rows now…";
  }
  return "People will appear here after rows are migrated.";
}

function statusLabel(record: CanonicalRecord): string {
  if (record.status === "blocked") return "Review";
  if (record.status === "ready") return "Ready";
  if (record.status === "pushed") return record.push?.targetId || "Sent";
  if (record.status === "failed") return "Failed";
  if (record.status === "rolled_back") return "Rolled back";
  return record.status;
}

function statusTone(record: CanonicalRecord): string {
  if (record.status === "blocked" || record.status === "failed") return "text-accent";
  if (record.status === "pushed") return "text-teal";
  return "text-muted";
}
