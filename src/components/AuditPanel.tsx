"use client";

import { auditFor } from "@/lib/agent/audit";
import type { CanonicalRecord, Escalation, FieldMapping } from "@/lib/agent/types";

export function AuditPanel({
  record,
  mappings,
  escalations,
  mappingPending,
}: {
  record: CanonicalRecord | null;
  mappings: FieldMapping[];
  escalations: Escalation[];
  mappingPending?: boolean;
}) {
  const steps = record ? auditFor(record, mappings, escalations) : [];

  return (
    <section className="flex h-full min-h-0 flex-col overflow-hidden border-t border-stroke bg-white">
      <div className="shrink-0 px-4 py-2">
        <h2 className="text-sm font-semibold text-navy">Row audit trail</h2>
        <p className="truncate text-xs text-muted">
          {record
            ? `${record.data.firstName ?? ""} ${record.data.lastName ?? ""}`.trim() || record.data.email || "Selected row"
            : mappingPending
              ? "Waiting for column mapping"
              : "Select a person to see what the agent did"}
        </p>
      </div>
      {steps.length ? (
        <ol
          className="grid min-h-0 flex-1 overflow-hidden px-4 pb-3"
          style={{ gridTemplateRows: `repeat(${Math.min(steps.length, 5)}, minmax(0, 1fr))` }}
        >
          {steps.slice(0, 5).map((step, index) => (
            <li key={`${step.text}-${index}`} className="flex min-h-0 items-center overflow-hidden text-xs">
              <span
                className={`truncate ${step.tone === "warn" ? "text-accent" : step.tone === "ok" ? "text-teal" : "text-muted"}`}
                title={step.text}
              >
                {index + 1}. {step.text}
              </span>
            </li>
          ))}
        </ol>
      ) : (
        <p className="px-4 text-xs text-muted">
          {mappingPending
            ? "I’ll write a trail for each row after mapping is confirmed."
            : "No row selected yet."}
        </p>
      )}
    </section>
  );
}
