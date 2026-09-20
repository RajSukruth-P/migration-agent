"use client";

import Link from "next/link";
import { useJob } from "@/components/job/JobProvider";
import { ActivityFeed } from "@/components/job/ActivityFeed";
import { DecisionCard } from "@/components/job/DecisionCard";
import { useDecisionResolver } from "@/components/job/useDecisionResolver";
import { StartPanel } from "@/components/job/StartPanel";
import { PipelineStepper } from "@/components/shell/PipelineStepper";
import { PHASE_LABEL, STAGES, stageStates } from "@/components/shell/stages";
import type { JobPhase } from "@/lib/agent/types";
import { Badge, Button, Card, CardHeader, Dot, Stat } from "@/components/ui/primitives";

function stepLabel(phase: JobPhase): string {
  if (phase === "complete") return "All steps done";
  if (phase === "failed") return "Run failed";
  const index = stageStates(phase).indexOf("active");
  return index === -1 ? "Getting started" : `Step ${index + 1} of ${STAGES.length}`;
}

export default function OverviewPage() {
  const { job, restoring, openEscalations, mappingPending } = useJob();
  const { onResolve, rejectionFor, wasBounced } = useDecisionResolver();

  if (restoring) return <p className="py-20 text-center text-sm text-muted">Reconnecting to the run…</p>;
  if (!job) return <StartPanel />;

  const { stats } = job;
  const next = openEscalations[0];
  const autoRate = stats.autoMapped + stats.escalationsOpen + stats.escalationsResolved;

  return (
    <div className="space-y-5">
      <Card>
        <CardHeader
          title="Run progress"
          hint={PHASE_LABEL[job.phase]}
          action={
            <span className="flex items-center gap-1.5 whitespace-nowrap text-xs text-muted">
              <Dot tone={job.phase === "complete" ? "teal" : "accent"} live={job.phase !== "complete"} />
              {stepLabel(job.phase)}
            </span>
          }
        />
        <PipelineStepper phase={job.phase} />
      </Card>

      <div className="grid gap-3 sm:grid-cols-3 xl:grid-cols-6">
        <Stat label="Files" value={stats.files} hint={`${stats.sourceRows} source rows`} />
        <Stat label="People" value={stats.uniquePeople} hint="after merging" />
        <Stat label="Columns mapped" value={stats.autoMapped} hint={`${stats.ignoredColumns} ignored`} />
        <Stat
          label="Needs you"
          value={stats.escalationsOpen}
          hint={`${stats.escalationsResolved} resolved`}
          tone={stats.escalationsOpen ? "accent" : "neutral"}
        />
        <Stat
          label="In Darwinbox"
          value={stats.pushed}
          hint={stats.failed ? `${stats.failed} failed` : "pushed"}
          tone={stats.pushed ? "teal" : "neutral"}
        />
        <Stat
          label="Blocked"
          value={stats.blocked}
          hint={stats.dropped ? `${stats.dropped} skipped` : "held back"}
          tone={stats.blocked ? "amber" : "neutral"}
        />
      </div>

      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_360px]">
        <div className="space-y-5">
          {next ? (
            <div>
              <div className="mb-2 flex items-center justify-between">
                <h2 className="text-sm font-semibold text-navy">
                  {mappingPending ? "Confirm the column mapping" : "The agent needs a decision"}
                </h2>
                {openEscalations.length > 1 ? (
                  <Link href="/decisions" className="text-xs text-teal underline-offset-2 hover:underline">
                    See all {openEscalations.length}
                  </Link>
                ) : null}
              </div>
              {mappingPending ? (
                <p className="mb-2 text-xs text-muted">
                  No rows are migrated while a column is unresolved — a wrong mapping is the same bad record in every
                  row.
                </p>
              ) : null}
              <DecisionCard
                item={next}
                onResolve={onResolve}
                retried={wasBounced(next.id)}
                rejection={rejectionFor(next.id)}
              />
            </div>
          ) : (
            <Card>
              <CardHeader
                title="Nothing needs you"
                hint={
                  job.phase === "complete"
                    ? "The run is finished. Check the Darwinbox tab for what landed."
                    : "The agent is working through the files and will stop here if it gets stuck."
                }
              />
              <div className="flex gap-2">
                <Link href="/darwinbox">
                  <Button size="sm">Open Darwinbox tenant</Button>
                </Link>
                <Link href="/people">
                  <Button size="sm" variant="ghost">
                    Review people
                  </Button>
                </Link>
              </div>
            </Card>
          )}

          <Card>
            <CardHeader
              title={job.phase === "complete" ? "What the agent did" : "What the agent is doing"}
              hint="Newest first"
              action={
                <Link href="/activity" className="text-xs text-teal underline-offset-2 hover:underline">
                  Full log ({job.events.length})
                </Link>
              }
            />
            <ActivityFeed events={job.events} limit={10} />
          </Card>
        </div>

        <div className="space-y-5">
          <Card>
            <CardHeader title="Files received" hint="Same entity, different shapes" />
            <ul className="space-y-2">
              {job.files.map((file) => (
                <li key={file.name} className="flex items-baseline justify-between gap-3 border-b border-stroke pb-2 last:border-b-0 last:pb-0">
                  <span className="min-w-0">
                    <span className="block truncate text-sm text-navy">{file.name}</span>
                    <span className="text-xs text-subtle">{file.columns.length} columns</span>
                  </span>
                  <span className="shrink-0 text-xs text-muted">{file.rows} rows</span>
                </li>
              ))}
            </ul>
            {job.files.length > 1 && stats.uniquePeople ? (
              <p className="mt-3 text-xs leading-5 text-muted">
                Reconciled into <span className="text-navy">{stats.uniquePeople} people</span> on email, then legacy ID.
              </p>
            ) : null}
          </Card>

          <Card>
            <CardHeader title="Where the line is drawn" hint="Why you are not confirming every field" />
            <div className="mb-3 flex flex-wrap gap-1.5">
              <Badge tone="teal">{stats.autoMapped} applied alone</Badge>
              <Badge tone="neutral">{stats.ignoredColumns} ignored</Badge>
              <Badge tone={autoRate ? "accent" : "neutral"}>
                {stats.escalationsOpen + stats.escalationsResolved} asked
              </Badge>
            </div>
            <p className="whitespace-pre-line text-xs leading-6 text-muted">{job.policy}</p>
          </Card>
        </div>
      </div>
    </div>
  );
}
