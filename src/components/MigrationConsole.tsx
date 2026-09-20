"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { Escalation, JobPhase, JobSnapshot } from "@/lib/agent/types";
import { EscalationQueue } from "./EscalationQueue";
import { MappingPanel } from "./MappingPanel";
import { RecordsPanel } from "./RecordsPanel";
import { RowDetailPanel } from "./RowDetailPanel";

const PHASE_COPY: Record<JobPhase | "idle", string> = {
  idle: "Ready",
  ingesting: "File received",
  mapping: "Mapping columns",
  awaiting_mapping: "Confirm columns first",
  profiling: "Migrating rows",
  cleaning: "Migrating rows",
  reconciling: "Migrating rows",
  validating: "Checking records",
  awaiting_human: "Needs a decision",
  pushing: "Sending to Darwinbox",
  complete: "Done",
  failed: "Failed",
};

export function MigrationConsole() {
  const [job, setJob] = useState<JobSnapshot | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [pickedId, setPickedId] = useState<string | null>(null);
  const [receivedNote, setReceivedNote] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);
  const sourceRef = useRef<EventSource | null>(null);

  useEffect(() => {
    return () => sourceRef.current?.close();
  }, []);

  // Everything lives in server memory for this prototype, so a reload throws
  // the run away. Make the browser ask first.
  useEffect(() => {
    if (!job) return;
    function confirmLeave(event: BeforeUnloadEvent) {
      event.preventDefault();
      event.returnValue = "";
    }
    window.addEventListener("beforeunload", confirmLeave);
    return () => window.removeEventListener("beforeunload", confirmLeave);
  }, [job]);

  function listen(id: string) {
    sourceRef.current?.close();
    const source = new EventSource(`/api/jobs/${id}/events`);
    source.onmessage = (event) => {
      setJob(JSON.parse(event.data) as JobSnapshot);
    };
    sourceRef.current = source;
  }

  async function startSamples() {
    setBusy(true);
    setError("");
    setReceivedNote("Loading sample files…");
    try {
      const res = await fetch("/api/jobs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ samples: true }),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error || "Failed to start");
      setJob(body.snapshot);
      listen(body.id);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to start");
      setReceivedNote("");
    } finally {
      setBusy(false);
    }
  }

  async function startUploads(list: FileList | null) {
    if (!list?.length) return;
    const files = Array.from(list);
    setBusy(true);
    setError("");
    setReceivedNote(`Received ${files.length} file${files.length === 1 ? "" : "s"}: ${files.map((file) => file.name).join(", ")}`);
    try {
      const form = new FormData();
      files.forEach((file) => form.append("files", file));
      const res = await fetch("/api/jobs", { method: "POST", body: form });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error || "Failed to start");
      setJob(body.snapshot);
      listen(body.id);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to start");
    } finally {
      setBusy(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  async function command(path: string, body?: unknown) {
    if (!job) return;
    setError("");
    const res = await fetch(`/api/jobs/${job.id}/${path}`, {
      method: "POST",
      headers: body ? { "Content-Type": "application/json" } : undefined,
      body: body ? JSON.stringify(body) : undefined,
    });
    const snapshot = await res.json();
    if (!res.ok) {
      setError(snapshot.error || "Request failed");
      return;
    }
    setJob(snapshot);
  }

  const openEscalations = useMemo(
    () => job?.escalations.filter((item: Escalation) => item.status === "open") ?? [],
    [job],
  );
  const mappingPending = openEscalations.some(
    (item) => item.kind === "ambiguous_mapping" || item.kind === "ambiguous_structure",
  );
  // Fall back to the first visible person so the detail panel is never blank
  // while a run is streaming in and rows keep changing underneath us.
  const visibleRows = job?.records.filter((record) => record.status !== "dropped") ?? [];
  const selectedId =
    pickedId && visibleRows.some((row) => row.id === pickedId) ? pickedId : (visibleRows[0]?.id ?? null);
  const selected = job?.records.find((record) => record.id === selectedId) ?? null;
  const waitingOnColumns = mappingPending || job?.phase === "awaiting_mapping";

  return (
    <div className="flex h-full min-h-0 flex-col overflow-hidden bg-background">
      <header className="flex h-14 shrink-0 items-center justify-between gap-4 border-b border-stroke bg-white px-5">
        <div className="min-w-0">
          <h1 className="text-base font-semibold text-navy">Migration Agent</h1>
          <p className="truncate text-xs text-muted">{statusLine(job, receivedNote, Boolean(waitingOnColumns))}</p>
        </div>
        <div className="flex shrink-0 items-center gap-3">
          {job?.stats.failed ? (
            <button onClick={() => command("retry")} className="text-sm text-navy underline">
              Retry {job.stats.failed}
            </button>
          ) : null}
          {job?.stats.pushed ? (
            <button onClick={() => command("rollback")} className="text-sm text-muted underline">
              Rollback
            </button>
          ) : null}
          <button
            onClick={startSamples}
            disabled={busy}
            className="rounded-md bg-navy px-3 py-2 text-sm text-white disabled:opacity-50"
          >
            {busy && !receivedNote.startsWith("Received") ? "Starting…" : "Run sample"}
          </button>
          <button
            onClick={() => fileRef.current?.click()}
            disabled={busy}
            className="rounded-md border border-stroke px-3 py-2 text-sm disabled:opacity-50"
          >
            {receivedNote.startsWith("Received") && busy ? "Received" : "Upload"}
          </button>
          <input
            ref={fileRef}
            type="file"
            accept=".csv,.xlsx,.xls"
            multiple
            className="hidden"
            onChange={(event) => startUploads(event.target.files)}
          />
        </div>
      </header>

      <p className="flex h-7 shrink-0 items-center gap-2 border-b border-stroke bg-[#fdf6ee] px-5 text-[11px] text-accent">
        This run lives in memory only. Refreshing or restarting the server loses the files, mapping and audit trail.
      </p>

      {error ? <p className="shrink-0 border-b border-stroke px-5 py-2 text-sm text-red-700">{error}</p> : null}

      <EscalationQueue
        items={openEscalations}
        onResolve={(escalationId, action, payload) => command("resolve", { escalationId, action, payload })}
      />

      <div className="grid min-h-0 flex-1 grid-cols-[220px_minmax(0,1fr)] overflow-hidden">
        <div className="min-h-0 overflow-hidden border-r border-stroke">
          <MappingPanel mappings={job?.mappings ?? []} files={job?.files ?? []} />
        </div>
        <div className="grid min-h-0 grid-rows-[minmax(0,1fr)_240px] overflow-hidden">
          <RecordsPanel
            records={job?.records ?? []}
            selectedId={selectedId}
            onSelect={setPickedId}
            phase={job?.phase ?? "idle"}
            mappingPending={Boolean(waitingOnColumns)}
          />
          <RowDetailPanel
            record={selected}
            mappings={job?.mappings ?? []}
            escalations={job?.escalations ?? []}
            events={job?.events ?? []}
            mappingPending={Boolean(waitingOnColumns) || job?.phase === "mapping"}
          />
        </div>
      </div>
    </div>
  );
}

function statusLine(job: JobSnapshot | null, receivedNote: string, waitingOnColumns: boolean): string {
  if (!job) return receivedNote || "Employee migration";
  if (waitingOnColumns) {
    const count = job.escalations.filter(
      (item) => item.status === "open" && (item.kind === "ambiguous_mapping" || item.kind === "ambiguous_structure"),
    ).length;
    return count
      ? `Received ${job.files.length} file${job.files.length === 1 ? "" : "s"} · confirm ${count} column${count === 1 ? "" : "s"} · rows waiting`
      : "Columns confirmed · migrating rows";
  }
  const bits = [
    job.files.length ? `Received ${job.files.length} file${job.files.length === 1 ? "" : "s"}` : "",
    PHASE_COPY[job.phase],
    job.stats.uniquePeople ? `${job.stats.uniquePeople} people` : "",
    job.stats.failed ? `${job.stats.failed} failed` : "",
    job.stats.pushed ? `${job.stats.pushed} in Darwinbox` : "",
  ].filter(Boolean);
  return bits.join(" · ");
}
