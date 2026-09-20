"use client";

import { useMemo, useState } from "react";
import { useJob } from "@/components/job/JobProvider";
import { ActivityFeed } from "@/components/job/ActivityFeed";
import type { AgentEvent } from "@/lib/agent/types";
import { Button, Card, EmptyState, FilterChips, PageHeader } from "@/components/ui/primitives";

type Filter = "all" | "decisions" | "warnings";

export default function ActivityPage() {
  const { job, restoring } = useJob();
  const [filter, setFilter] = useState<Filter>("all");
  const [query, setQuery] = useState("");

  const events = useMemo(() => job?.events ?? [], [job]);

  const rows = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return events
      .filter((event) => {
        if (filter === "warnings") return event.level === "warn" || event.level === "error";
        if (filter === "decisions") return event.message.startsWith("Human ");
        return true;
      })
      .filter((event) => (needle ? event.message.toLowerCase().includes(needle) : true));
  }, [events, filter, query]);

  if (restoring) return <p className="py-20 text-center text-sm text-muted">Reconnecting to the run…</p>;

  if (!events.length) {
    return (
      <Card padded={false}>
        <EmptyState
          title="No activity yet"
          body="Every step the agent takes is logged here — files read, columns mapped, values repaired, records pushed — so the whole run can be reconstructed afterwards."
        />
      </Card>
    );
  }

  return (
    <div className="space-y-5">
      <PageHeader
        title="Activity log"
        description="The full run record: what the agent read, what it decided, what it repaired on the second attempt, and what it wrote to Darwinbox."
        action={
          <Button size="sm" onClick={() => download(events)}>
            Download log
          </Button>
        }
      />

      <Card padded={false}>
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-stroke px-5 py-3">
          <FilterChips<Filter>
            value={filter}
            onChange={setFilter}
            options={[
              { value: "all", label: "Everything", count: events.length },
              { value: "warnings", label: "Warnings", count: events.filter((e) => e.level === "warn" || e.level === "error").length },
              { value: "decisions", label: "Human decisions", count: events.filter((e) => e.message.startsWith("Human ")).length },
            ]}
          />
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search the log…"
            className="w-56 rounded-lg border border-stroke bg-surface px-3 py-1.5 text-sm placeholder:text-subtle"
          />
        </div>
        <div className="px-5 py-2">
          {rows.length ? (
            <ActivityFeed events={rows} />
          ) : (
            <p className="py-8 text-center text-sm text-muted">Nothing in the log matches that.</p>
          )}
        </div>
      </Card>
    </div>
  );
}

function download(events: AgentEvent[]) {
  const lines = events.map((event) => `${event.at}\t${event.level}\t${event.phase}\t${event.message}`);
  const blob = new Blob([lines.join("\n")], { type: "text/plain" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = "migration-agent-log.txt";
  anchor.click();
  URL.revokeObjectURL(url);
}
