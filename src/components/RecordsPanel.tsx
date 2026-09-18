"use client";

import { auditSummary } from "@/lib/agent/audit";
import type { CanonicalRecord, JobPhase } from "@/lib/agent/types";

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
    <section className="flex h-full min-h-0 flex-col overflow-hidden">
      <div className="grid shrink-0 grid-cols-[minmax(0,1.2fr)_minmax(0,1.4fr)_88px_minmax(0,1.1fr)] gap-3 border-b border-stroke px-4 py-2 text-xs text-muted">
        <span>Name</span>
        <span>Email</span>
        <span>Status</span>
        <span>Audit</span>
      </div>
      {rows.length ? (
        <ul
          className="grid min-h-0 flex-1 overflow-hidden"
          style={{ gridTemplateRows: `repeat(${rows.length}, minmax(0, 1fr))` }}
        >
          {rows.map((record) => {
            const active = record.id === selectedId;
            return (
              <li key={record.id} className="min-h-0 border-b border-stroke last:border-b-0">
                <button
                  onClick={() => onSelect(record.id)}
                  className={`grid h-full w-full grid-cols-[minmax(0,1.2fr)_minmax(0,1.4fr)_88px_minmax(0,1.1fr)] items-center gap-3 px-4 text-left text-xs ${
                    active ? "bg-[#f4f1ec]" : "bg-white"
                  }`}
                >
                  <span className="truncate font-medium text-navy">
                    {record.data.firstName} {record.data.lastName}
                  </span>
                  <span className="truncate text-muted">{record.data.email || "No email"}</span>
                  <span className="truncate text-muted">{statusLabel(record)}</span>
                  <span className="truncate text-muted">{auditSummary(record)}</span>
                </button>
              </li>
            );
          })}
        </ul>
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
