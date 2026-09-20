"use client";

import { useState, type ReactNode } from "react";
import { fieldLabel, humanizeFields } from "@/lib/agent/labels";
import type { Escalation, EscalationKind } from "@/lib/agent/types";
import { Badge, Button, Card, Meter, type Tone } from "@/components/ui/primitives";

type Action = "approve" | "correct" | "reject";

const KIND_COPY: Record<EscalationKind, { label: string; tone: Tone }> = {
  ambiguous_mapping: { label: "Column mapping", tone: "amber" },
  ambiguous_structure: { label: "Column format", tone: "amber" },
  ambiguous_date: { label: "Date format", tone: "accent" },
  merge_conflict: { label: "Files disagree", tone: "accent" },
  validation_failure: { label: "Needs a value", tone: "accent" },
  unknown_enum: { label: "Unknown value", tone: "accent" },
};

export function DecisionCard({
  item,
  onResolve,
  retried = false,
  rejection = "",
}: {
  item: Escalation;
  onResolve: (id: string, action: Action, payload?: Record<string, unknown>) => void;
  /** The consultant already answered this one and the agent sent it back. */
  retried?: boolean;
  /** The agent refused the last answer outright, with this reason. */
  rejection?: string;
}) {
  const kind = KIND_COPY[item.kind];
  const isMapping = item.kind === "ambiguous_mapping";

  return (
    <Card className="border-l-4 border-l-accent">
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <Badge tone={kind.tone}>{kind.label}</Badge>
        {isMapping ? (
          <span className="text-xs text-muted">Every row in this file waits on this answer</span>
        ) : (
          <span className="text-xs text-muted">Could not be cleaned from the source files</span>
        )}
      </div>

      <h3 className="text-base font-semibold text-navy">{humanizeFields(item.title)}</h3>
      <p className="mt-1 text-sm leading-6 text-muted">{humanizeFields(item.why)}</p>

      {rejection ? (
        <p className="mt-3 rounded-lg border border-[#f0cfcb] bg-danger-soft px-3 py-2 text-sm leading-6 text-danger">
          {rejection}
        </p>
      ) : retried ? (
        <p className="mt-3 rounded-lg border border-[#e9d8b4] bg-amber-soft px-3 py-2 text-xs leading-5 text-amber">
          Your last answer could not be used. Please try a different value.
        </p>
      ) : null}

      <Context item={item} />

      <div className="mt-4 border-t border-stroke pt-4">
        <p className="mb-2 text-[11px] uppercase tracking-wide text-subtle">Your call</p>
        <Actions item={item} onResolve={onResolve} />
      </div>
    </Card>
  );
}

function Context({ item }: { item: Escalation }) {
  const rows: Array<{ label: string; value: ReactNode }> = [];
  const context = item.context;

  if (context.file) {
    rows.push({
      label: "Source",
      value: (
        <span>
          <span className="text-navy">{String(context.column)}</span> in {String(context.file)}
        </span>
      ),
    });
  }
  if (context.name) rows.push({ label: "Person", value: String(context.name) });
  if (context.field) rows.push({ label: "Darwinbox field", value: fieldLabel(String(context.field)) });
  if (context.original) {
    rows.push({
      label: "Value in the file",
      value: <code className="rounded bg-surface-sunk px-1.5 py-0.5 text-[12px] text-navy">{String(context.original)}</code>,
    });
  }

  const samples = (context.samples as Array<string | undefined> | undefined)?.filter(Boolean) as string[] | undefined;
  if (samples?.length) {
    rows.push({
      label: "Sample values",
      value: (
        <span className="flex flex-wrap gap-1">
          {samples.slice(0, 6).map((sample, index) => (
            <code key={`${sample}-${index}`} className="rounded bg-surface-sunk px-1.5 py-0.5 text-[12px] text-navy">
              {sample}
            </code>
          ))}
        </span>
      ),
    });
  }

  const sources = context.sources as Array<{ file: string; rowNumber: number }> | undefined;
  if (sources?.length) {
    rows.push({
      label: "Came from",
      value: sources.map((source) => `${source.file} row ${source.rowNumber}`).join(" · "),
    });
  }

  if (!rows.length) return null;

  return (
    <dl className="mt-3 grid gap-x-6 gap-y-1.5 rounded-lg bg-surface-muted px-3 py-2.5 sm:grid-cols-[150px_minmax(0,1fr)]">
      {rows.map((row) => (
        <div key={row.label} className="contents">
          <dt className="text-xs text-subtle">{row.label}</dt>
          <dd className="text-xs leading-5 text-muted">{row.value}</dd>
        </div>
      ))}
    </dl>
  );
}

