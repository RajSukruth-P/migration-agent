"use client";

import { useEffect, useState } from "react";
import { useJob } from "@/components/job/JobProvider";
import type { TargetRecord } from "@/lib/target/store";
import { Badge, Button, Card, CardHeader, EmptyState, PageHeader, Stat } from "@/components/ui/primitives";

export default function DarwinboxPage() {
  const { job, restoring, retry, rollback } = useJob();
  const [tenant, setTenant] = useState<TargetRecord[]>([]);
  const jobId = job?.id;
  const pushSignature = `${job?.stats.pushed}-${job?.stats.failed}-${job?.stats.rolledBack}`;

  useEffect(() => {
    if (!jobId) return;
    let cancelled = false;
    fetch(`/api/target/employees?jobId=${jobId}`)
      .then((res) => res.json())
      .then((body: { employees: TargetRecord[] }) => !cancelled && setTenant(body.employees ?? []))
      .catch(() => !cancelled && setTenant([]));
    return () => {
      cancelled = true;
    };
  }, [jobId, pushSignature]);

  if (restoring) return <p className="py-20 text-center text-sm text-muted">Reconnecting to the run…</p>;

  if (!job) {
    return (
      <Card padded={false}>
        <EmptyState
          title="The tenant is empty"
          body="This is a mock Darwinbox API. Once the agent pushes records, everything it wrote — plus failures, retries and rollbacks — shows up here."
        />
      </Card>
    );
  }

  const failed = job.records.filter((record) => record.status === "failed");
  const { stats } = job;

  return (
    <div className="space-y-5">
      <PageHeader
        title="Darwinbox tenant"
        description="What the agent actually wrote to the mock target API, with per-record success and failure. Retries reuse the same identity key, so nothing is duplicated."
        action={
          <div className="flex gap-2">
            {stats.failed ? (
              <Button variant="primary" onClick={() => void retry()}>
                Retry {stats.failed} failed
              </Button>
            ) : null}
            {stats.pushed ? (
              <Button variant="danger" onClick={() => void rollback()}>
                Roll back this run
              </Button>
            ) : null}
          </div>
        }
      />

      <div className="grid gap-3 sm:grid-cols-4">
        <Stat label="In the tenant" value={tenant.length} hint="live from the mock API" tone={tenant.length ? "teal" : "neutral"} />
        <Stat label="Pushed" value={stats.pushed} hint="this run" />
        <Stat label="Failed" value={stats.failed} hint="retryable" tone={stats.failed ? "danger" : "neutral"} />
        <Stat label="Rolled back" value={stats.rolledBack} hint="removed again" tone={stats.rolledBack ? "amber" : "neutral"} />
      </div>

      {failed.length ? (
        <Card>
          <CardHeader
            title="Failed pushes"
            hint="The target API reported these per record. Retry re-sends only these."
            action={
              <Button size="sm" onClick={() => void retry()}>
                Retry all
              </Button>
            }
          />
          <ul>
            {failed.map((record) => (
              <li key={record.id} className="flex flex-wrap items-baseline justify-between gap-2 border-b border-stroke py-2 last:border-b-0">
                <span className="min-w-0">
                  <span className="block text-sm text-navy">
                    {record.data.firstName} {record.data.lastName}
                  </span>
                  <span className="block text-xs text-danger">{record.push?.error}</span>
                </span>
                <Badge tone="neutral">
                  {record.push?.attempts ?? 1} attempt{(record.push?.attempts ?? 1) === 1 ? "" : "s"}
                </Badge>
              </li>
            ))}
          </ul>
        </Card>
      ) : null}

      <Card padded={false}>
        <div className="border-b border-stroke px-5 py-3">
          <h2 className="text-sm font-semibold text-navy">Employee records in the tenant</h2>
          <p className="text-xs text-muted">Dates are stored in the Darwinbox format, DD/MM/YYYY.</p>
        </div>
        {tenant.length ? (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[900px] text-sm">
              <thead>
                <tr className="border-b border-stroke bg-surface-muted text-left text-[11px] uppercase tracking-wide text-subtle">
                  <th className="px-5 py-2 font-medium">Target ID</th>
                  <th className="px-3 py-2 font-medium">Name</th>
                  <th className="px-3 py-2 font-medium">Email</th>
                  <th className="px-3 py-2 font-medium">Department</th>
                  <th className="px-3 py-2 font-medium">Job title</th>
                  <th className="px-3 py-2 font-medium">Hire date</th>
                  <th className="px-5 py-2 font-medium">Location</th>
                </tr>
              </thead>
              <tbody>
                {tenant.map((row) => (
                  <tr key={row.targetId} className="border-b border-stroke last:border-b-0 hover:bg-surface-muted">
                    <td className="whitespace-nowrap px-5 py-2.5 font-mono text-xs text-teal">{row.targetId}</td>
                    <td className="whitespace-nowrap px-3 py-2.5 text-navy">
                      {row.firstName} {row.lastName}
                    </td>
                    <td className="px-3 py-2.5 text-xs text-muted">{row.email}</td>
                    <td className="px-3 py-2.5 text-xs text-muted">{row.department || "—"}</td>
                    <td className="px-3 py-2.5 text-xs text-muted">{row.jobTitle || "—"}</td>
                    <td className="px-3 py-2.5 text-xs tabular-nums text-muted">{row.hireDate || "—"}</td>
                    <td className="px-5 py-2.5 text-xs text-muted">{row.workLocation || "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <EmptyState
            title="Nothing written yet"
            body="The agent pushes once every decision is resolved. Records that are still blocked are held back rather than written half-complete."
          />
        )}
      </Card>
    </div>
  );
}
