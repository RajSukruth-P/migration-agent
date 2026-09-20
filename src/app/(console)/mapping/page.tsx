"use client";

import { useMemo, useState } from "react";
import { useJob } from "@/components/job/JobProvider";
import { fieldLabel } from "@/lib/agent/labels";
import { TARGET_FIELDS, type FieldMapping } from "@/lib/agent/types";
import {
  Badge,
  Card,
  CardHeader,
  EmptyState,
  FilterChips,
  Meter,
  PageHeader,
  type Tone,
} from "@/components/ui/primitives";

type Filter = "all" | "auto" | "open" | "human" | "ignored";

export default function MappingPage() {
  const { job, restoring } = useJob();
  const [filter, setFilter] = useState<Filter>("all");
  const [file, setFile] = useState<string>("all");

  const mappings = useMemo(() => job?.mappings ?? [], [job]);
  const counts = useMemo(
    () => ({
      all: mappings.length,
      auto: mappings.filter((m) => m.status === "auto").length,
      open: mappings.filter((m) => m.status === "escalated").length,
      human: mappings.filter((m) => m.status === "human").length,
      ignored: mappings.filter((m) => m.status === "ignored").length,
    }),
    [mappings],
  );

  if (restoring) return <p className="py-20 text-center text-sm text-muted">Reconnecting to the run…</p>;

  if (!job || !mappings.length) {
    return (
      <Card padded={false}>
        <EmptyState
          title="No mapping yet"
          body="Start a run from the header. The agent sends each file's column names, the Darwinbox schema and 20–50 sample rows to the model, then shows every decision here."
        />
      </Card>
    );
  }

  const rows = mappings
    .filter((mapping) => (file === "all" ? true : mapping.sourceFile === file))
    .filter((mapping) => {
      if (filter === "all") return true;
      if (filter === "open") return mapping.status === "escalated";
      return mapping.status === filter;
    });

  return (
    <div className="space-y-5">
      <PageHeader
        title="Column mapping"
        description="Every source column and what the agent did with it. Mappings at or above 80% confidence — or with a clear winner — are applied without asking; leftover columns are ignored on purpose."
      />

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {job.files.map((source) => {
          const forFile = mappings.filter((mapping) => mapping.sourceFile === source.name);
          const applied = forFile.filter((m) => m.status === "auto" || m.status === "human").length;
          const waiting = forFile.filter((m) => m.status === "escalated").length;
          return (
            <button
              key={source.name}
              onClick={() => setFile(file === source.name ? "all" : source.name)}
              className={`rounded-xl border px-4 py-3 text-left transition-colors ${
                file === source.name ? "border-navy bg-surface" : "border-stroke bg-surface hover:border-stroke-strong"
              }`}
            >
              <p className="truncate text-sm font-medium text-navy">{source.name}</p>
              <p className="mt-0.5 text-xs text-muted">
                {source.rows} rows · {source.columns.length} columns
              </p>
              <div className="mt-2 flex flex-wrap gap-1.5">
                <Badge tone="teal">{applied} mapped</Badge>
                {waiting ? <Badge tone="accent">{waiting} needs you</Badge> : null}
                <Badge tone="neutral">{forFile.filter((m) => m.status === "ignored").length} ignored</Badge>
              </div>
            </button>
          );
        })}
      </div>

      <Card padded={false}>
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-stroke px-5 py-3">
          <FilterChips<Filter>
            value={filter}
            onChange={setFilter}
            options={[
              { value: "all", label: "All columns", count: counts.all },
              { value: "auto", label: "Applied by agent", count: counts.auto },
              { value: "open", label: "Needs you", count: counts.open },
              { value: "human", label: "You decided", count: counts.human },
              { value: "ignored", label: "Ignored", count: counts.ignored },
            ]}
          />
          {file !== "all" ? (
            <button onClick={() => setFile("all")} className="text-xs text-teal underline-offset-2 hover:underline">
              Clear {file}
            </button>
          ) : null}
        </div>

        <div className="overflow-x-auto">
          <table className="w-full min-w-[760px] text-sm">
            <thead>
              <tr className="border-b border-stroke bg-surface-muted text-left text-[11px] uppercase tracking-wide text-subtle">
                <th className="px-5 py-2 font-medium">Source column</th>
                <th className="px-3 py-2 font-medium">File</th>
                <th className="px-3 py-2 font-medium">Darwinbox field</th>
                <th className="px-3 py-2 font-medium">Confidence</th>
                <th className="px-3 py-2 font-medium">Decided by</th>
                <th className="px-5 py-2 font-medium">Why</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((mapping) => (
                <tr key={mapping.id} className="border-b border-stroke last:border-b-0 hover:bg-surface-muted">
                  <td className="px-5 py-2.5">
                    <span className="font-medium text-navy">{mapping.sourceColumn}</span>
                    {mapping.structure ? (
                      <span className="mt-0.5 block text-[11px] text-subtle">
                        {mapping.structure.valueType}
                        {mapping.structure.dateOrder ? ` · ${mapping.structure.dateOrder}` : ""}
                      </span>
                    ) : null}
                  </td>
                  <td className="px-3 py-2.5 text-xs text-muted">{mapping.sourceFile}</td>
                  <td className="px-3 py-2.5">
                    {mapping.targetField ? (
                      <span className="text-navy">{fieldLabel(mapping.targetField)}</span>
                    ) : (
                      <span className="text-subtle">not imported</span>
                    )}
                  </td>
                  <td className="px-3 py-2.5">
                    <span className="flex items-center gap-2">
                      <Meter value={mapping.confidence} tone={meterTone(mapping)} />
                      <span className="text-xs tabular-nums text-muted">
                        {Math.round(mapping.confidence * 100)}%
                      </span>
                    </span>
                    {mapping.sampleSize ? (
                      <span className="mt-0.5 block text-[11px] text-subtle">n={mapping.sampleSize}</span>
                    ) : null}
                  </td>
                  <td className="px-3 py-2.5">
                    <Badge tone={statusTone(mapping.status)}>{statusLabel(mapping.status)}</Badge>
                  </td>
                  <td className="px-5 py-2.5 text-xs leading-5 text-muted">
                    <span className="line-clamp-2" title={mapping.reason}>
                      {mapping.reason}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {rows.length === 0 ? <p className="px-5 py-8 text-center text-sm text-muted">No columns in this view.</p> : null}
      </Card>

      <Card>
        <CardHeader
          title="Darwinbox field coverage"
          hint="Which source columns feed each target field after reconciliation"
        />
        <ul className="grid gap-x-8 gap-y-2 sm:grid-cols-2">
          {TARGET_FIELDS.map((field) => {
            const sources = mappings.filter(
              (mapping) =>
                (mapping.status === "auto" || mapping.status === "human") &&
                (mapping.targetField === field ||
                  (mapping.targetField === "fullName" && (field === "firstName" || field === "lastName"))),
            );
            const waiting = mappings.some(
              (mapping) =>
                mapping.status === "escalated" &&
                (mapping.targetField === field || mapping.candidates.some((c) => c.field === field)),
            );
            const labels = [...new Set(sources.map((mapping) => mapping.sourceColumn))];
            return (
              <li key={field} className="flex items-baseline justify-between gap-3 border-b border-stroke py-1.5">
                <span className="shrink-0 text-sm text-navy">{fieldLabel(field)}</span>
                <span className={`truncate text-right text-xs ${waiting ? "text-accent" : "text-muted"}`}>
                  {waiting ? "waiting on your decision" : labels.join(", ") || "no source column"}
                </span>
              </li>
            );
          })}
        </ul>
      </Card>
    </div>
  );
}

function statusLabel(status: FieldMapping["status"]): string {
  if (status === "auto") return "Agent";
  if (status === "human") return "You";
  if (status === "escalated") return "Needs you";
  return "Ignored";
}

function statusTone(status: FieldMapping["status"]): Tone {
  if (status === "auto") return "teal";
  if (status === "human") return "amber";
  if (status === "escalated") return "accent";
  return "neutral";
}

function meterTone(mapping: FieldMapping): Tone {
  if (mapping.status === "escalated") return "accent";
  if (mapping.status === "ignored") return "neutral";
  return "teal";
}
