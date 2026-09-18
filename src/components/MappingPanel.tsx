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
  const received = files.length
    ? files.map((file) => `${file.name.replace(/\.(csv|xlsx|xls)$/i, "")} (${file.rows})`).join(", ")
    : "";

  return (
    <section className="flex h-full min-h-0 flex-col overflow-hidden border-r border-stroke bg-white">
      <div className="shrink-0 border-b border-stroke px-4 py-3">
        <h2 className="text-sm font-semibold text-navy">Column mapping</h2>
        <p className="truncate text-xs text-teal">
          {received ? `Received ${files.length} file${files.length === 1 ? "" : "s"}: ${received}` : "Upload a file or run the sample"}
        </p>
        <p className="truncate text-xs text-muted">
          {pending.length
            ? `${pending.length} column${pending.length === 1 ? "" : "s"} need${pending.length === 1 ? "s" : ""} you · rows waiting`
            : mappings.length
              ? `${TARGET_FIELDS.length} Darwinbox fields${skipped ? ` · ${skipped} skipped` : ""}`
              : "Darwinbox schema"}
        </p>
      </div>
      <ul
        className="grid min-h-0 flex-1 overflow-hidden"
        style={{ gridTemplateRows: `repeat(${TARGET_FIELDS.length}, minmax(0, 1fr))` }}
      >
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
          return (
            <li
              key={field}
              className="flex min-h-0 items-center justify-between gap-3 overflow-hidden border-b border-stroke px-4 last:border-b-0"
            >
              <span className="shrink-0 text-xs text-navy">{fieldLabel(field)}</span>
              <span className="truncate text-right text-[11px] leading-none text-muted">
                {waiting.length
                  ? `${unique(waiting.map((item) => item.sourceColumn)).join(", ")} · needs you`
                  : labels.length
                    ? `${labels.join(", ")}${human ? " · you" : ""}`
                    : "—"}
              </span>
            </li>
          );
        })}
      </ul>
    </section>
  );
}

function unique(values: string[]): string[] {
  return [...new Set(values)];
}
