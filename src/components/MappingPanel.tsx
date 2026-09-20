"use client";

import { fieldLabel } from "@/lib/agent/labels";
import { TARGET_FIELDS, type FieldMapping, type JobSnapshot } from "@/lib/agent/types";

export function MappingPanel({
  mappings,
  files = [],
}: {
  mappings: FieldMapping[];
  files?: JobSnapshot["files"];
}) {
  const skipped = mappings.filter((mapping) => mapping.status === "ignored").length;
  const pending = mappings.filter((mapping) => mapping.status === "escalated");

  return (
    <section className="flex h-full min-h-0 flex-col overflow-hidden bg-white">
      <div className="shrink-0 border-b border-stroke px-4 py-2">
        <h2 className="text-sm font-semibold text-navy">Files &amp; columns</h2>
        <p className="truncate text-xs text-muted">
          {pending.length
            ? `${pending.length} column${pending.length === 1 ? "" : "s"} need${pending.length === 1 ? "s" : ""} you · rows waiting`
            : mappings.length
              ? `${TARGET_FIELDS.length} Darwinbox fields${skipped ? ` · ${skipped} skipped` : ""}`
              : "Darwinbox schema"}
        </p>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto">
        <div className="border-b border-stroke px-4 py-2">
          <p className="mb-1 text-[10px] uppercase tracking-wide text-muted">Received</p>
          {files.length ? (
            <ul className="space-y-1">
              {files.map((file) => (
                <li key={file.name} className="flex justify-between gap-2 text-xs">
                  <span className="truncate text-teal" title={file.name}>
                    {file.name}
                  </span>
                  <span className="shrink-0 text-muted">{file.rows} rows</span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-xs text-muted">Upload a file or run the sample.</p>
          )}
        </div>

        <div className="px-4 py-2">
          <p className="mb-1 text-[10px] uppercase tracking-wide text-muted">Column mapping</p>
          <ul>
            {TARGET_FIELDS.map((field) => {
              const sources = mappings.filter(
                (mapping) =>
                  (mapping.status === "auto" || mapping.status === "human") &&
                  (mapping.targetField === field ||
                    (field === "firstName" && mapping.targetField === "fullName") ||
                    (field === "lastName" && mapping.targetField === "fullName")),
              );
              const waiting = pending.filter(
                (mapping) =>
                  mapping.targetField === field ||
                  mapping.candidates.some((candidate) => candidate.field === field),
              );
              const labels = unique(sources.map((mapping) => mapping.sourceColumn));
              const human = sources.some((mapping) => mapping.status === "human");
              const detail = waiting.length
                ? `${unique(waiting.map((item) => item.sourceColumn)).join(", ")} · needs you`
                : labels.length
                  ? `${labels.join(", ")}${human ? " · you" : ""}`
                  : "—";
              return (
                <li key={field} className="flex items-baseline justify-between gap-2 py-1">
                  <span className="shrink-0 text-xs text-navy">{fieldLabel(field)}</span>
                  <span
                    className={`truncate text-right text-[11px] ${waiting.length ? "text-accent" : "text-muted"}`}
                    title={detail}
                  >
                    {detail}
                  </span>
                </li>
              );
            })}
          </ul>
        </div>
      </div>
    </section>
  );
}

function unique(values: string[]): string[] {
  return [...new Set(values)];
}
