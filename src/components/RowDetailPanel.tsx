"use client";

import { useState } from "react";
import { auditFor } from "@/lib/agent/audit";
import { compareRecord, shortFile } from "@/lib/agent/compare";
import type { AgentEvent, CanonicalRecord, Escalation, FieldMapping } from "@/lib/agent/types";
import { ActivityLog } from "./ActivityLog";

type Tab = "audit" | "activity";

export function RowDetailPanel({
  record,
  mappings,
  escalations,
  events,
  mappingPending,
}: {
  record: CanonicalRecord | null;
  mappings: FieldMapping[];
  escalations: Escalation[];
  events: AgentEvent[];
  mappingPending?: boolean;
}) {
  const [tab, setTab] = useState<Tab>("audit");

  const rows = record ? compareRecord(record, mappings) : [];
  const steps = record ? auditFor(record, mappings, escalations) : [];
  const name = record
    ? `${record.data.firstName ?? ""} ${record.data.lastName ?? ""}`.trim() || record.data.email || "Row"
    : "Row detail";
  const origin =
    record?.sourceRows.map((source) => `${shortFile(source.file)} row ${source.rowNumber}`).join("  ·  ") ?? "";

  return (
    <section className="flex h-full min-h-0 flex-col overflow-hidden border-t border-stroke bg-white">
      <div className="flex shrink-0 items-baseline justify-between gap-3 border-b border-stroke px-4 py-2">
        <h2 className="truncate text-sm font-semibold text-navy">{name}</h2>
        <p className="truncate text-xs text-muted">
          {record ? statusText(record) : mappingPending ? "Waiting for column mapping" : "Pick a person"}
        </p>
      </div>

      <div className="flex shrink-0 items-baseline gap-2 border-b border-stroke px-4 py-1.5">
        <span className="shrink-0 text-[10px] uppercase tracking-wide text-muted">Came from</span>
        <span className="truncate text-xs text-teal" title={origin}>
          {origin || "—"}
        </span>
      </div>

      <div className="grid min-h-0 flex-1 grid-cols-[minmax(0,1fr)_240px] overflow-hidden">
        <div className="min-h-0 overflow-y-auto px-4 py-2">
          {record ? (
            <>
              <div className="mb-1 grid grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)_minmax(0,1fr)] gap-2 text-[10px] uppercase tracking-wide text-muted">
                <span>Darwinbox field</span>
                <span>Original</span>
                <span>Migrated</span>
              </div>
              <ul>
                {rows.map((row) => (
                  <li
                    key={row.field}
                    className="grid grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)_minmax(0,1fr)] gap-2 border-b border-stroke py-1 last:border-b-0"
                  >
                    <span className="min-w-0">
                      <span className="block truncate text-xs text-navy">{row.label}</span>
                      {row.originColumn ? (
                        <span
                          className="block truncate text-[10px] text-muted"
                          title={`${row.originColumn} in ${row.originFile}`}
                        >
                          {row.originColumn}
                        </span>
                      ) : null}
                    </span>
                    <span className="truncate text-xs text-muted" title={row.original}>
                      {row.original || "—"}
                    </span>
                    <span className={`truncate text-xs ${row.changed ? "text-teal" : "text-navy"}`} title={row.migrated}>
                      {row.migrated || "—"}
                    </span>
                  </li>
                ))}
              </ul>
            </>
          ) : (
            <p className="text-xs leading-5 text-muted">
              {mappingPending
                ? "Once columns are confirmed I’ll show each row’s original file values next to the migrated Darwinbox record."
                : "Click a person above to compare their original file data with the migrated Darwinbox record."}
            </p>
          )}
        </div>

        <div className="flex min-h-0 flex-col overflow-hidden border-l border-stroke">
          <div className="flex shrink-0 gap-1 border-b border-stroke px-2">
            <TabButton active={tab === "audit"} onClick={() => setTab("audit")}>
              Audit trail
            </TabButton>
            <TabButton active={tab === "activity"} onClick={() => setTab("activity")}>
              Activity{events.length ? ` (${events.length})` : ""}
            </TabButton>
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto px-4 py-2">
            {tab === "audit" ? (
              record ? (
                <ol className="space-y-1">
                  {steps.map((step, index) => (
                    <li key={`${step.text}-${index}`} className="text-[11px] leading-4">
                      <span
                        className={step.tone === "warn" ? "text-accent" : step.tone === "ok" ? "text-teal" : "text-muted"}
                      >
                        {index + 1}. {step.text}
                      </span>
                    </li>
                  ))}
                </ol>
              ) : (
                <p className="text-[11px] text-muted">No row selected.</p>
              )
            ) : (
              <ActivityLog events={events} />
            )}
          </div>
        </div>
      </div>
    </section>
  );
}

function TabButton({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className={`border-b-2 px-1 py-1.5 text-[10px] uppercase tracking-wide ${
        active ? "border-navy text-navy" : "border-transparent text-muted hover:text-navy"
      }`}
    >
      {children}
    </button>
  );
}

function statusText(record: CanonicalRecord): string {
  if (record.status === "pushed") return `In Darwinbox as ${record.push?.targetId ?? "—"}`;
  if (record.status === "failed") return record.push?.error ? `Push failed: ${record.push.error}` : "Push failed";
  if (record.status === "blocked") return "Needs your decision";
  if (record.status === "rolled_back") return "Rolled back";
  return "Ready to push";
}
