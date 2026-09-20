"use client";

import { humanizeFields } from "@/lib/agent/labels";
import type { AgentEvent } from "@/lib/agent/types";
import { Dot, type Tone } from "@/components/ui/primitives";

export function ActivityFeed({ events, limit }: { events: AgentEvent[]; limit?: number }) {
  const ordered = [...events].reverse();
  const rows = limit ? ordered.slice(0, limit) : ordered;

  if (!rows.length) {
    return <p className="py-4 text-sm text-muted">Nothing logged yet.</p>;
  }

  return (
    <ol className="space-y-0">
      {rows.map((event) => (
        <li key={event.id} className="flex gap-3 border-b border-stroke py-2 last:border-b-0">
          <span className="mt-1.5 shrink-0">
            <Dot tone={tone(event.level)} />
          </span>
          <span className="w-16 shrink-0 pt-px font-mono text-[11px] text-subtle">{clock(event.at)}</span>
          <span className={`min-w-0 flex-1 text-sm leading-6 ${text(event.level)}`}>
            {humanizeFields(event.message)}
          </span>
        </li>
      ))}
    </ol>
  );
}

function tone(level: AgentEvent["level"]): Tone {
  if (level === "error") return "danger";
  if (level === "warn") return "accent";
  if (level === "success") return "teal";
  return "neutral";
}

function text(level: AgentEvent["level"]): string {
  if (level === "error") return "text-danger";
  if (level === "warn") return "text-accent";
  return "text-muted";
}

export function clock(at: string): string {
  const date = new Date(at);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" });
}
