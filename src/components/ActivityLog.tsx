"use client";

import { humanizeFields } from "@/lib/agent/labels";
import type { AgentEvent } from "@/lib/agent/types";

export function ActivityLog({ events }: { events: AgentEvent[] }) {
  if (!events.length) return <p className="text-[11px] text-muted">Nothing yet.</p>;

  return (
    <ol className="space-y-1">
      {[...events].reverse().map((event) => (
        <li key={event.id} className="text-[11px] leading-4">
          <span className="mr-1 text-muted">{clock(event.at)}</span>
          <span className={tone(event.level)} title={event.message}>
            {humanizeFields(event.message)}
          </span>
        </li>
      ))}
    </ol>
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
