"use client";

import { useMemo, useState } from "react";
import { useJob } from "@/components/job/JobProvider";
import { RecordDrawer } from "@/components/job/RecordDrawer";
import { recordStatus } from "@/components/job/recordStatus";
import { sourceFiles } from "@/lib/agent/compare";
import { isoToDmy } from "@/lib/agent/dates";
import type { CanonicalRecord } from "@/lib/agent/types";
import { Badge, Card, EmptyState, FilterChips, PageHeader } from "@/components/ui/primitives";

type Filter = "all" | "blocked" | "ready" | "pushed" | "failed";

export default function PeoplePage() {
  const { job, restoring, mappingPending } = useJob();
  const [filter, setFilter] = useState<Filter>("all");
  const [query, setQuery] = useState("");
  const [openId, setOpenId] = useState<string | null>(null);

  const records = useMemo(() => job?.records.filter((record) => record.status !== "dropped") ?? [], [job]);

  const counts = useMemo(
    () => ({
      all: records.length,
      blocked: records.filter((record) => record.status === "blocked").length,
      ready: records.filter((record) => record.status === "ready").length,
      pushed: records.filter((record) => record.status === "pushed").length,
      failed: records.filter((record) => record.status === "failed").length,
    }),
    [records],
  );

  const rows = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return records
      .filter((record) => (filter === "all" ? true : record.status === filter))
      .filter((record) => {
        if (!needle) return true;
        const haystack = [
          record.data.firstName,
          record.data.lastName,
          record.data.email,
          record.data.department,
          record.data.jobTitle,
          record.data.legacyId,
          ...record.sourceRows.map((source) => source.file),
        ]
          .filter(Boolean)
          .join(" ")
          .toLowerCase();
        return haystack.includes(needle);
      });
  }, [records, filter, query]);

  if (restoring) return <p className="py-20 text-center text-sm text-muted">Reconnecting to the run…</p>;

  if (!records.length) {
    return (
      <Card padded={false}>
        <EmptyState
          title={mappingPending ? "Rows are waiting on the column mapping" : "No people yet"}
          body={
            mappingPending
              ? "The agent will not migrate a single row until every column decision is settled. Resolve the open decision and the people list fills in."
              : "Start a run from the header. Once columns are mapped, every reconciled person appears here with their original values and audit trail."
          }
        />
      </Card>
    );
  }

  const open = records.find((record) => record.id === openId) ?? null;

  return (
    <div className="space-y-5">
      <PageHeader
        title="People"
        description="One row per person after merging the files. Open anyone to see the original file values next to what the agent wrote to Darwinbox."
      />

      <Card padded={false}>
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-stroke px-5 py-3">
          <FilterChips<Filter>
            value={filter}
            onChange={setFilter}
            options={[
              { value: "all", label: "Everyone", count: counts.all },
              { value: "blocked", label: "Needs you", count: counts.blocked },
              { value: "ready", label: "Ready", count: counts.ready },
              { value: "pushed", label: "In Darwinbox", count: counts.pushed },
              { value: "failed", label: "Failed", count: counts.failed },
            ]}
          />
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search name, email, file…"
            className="w-56 rounded-lg border border-stroke bg-surface px-3 py-1.5 text-sm placeholder:text-subtle"
          />
        </div>

        <div className="overflow-x-auto">
          <table className="w-full min-w-[720px] text-sm">
            <thead>
              <tr className="border-b border-stroke bg-surface-muted text-left text-[11px] uppercase tracking-wide text-subtle">
                <th className="px-5 py-2 font-medium">Person</th>
                <th className="px-3 py-2 font-medium">Source files</th>
                <th className="px-3 py-2 font-medium">Department</th>
                <th className="px-3 py-2 font-medium">Hire date</th>
                <th className="hidden px-3 py-2 font-medium xl:table-cell">Legacy ID</th>
                <th className="px-5 py-2 font-medium">Status</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((record) => (
                <tr
                  key={record.id}
                  tabIndex={0}
                  role="button"
                  aria-label={`Open ${displayName(record)}`}
                  onClick={() => setOpenId(record.id)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter" || event.key === " ") {
                      event.preventDefault();
                      setOpenId(record.id);
                    }
                  }}
                  className={`cursor-pointer border-b border-stroke last:border-b-0 hover:bg-surface-muted ${
                    record.id === openId ? "bg-surface-sunk" : ""
                  }`}
                >
                  <td className="px-5 py-2.5">
                    <span className="block font-medium text-navy">{displayName(record)}</span>
                    <span className="block text-xs text-muted">{record.data.email || "no email"}</span>
                  </td>
                  <td className="px-3 py-2.5 text-xs text-muted">{sourceFiles(record).join(" + ")}</td>
                  <td className="px-3 py-2.5 text-xs text-muted">{record.data.department || "—"}</td>
                  <td className="px-3 py-2.5 text-xs tabular-nums text-muted">
                    {isoToDmy(record.data.hireDate) || record.data.hireDate || "—"}
                  </td>
                  <td className="hidden px-3 py-2.5 text-xs text-muted xl:table-cell">
                    {record.data.legacyId || "—"}
                  </td>
                  <td className="px-5 py-2.5">
                    <Badge tone={recordStatus(record).tone}>{recordStatus(record).label}</Badge>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {rows.length === 0 ? (
          <p className="px-5 py-8 text-center text-sm text-muted">Nobody matches that filter.</p>
        ) : null}
      </Card>

      <RecordDrawer
        key={open?.id ?? "none"}
        record={open}
        mappings={job?.mappings ?? []}
        escalations={job?.escalations ?? []}
        onClose={() => setOpenId(null)}
      />
    </div>
  );
}

function displayName(record: CanonicalRecord): string {
  const name = `${record.data.firstName ?? ""} ${record.data.lastName ?? ""}`.trim();
  return name || record.data.email || record.data.legacyId || "Unnamed";
}
