"use client";

import { useRef, useState, type DragEvent } from "react";
import { useJob } from "@/components/job/JobProvider";
import { Button, Card } from "@/components/ui/primitives";

const STEPS = [
  {
    title: "It reads every file first",
    body: "CSV or Excel, different column names, different date formats. Each one is acknowledged by name and row count.",
  },
  {
    title: "Columns before rows",
    body: "Source columns are mapped to Darwinbox fields before any row is migrated.",
  },
  {
    title: "You only see the close calls",
    body: "A column that could be two fields, or a value that cannot be cleaned. Everything else is applied and logged.",
  },
];

export function StartPanel() {
  const { startSamples, startUploads, busy } = useJob();
  const [dragging, setDragging] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  function onDrop(event: DragEvent<HTMLDivElement>) {
    event.preventDefault();
    setDragging(false);
    void startUploads(event.dataTransfer.files);
  }

  return (
    <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_340px]">
      <Card className="flex flex-col justify-center" padded={false}>
        <div className="px-8 py-10">
          <h1 className="text-2xl font-semibold text-navy">Migrate employee data into Darwinbox</h1>
          <p className="mt-2 max-w-xl text-sm leading-6 text-muted">
            Give the agent the client&apos;s raw HR exports. It works out the mapping, cleans and reconciles the
            records, pushes them to the target tenant, and stops to ask you only when it genuinely cannot decide.
          </p>

          <div
            onDragOver={(event) => {
              event.preventDefault();
              setDragging(true);
            }}
            onDragLeave={() => setDragging(false)}
            onDrop={onDrop}
            className={`mt-6 rounded-xl border-2 border-dashed px-6 py-8 text-center transition-colors ${
              dragging ? "border-teal bg-teal-soft" : "border-stroke bg-surface-muted"
            }`}
          >
            <p className="text-sm text-navy">Drop CSV or Excel exports here</p>
            <p className="mt-1 text-xs text-muted">Multiple files of the same entity are reconciled into one dataset.</p>
            <div className="mt-4 flex flex-wrap items-center justify-center gap-2">
              <Button variant="primary" onClick={startSamples} disabled={busy}>
                {busy ? "Starting…" : "Run the sample migration"}
              </Button>
              <Button onClick={() => fileRef.current?.click()} disabled={busy}>
                Choose files
              </Button>
              <input
                ref={fileRef}
                type="file"
                accept=".csv,.xlsx,.xls"
                multiple
                className="hidden"
                onChange={(event) => {
                  void startUploads(event.target.files);
                  event.target.value = "";
                }}
              />
            </div>
          </div>

          <p className="mt-4 text-xs text-muted">
            The sample is three messy Northwind exports: <code className="text-navy">legacy_hr.csv</code>,{" "}
            <code className="text-navy">payroll.xlsx</code> and <code className="text-navy">contractors.csv</code> —
            21, 11 and 7 rows describing 28 people.
          </p>
        </div>
      </Card>

      <Card>
        <h2 className="text-sm font-semibold text-navy">How the run works</h2>
        <ol className="mt-3 space-y-4">
          {STEPS.map((step, index) => (
            <li key={step.title} className="flex gap-3">
              <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-surface-sunk text-[11px] font-semibold text-muted">
                {index + 1}
              </span>
              <div>
                <p className="text-sm font-medium text-navy">{step.title}</p>
                <p className="mt-0.5 text-xs leading-5 text-muted">{step.body}</p>
              </div>
            </li>
          ))}
        </ol>
      </Card>
    </div>
  );
}
