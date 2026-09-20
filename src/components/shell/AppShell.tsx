"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useRef, type ReactNode } from "react";
import { useJob } from "@/components/job/JobProvider";
import { Button, Dot } from "@/components/ui/primitives";
import { isRunning, PHASE_LABEL } from "./stages";

const TABS = [
  { href: "/", label: "Overview" },
  { href: "/mapping", label: "Mapping" },
  { href: "/people", label: "People" },
  { href: "/decisions", label: "Decisions" },
  { href: "/darwinbox", label: "Darwinbox" },
  { href: "/activity", label: "Activity" },
] as const;

export function AppShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const { job, busy, error, dismissError, openEscalations, startSamples, startUploads } = useJob();
  const fileRef = useRef<HTMLInputElement>(null);
  const running = isRunning(job?.phase ?? null);

  return (
    <div className="min-h-screen">
      <header className="sticky top-0 z-30 border-b border-stroke bg-surface/95 backdrop-blur">
        <div className="mx-auto flex max-w-[1400px] items-center gap-4 px-6 py-3">
          <div className="flex min-w-0 flex-1 items-center gap-3">
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-navy text-sm font-semibold text-white">
              M
            </span>
            <div className="min-w-0">
              <p className="text-sm font-semibold text-navy">Migration Agent</p>
              <p className="truncate text-xs text-muted">
                {job ? `${job.clientName} → ${job.targetSystem}` : "Employee data into Darwinbox"}
              </p>
            </div>
          </div>

          <div className="flex shrink-0 items-center gap-2">
            <Button variant="primary" onClick={startSamples} disabled={busy}>
              {busy ? "Starting…" : job ? "New run" : "Run sample"}
            </Button>
            <Button onClick={() => fileRef.current?.click()} disabled={busy}>
              Upload
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

        <nav className="mx-auto flex max-w-[1400px] items-center gap-1 px-4">
          {job ? (
            <span className="order-last ml-auto hidden shrink-0 items-center gap-1.5 pr-2 text-xs text-muted md:inline-flex">
              <Dot tone={running ? "teal" : openEscalations.length ? "accent" : "neutral"} live={running} />
              {PHASE_LABEL[job.phase]}
            </span>
          ) : null}
          {TABS.map((tab) => {
            const active = tab.href === "/" ? pathname === "/" : pathname.startsWith(tab.href);
            const badge = tab.href === "/decisions" ? openEscalations.length : 0;
            return (
              <Link
                key={tab.href}
                href={tab.href}
                className={`-mb-px flex items-center gap-1.5 border-b-2 px-3 py-2.5 text-sm transition-colors ${
                  active
                    ? "border-navy font-medium text-navy"
                    : "border-transparent text-muted hover:text-navy"
                }`}
              >
                {tab.label}
                {badge ? (
                  <span className="rounded-full bg-accent px-1.5 py-px text-[10px] font-semibold text-white">
                    {badge}
                  </span>
                ) : null}
              </Link>
            );
          })}
        </nav>
      </header>

      {error ? (
        <div className="fixed bottom-5 left-1/2 z-50 flex -translate-x-1/2 items-center gap-3 rounded-xl border border-[#f0cfcb] bg-danger-soft px-4 py-3 shadow-lg">
          <p className="text-sm text-danger">{error}</p>
          <Button variant="ghost" size="sm" onClick={dismissError}>
            Dismiss
          </Button>
        </div>
      ) : null}

      <main className="mx-auto max-w-[1400px] px-6 py-6">{children}</main>
    </div>
  );
}
