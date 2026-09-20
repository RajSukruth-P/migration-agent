"use client";

import { useJob } from "@/components/job/JobProvider";
import { DecisionCard } from "@/components/job/DecisionCard";
import { useDecisionResolver } from "@/components/job/useDecisionResolver";
import { clock } from "@/components/job/ActivityFeed";
import { fieldLabel, humanizeFields } from "@/lib/agent/labels";
import type { Escalation } from "@/lib/agent/types";
import { Badge, Card, CardHeader, EmptyState, PageHeader, Stat, type Tone } from "@/components/ui/primitives";

export default function DecisionsPage() {
  const { job, restoring, openEscalations, mappingEscalations, recordEscalations } = useJob();
  const { onResolve, rejectionFor, wasBounced } = useDecisionResolver();

  if (restoring) return <p className="py-20 text-center text-sm text-muted">Reconnecting to the run…</p>;

  if (!job) {
    return (
      <Card padded={false}>
        <EmptyState
          title="No run in progress"
          body="Start a run from the header. Anything the agent cannot defend on its own shows up here with enough context to settle it in one glance."
        />
      </Card>
    );
  }

  const resolved = job.escalations.filter((item) => item.status !== "open");
  const { stats } = job;

  return (
    <div className="space-y-5">
      <PageHeader
        title="Decisions"
        description="The agent asks only when two answers are genuinely competing, or when a value failed cleanup twice. Everything else is applied and written to the audit trail."
      />

      <div className="grid gap-3 sm:grid-cols-4">
        <Stat label="Handled alone" value={stats.autoMapped + stats.ignoredColumns} hint="columns, no human" tone="teal" />
        <Stat label="Open" value={openEscalations.length} hint="waiting on you" tone={openEscalations.length ? "accent" : "neutral"} />
        <Stat label="Resolved" value={resolved.length} hint="by you, this run" />
        <Stat label="Blocking rows" value={mappingEscalations.length} hint="column decisions" tone={mappingEscalations.length ? "amber" : "neutral"} />
      </div>

      {mappingEscalations.length ? (
        <div>
          <SectionTitle
            title="Column decisions"
            hint="No rows are migrated until these are settled — a wrong mapping repeats in every row of the file."
          />
          <div className="space-y-4">
            {mappingEscalations.map((item) => (
              <DecisionCard
                key={item.id}
                item={item}
                onResolve={onResolve}
                retried={wasBounced(item.id)}
                rejection={rejectionFor(item.id)}
              />
            ))}
          </div>
        </div>
      ) : null}

      {recordEscalations.length ? (
        <div>
          <SectionTitle
            title="Record decisions"
            hint="Each of these already failed a second repair pass that looked across every source row for the person."
          />
          <div className="space-y-4">
            {recordEscalations.map((item) => (
              <DecisionCard
                key={item.id}
                item={item}
                onResolve={onResolve}
                retried={wasBounced(item.id)}
                rejection={rejectionFor(item.id)}
              />
            ))}
          </div>
        </div>
      ) : null}

      {!openEscalations.length ? (
        <Card padded={false}>
          <EmptyState
            title="Nothing needs a human right now"
            body={
              resolved.length
                ? "Everything raised this run has been answered. The agent carried on with the rest by itself."
                : "The agent has not hit anything ambiguous yet. It will stop here the moment it does."
            }
          />
        </Card>
      ) : null}

      {resolved.length ? (
        <Card>
          <CardHeader title="Already decided" hint="Your answers are part of the audit trail" />
          <ul>
            {resolved.map((item) => (
              <li
                key={item.id}
                className="flex flex-wrap items-baseline justify-between gap-2 border-b border-stroke py-2 last:border-b-0"
              >
                <span className="min-w-0">
                  <span className="block text-sm text-navy">{humanizeFields(item.title)}</span>
                  <span className="block text-xs text-muted">{describeResolution(item)}</span>
                </span>
                <span className="flex shrink-0 items-center gap-2">
                  <Badge tone={resolutionTone(item)}>{resolutionLabel(item)}</Badge>
                  <span className="font-mono text-[11px] text-subtle">
                    {item.resolution ? clock(item.resolution.at) : ""}
                  </span>
                </span>
              </li>
            ))}
          </ul>
        </Card>
      ) : null}
    </div>
  );
}

function SectionTitle({ title, hint }: { title: string; hint: string }) {
  return (
    <div className="mb-2">
      <h2 className="text-sm font-semibold text-navy">{title}</h2>
      <p className="text-xs leading-5 text-muted">{hint}</p>
    </div>
  );
}

function describeResolution(item: Escalation): string {
  const payload = item.resolution?.payload ?? {};
  if (item.resolution?.action === "reject") {
    return item.kind === "ambiguous_mapping" ? "Column left out of the migration" : "Person skipped, nothing written";
  }
  if (payload.targetField) return `Mapped to ${fieldLabel(String(payload.targetField))}`;
  if (payload.value) return `Set to “${String(payload.value)}”`;
  return "Approved the agent's suggestion";
}

function resolutionLabel(item: Escalation): string {
  if (item.status === "approved") return "Approved";
  if (item.status === "corrected") return "Corrected";
  return "Skipped";
}

function resolutionTone(item: Escalation): Tone {
  if (item.status === "approved") return "teal";
  if (item.status === "corrected") return "amber";
  return "neutral";
}
