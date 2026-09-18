"use client";

import { useMemo, useState, type ReactNode } from "react";
import { fieldLabel, humanizeFields } from "@/lib/agent/labels";
import type { Escalation } from "@/lib/agent/types";

export function EscalationQueue({
  items,
  onResolve,
}: {
  items: Escalation[];
  onResolve: (id: string, action: "approve" | "correct" | "reject", payload?: Record<string, unknown>) => void;
}) {
  const [activeId, setActiveId] = useState<string | null>(null);
  const active = useMemo(
    () => items.find((item) => item.id === (activeId ?? items[0]?.id)) ?? items[0],
    [items, activeId],
  );

  if (!items.length) return null;

  return (
    <section className="shrink-0 overflow-hidden border-b border-stroke bg-white">
      <div className="flex items-center justify-between gap-3 px-4 py-2">
        <div className="flex min-w-0 items-center gap-2">
          <h2 className="text-sm font-semibold text-navy">
            {items.every((item) => item.kind === "ambiguous_mapping" || item.kind === "ambiguous_structure")
              ? "Confirm column mapping"
              : "Needs a decision"}
          </h2>
          <p className="text-sm text-muted">
            {items.every((item) => item.kind === "ambiguous_mapping" || item.kind === "ambiguous_structure")
              ? "Rows wait until this is done"
              : `${items.length} left`}
          </p>
        </div>
        {items.length > 1 ? (
          <div className="flex max-w-[40%] gap-1 overflow-hidden">
            {items.map((item, index) => (
              <button
                key={item.id}
                onClick={() => setActiveId(item.id)}
                className={`h-6 w-6 rounded-full text-xs ${
                  active?.id === item.id ? "bg-navy text-white" : "bg-[#f4f1ec] text-muted"
                }`}
              >
                {index + 1}
              </button>
            ))}
          </div>
        ) : null}
      </div>
      {active ? <Decision key={active.id} item={active} onResolve={onResolve} /> : null}
    </section>
  );
}

function Decision({
  item,
  onResolve,
}: {
  item: Escalation;
  onResolve: (id: string, action: "approve" | "correct" | "reject", payload?: Record<string, unknown>) => void;
}) {
  const candidates = (item.context.candidates as Array<{ field: string; score: number }> | undefined) ?? [];
  const options = (item.context.options as Array<{ value: string; from: string } | string> | undefined) ?? [];
  const [value, setValue] = useState(String(item.suggestion.payload.value ?? ""));

  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-2 px-4 pb-3">
      <div className="min-w-[220px] flex-1">
        <h3 className="text-sm font-semibold text-navy">{humanizeFields(item.title)}</h3>
        <p className="text-xs leading-5 text-muted">{humanizeFields(item.why)}</p>
      </div>

      {item.kind === "ambiguous_mapping" ? (
        <Choices>
          {(candidates.length ? candidates : [{ field: String(item.suggestion.payload.targetField ?? ""), score: 1 }])
            .filter((candidate) => candidate.field)
            .slice(0, 3)
            .map((candidate, index) => (
              <Choice
                key={candidate.field}
                onClick={() =>
                  onResolve(item.id, index === 0 ? "approve" : "correct", {
                    ...item.suggestion.payload,
                    targetField: candidate.field,
                  })
                }
              >
                {fieldLabel(candidate.field)}
                {index === 0 ? <span className="ml-1.5 text-muted">Approve</span> : null}
              </Choice>
            ))}
          <button
            onClick={() => onResolve(item.id, "reject", item.suggestion.payload)}
            className="px-1 text-sm text-muted"
          >
            Skip column
          </button>
        </Choices>
      ) : null}

      {item.kind === "merge_conflict" ? (
        <Choices>
          {options.map((option, index) => {
            const valueText = typeof option === "string" ? option : option.value;
            const from = typeof option === "string" ? "" : option.from;
            return (
              <Choice
                key={valueText}
                onClick={() =>
                  onResolve(item.id, index === 0 ? "approve" : "correct", {
                    ...item.suggestion.payload,
                    value: valueText,
                  })
                }
              >
                {valueText}
                {from ? <span className="ml-1 text-muted">({from})</span> : null}
                {index === 0 ? <span className="ml-1.5 text-muted">Approve</span> : null}
              </Choice>
            );
          })}
        </Choices>
      ) : null}

      {item.kind !== "ambiguous_mapping" && item.kind !== "merge_conflict" ? (
        <div className="flex flex-wrap items-center gap-2">
          {item.context.original ? (
            <p className="text-xs text-muted">Source: {String(item.context.original)}</p>
          ) : null}
          {Array.isArray(item.context.options) && typeof item.context.options[0] === "string" ? (
            <Choices>
              {(item.context.options as string[]).map((option) => (
                <Choice
                  key={option}
                  onClick={() =>
                    onResolve(item.id, "correct", { ...item.suggestion.payload, value: option, dateOrder: option })
                  }
                >
                  {option}
                </Choice>
              ))}
            </Choices>
          ) : (
            <>
              <input
                className="w-44 rounded-md border border-stroke px-2 py-1.5 text-sm"
                placeholder="Correct value"
                value={value}
                onChange={(event) => setValue(event.target.value)}
              />
              <button
                onClick={() => onResolve(item.id, "correct", { ...item.suggestion.payload, value })}
                disabled={!value.trim()}
                className="rounded-md bg-navy px-3 py-1.5 text-sm text-white disabled:opacity-40"
              >
                Save
              </button>
            </>
          )}
          <button
            onClick={() => onResolve(item.id, "reject", item.suggestion.payload)}
            className="text-sm text-muted"
          >
            Skip person
          </button>
        </div>
      ) : null}
    </div>
  );
}

function Choices({ children }: { children: ReactNode }) {
  return <div className="flex flex-wrap items-center gap-2">{children}</div>;
}

function Choice({ children, onClick }: { children: ReactNode; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="rounded-md border border-stroke px-3 py-1.5 text-sm hover:border-navy"
    >
      {children}
    </button>
  );
}
