"use client";

import { humanizeFields } from "@/lib/agent/labels";
import type { AgentEvent } from "@/lib/agent/types";

const VISIBLE = 5;

export function ActivityPanel({ events }: { events: AgentEvent[] }) {
  const recent = events.slice(-VISIBLE).reverse();

  return (
    <section className="flex h-full min-h-0 flex-col overflow-hidden border-l border-t border-stroke bg-white">
      <div className="shrink-0 px-4 py-2">
        <h2 className="text-sm font-semibold text-navy">Live activity</h2>
        <p className="truncate text-xs text-muted">
          {events.length ? `${events.length} steps logged` : "What the agent is doing"}
        </p>
      </div>
      {recent.length ? (
        <ul
          className="grid min-h-0 flex-1 overflow-hidden px-4 pb-3"
          style={{ gridTemplateRows: `repeat(${VISIBLE}, minmax(0, 1fr))` }}
        >
          {recent.map((event) => (
            <li key={event.id} className="flex min-h-0 items-center gap-2 text-xs">
              <span className="shrink-0 text-muted">{clock(event.at)}</span>
              <span className={`truncate ${tone(event.level)}`}>{humanizeFields(event.message)}</span>
            </li>
          ))}
        </ul>
      ) : (
        <p className="px-4 text-xs text-muted">Nothing yet.</p>
      )}
    </section>
  );
}

function tone(level: AgentEvent["level"]): string {
  if (level === "error" || level === "warn") return "text-accent";
  if (level === "success") return "text-navy";
  return "text-muted";
}

function clock(at: string): string {
  const date = new Date(at);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" });
}
