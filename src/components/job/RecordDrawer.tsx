"use client";

import { useEffect, useState } from "react";
import { auditFor } from "@/lib/agent/audit";
import { compareRecord } from "@/lib/agent/compare";
import { humanizeFields } from "@/lib/agent/labels";
import type { CanonicalRecord, Escalation, FieldMapping } from "@/lib/agent/types";
import { Badge, Button, type Tone } from "@/components/ui/primitives";
import { recordStatus } from "./recordStatus";

export function RecordDrawer({
  record,
  mappings,
  escalations,
  onClose,
}: {
  record: CanonicalRecord | null;
  mappings: FieldMapping[];
  escalations: Escalation[];
  onClose: () => void;
}) {
  const [showRaw, setShowRaw] = useState(false);

  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  if (!record) return null;

  const rows = compareRecord(record, mappings);
  const steps = auditFor(record, mappings, escalations);
  const status = recordStatus(record);
  const name = `${record.data.firstName ?? ""} ${record.data.lastName ?? ""}`.trim() || record.data.email || "Record";
  const changed = rows.filter((row) => row.changed).length;

  return (
    <>
      <div className="fixed inset-0 z-40 bg-navy/15" onClick={onClose} aria-hidden />
      <aside className="drawer-in fixed inset-y-0 right-0 z-50 flex w-full max-w-xl flex-col border-l border-stroke bg-surface shadow-xl">
        <header className="flex items-start justify-between gap-4 border-b border-stroke px-6 py-4">
          <div className="min-w-0">
            <h2 className="truncate text-lg font-semibold text-navy">{name}</h2>
            <p className="mt-0.5 flex items-center gap-2 text-xs text-muted">
              <Badge tone={status.tone}>{status.label}</Badge>
              {record.data.email || "no email"}
            </p>
          </div>
          <Button variant="ghost" size="sm" onClick={onClose}>
            Close
          </Button>
        </header>

        <div className="min-h-0 flex-1 overflow-y-auto px-6 py-5">
          <Section
            title="Came from"
            hint={
              record.sourceRows.length > 1
                ? `${record.sourceRows.length} source rows merged into one person`
                : "one source row"
            }
            action={
              <button
                onClick={() => setShowRaw((value) => !value)}
                className="text-xs text-teal underline-offset-2 hover:underline"
              >
                {showRaw ? "Hide raw values" : "Show raw values"}
              </button>
            }
          >
            <ul className="space-y-2">
              {record.sourceRows.map((source) => (
                <li key={`${source.file}-${source.rowNumber}`} className="rounded-lg border border-stroke px-3 py-2">
                  <p className="text-sm text-navy">
                    {source.file} <span className="text-muted">row {source.rowNumber}</span>
                  </p>
                  {showRaw ? (
                    <dl className="mt-2 grid grid-cols-[minmax(0,140px)_minmax(0,1fr)] gap-x-3 gap-y-1">
                      {Object.entries(source.values).map(([column, value]) => (
                        <div key={column} className="contents">
                          <dt className="truncate text-[11px] text-subtle">{column}</dt>
                          <dd className="truncate font-mono text-[11px] text-muted">{value || "—"}</dd>
                        </div>
                      ))}
                    </dl>
                  ) : null}
                </li>
              ))}
            </ul>
          </Section>

          <Section
            title="Original vs Darwinbox"
            hint={changed ? `${changed} value${changed === 1 ? "" : "s"} changed during cleanup` : "nothing changed"}
          >
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-stroke text-left text-[11px] uppercase tracking-wide text-subtle">
                  <th className="pb-1.5 font-medium">Field</th>
                  <th className="pb-1.5 font-medium">In the file</th>
                  <th className="pb-1.5 font-medium">In Darwinbox</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr key={row.field} className="border-b border-stroke last:border-b-0 align-top">
                    <td className="py-2 pr-3">
                      <span className="block text-xs text-navy">{row.label}</span>
                      {row.originColumn ? (
                        <span className="block text-[11px] text-subtle">
                          {row.originColumn} · {row.originFile}
                        </span>
                      ) : null}
                    </td>
                    <td className="py-2 pr-3 text-xs text-muted">{row.original || "—"}</td>
                    <td className={`py-2 text-xs ${row.changed ? "font-medium text-teal" : "text-navy"}`}>
                      {row.migrated || "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Section>

          <Section title="Audit trail" hint="What the agent did with this person, in order">
            <ol className="space-y-2">
              {steps.map((step, index) => (
                <li key={`${step.text}-${index}`} className="flex gap-2.5">
                  <span className="mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-surface-sunk text-[10px] text-muted">
                    {index + 1}
                  </span>
                  <span
                    className={`text-xs leading-5 ${
                      step.tone === "warn" ? "text-accent" : step.tone === "ok" ? "text-navy" : "text-muted"
                    }`}
                  >
                    {step.text}
                  </span>
                </li>
              ))}
            </ol>
          </Section>

          {record.issues.length ? (
            <Section
              title={record.status === "blocked" ? "Why this is held back" : "Notes"}
              hint={
                record.status === "blocked"
                  ? "Resolve these on the Decisions tab"
                  : "Judgement calls the agent made without asking"
              }
            >
              <ul className="space-y-1">
                {record.issues.map((issue) => (
                  <li key={issue} className="text-xs leading-5 text-accent">
                    {humanizeFields(issue)}
                  </li>
                ))}
              </ul>
            </Section>
          ) : null}

          {record.push ? (
            <Section title="Push result" hint={`${record.push.attempts} attempt${record.push.attempts === 1 ? "" : "s"}`}>
              <p className={`text-xs leading-5 ${record.push.ok ? "text-teal" : "text-danger"}`}>
                {record.push.ok
                  ? `Written to the tenant as ${record.push.targetId}`
                  : record.push.error || "Push failed"}
              </p>
            </Section>
          ) : null}
        </div>
      </aside>
    </>
  );
}

function Section({
  title,
  hint,
  action,
  children,
}: {
  title: string;
  hint?: string;
  action?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section className="mb-6 last:mb-0">
      <div className="mb-2 flex items-baseline justify-between gap-3">
        <div>
          <h3 className="text-xs font-semibold uppercase tracking-wide text-navy">{title}</h3>
          {hint ? <p className="text-[11px] text-subtle">{hint}</p> : null}
        </div>
        {action}
      </div>
      {children}
    </section>
  );
}

export type { Tone };