function Actions({
  item,
  onResolve,
}: {
  item: Escalation;
  onResolve: (id: string, action: Action, payload?: Record<string, unknown>) => void;
}) {
  const [value, setValue] = useState(String(item.suggestion.payload.value ?? ""));

  if (item.kind === "ambiguous_mapping") {
    const candidates =
      (item.context.candidates as Array<{ field: string; score: number }> | undefined)?.filter((c) => c.field) ?? [];
    const choices = candidates.length
      ? candidates.slice(0, 3)
      : [{ field: String(item.suggestion.payload.targetField ?? ""), score: 1 }];
    return (
      <div className="flex flex-wrap items-center gap-2">
        {choices.map((choice, index) => (
          <button
            key={choice.field}
            onClick={() =>
              onResolve(item.id, index === 0 ? "approve" : "correct", {
                ...item.suggestion.payload,
                targetField: choice.field,
              })
            }
            className={`flex items-center gap-2 rounded-lg border px-3 py-2 text-sm transition-colors ${
              index === 0
                ? "border-navy bg-navy text-white hover:bg-[#2b3846]"
                : "border-stroke bg-surface text-navy hover:border-stroke-strong"
            }`}
          >
            <span className="font-medium">{fieldLabel(choice.field)}</span>
            <Meter value={choice.score} tone={index === 0 ? "teal" : "neutral"} />
            <span className={index === 0 ? "text-xs text-white/70" : "text-xs text-subtle"}>
              {Math.round(choice.score * 100)}%
            </span>
          </button>
        ))}
        <Button variant="ghost" onClick={() => onResolve(item.id, "reject", item.suggestion.payload)}>
          Do not import this column
        </Button>
      </div>
    );
  }

  if (item.kind === "merge_conflict") {
    const options = (item.context.options as Array<{ value: string; from: string }> | undefined) ?? [];
    return (
      <div className="flex flex-wrap items-center gap-2">
        {options.map((option, index) => (
          <button
            key={option.value}
            onClick={() =>
              onResolve(item.id, index === 0 ? "approve" : "correct", {
                ...item.suggestion.payload,
                value: option.value,
              })
            }
            className={`rounded-lg border px-3 py-2 text-sm transition-colors ${
              index === 0
                ? "border-navy bg-navy text-white hover:bg-[#2b3846]"
                : "border-stroke bg-surface text-navy hover:border-stroke-strong"
            }`}
          >
            {option.value}
            {option.from ? (
              <span className={index === 0 ? "ml-1.5 text-xs text-white/70" : "ml-1.5 text-xs text-subtle"}>
                from {option.from}
              </span>
            ) : null}
          </button>
        ))}
      </div>
    );
  }

  const options = (item.context.options as string[] | undefined)?.filter((option) => typeof option === "string");

  return (
    <div className="flex flex-wrap items-center gap-2">
      {options?.length ? (
        options.map((option) => (
          <button
            key={option}
            onClick={() =>
              onResolve(item.id, "correct", { ...item.suggestion.payload, value: option, dateOrder: option })
            }
            className="rounded-lg border border-stroke bg-surface px-3 py-2 text-sm text-navy transition-colors hover:border-stroke-strong"
          >
            {option}
          </button>
        ))
      ) : (
        <>
          <input
            className="w-56 rounded-lg border border-stroke bg-surface px-3 py-2 text-sm placeholder:text-subtle"
            placeholder={placeholderFor(String(item.context.field ?? ""))}
            value={value}
            onChange={(event) => setValue(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter" && value.trim()) {
                onResolve(item.id, "correct", { ...item.suggestion.payload, value });
              }
            }}
          />
          <Button
            variant="primary"
            disabled={!value.trim()}
            onClick={() => onResolve(item.id, "correct", { ...item.suggestion.payload, value })}
          >
            Save value
          </Button>
        </>
      )}
      <Button variant="ghost" onClick={() => onResolve(item.id, "reject", item.suggestion.payload)}>
        Skip this person
      </Button>
    </div>
  );
}

function placeholderFor(field: string): string {
  if (field === "hireDate" || field === "dateOfBirth") return "DD/MM/YYYY";
  if (field === "email") return "name@company.com";
  if (field === "phoneNumber") return "+91 98765 00000";
  return `Correct ${fieldLabel(field).toLowerCase()}`;
}
