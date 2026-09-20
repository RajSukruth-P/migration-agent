"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import type { Escalation, JobSnapshot } from "@/lib/agent/types";

const JOB_KEY = "migration-agent:job-id";

type ResolveAction = "approve" | "correct" | "reject";

interface JobContextValue {
  job: JobSnapshot | null;
  busy: boolean;
  error: string;
  /** True while we are re-attaching to a run that started before a reload. */
  restoring: boolean;
  openEscalations: Escalation[];
  mappingEscalations: Escalation[];
  recordEscalations: Escalation[];
  /** The agent refuses to touch rows until every column decision is made. */
  mappingPending: boolean;
  startSamples: () => Promise<void>;
  startUploads: (files: FileList | File[] | null) => Promise<void>;
  /** Resolves to the agent's reason when it refuses the answer, else null. */
  resolve: (id: string, action: ResolveAction, payload?: Record<string, unknown>) => Promise<string | null>;
  retry: () => Promise<void>;
  rollback: () => Promise<void>;
  dismissError: () => void;
}

const JobContext = createContext<JobContextValue | null>(null);

export function JobProvider({ children }: { children: ReactNode }) {
  const [job, setJob] = useState<JobSnapshot | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [restoring, setRestoring] = useState(true);
  const sourceRef = useRef<EventSource | null>(null);

  const listen = useCallback((id: string) => {
    sourceRef.current?.close();
    const source = new EventSource(`/api/jobs/${id}/events`);
    source.onmessage = (event) => setJob(JSON.parse(event.data) as JobSnapshot);
    sourceRef.current = source;
  }, []);

  // The run lives in server memory, so a reload does not lose it. Remember the
  // id and re-attach instead of making the consultant start over.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const saved = sessionStorage.getItem(JOB_KEY);
      let snapshot: JobSnapshot | null = null;
      if (saved) {
        try {
          const res = await fetch(`/api/jobs/${saved}`);
          // Only forget the run when the server says it is gone. A failure
          // anywhere else should not throw away a run that is still alive.
          if (res.ok) snapshot = (await res.json()) as JobSnapshot;
          else sessionStorage.removeItem(JOB_KEY);
        } catch {
          // Network hiccup: keep the id and let the consultant reload.
        }
      }
      if (cancelled) return;
      setRestoring(false);
      if (saved && snapshot) {
        setJob(snapshot);
        listen(saved);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [listen]);

  useEffect(() => () => sourceRef.current?.close(), []);

  const attach = useCallback(
    (id: string, snapshot: JobSnapshot) => {
      sessionStorage.setItem(JOB_KEY, id);
      setJob(snapshot);
      listen(id);
    },
    [listen],
  );

  const startSamples = useCallback(async () => {
    setBusy(true);
    setError("");
    try {
      const res = await fetch("/api/jobs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ samples: true }),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error || "Could not start the run");
      attach(body.id, body.snapshot);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not start the run");
    } finally {
      setBusy(false);
    }
  }, [attach]);

  const startUploads = useCallback(
    async (list: FileList | File[] | null) => {
      const files = list ? Array.from(list) : [];
      if (!files.length) return;
      setBusy(true);
      setError("");
      try {
        const form = new FormData();
        files.forEach((file) => form.append("files", file));
        const res = await fetch("/api/jobs", { method: "POST", body: form });
        const body = await res.json();
        if (!res.ok) throw new Error(body.error || "Could not read those files");
        attach(body.id, body.snapshot);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Could not read those files");
      } finally {
        setBusy(false);
      }
    },
    [attach],
  );

  const post = useCallback(
    async (path: string, body?: unknown): Promise<string | null> => {
      if (!job) return null;
      const res = await fetch(`/api/jobs/${job.id}/${path}`, {
        method: "POST",
        headers: body ? { "Content-Type": "application/json" } : undefined,
        body: body ? JSON.stringify(body) : undefined,
      });
      const snapshot = await res.json();
      if (!res.ok) return snapshot.error || "That request did not go through";
      setJob(snapshot);
      return null;
    },
    [job],
  );

  const command = useCallback(
    async (path: string) => {
      setError("");
      const message = await post(path);
      if (message) setError(message);
    },
    [post],
  );

  // The agent validates a consultant's correction exactly like its own work,
  // so the refusal belongs on the card that asked, not in a page-level banner.
  const resolve = useCallback(
    (escalationId: string, action: ResolveAction, payload?: Record<string, unknown>) =>
      post("resolve", { escalationId, action, payload }),
    [post],
  );

  const value = useMemo<JobContextValue>(() => {
    const open = job?.escalations.filter((item) => item.status === "open") ?? [];
    const mapping = open.filter(
      (item) => item.kind === "ambiguous_mapping" || item.kind === "ambiguous_structure",
    );
    return {
      job,
      busy,
      error,
      restoring,
      openEscalations: open,
      mappingEscalations: mapping,
      recordEscalations: open.filter((item) => !mapping.includes(item)),
      mappingPending: mapping.length > 0 || job?.phase === "awaiting_mapping",
      startSamples,
      startUploads,
      resolve,
      retry: () => command("retry"),
      rollback: () => command("rollback"),
      dismissError: () => setError(""),
    };
  }, [job, busy, error, restoring, startSamples, startUploads, resolve, command]);

  return <JobContext.Provider value={value}>{children}</JobContext.Provider>;
}

export function useJob(): JobContextValue {
  const value = useContext(JobContext);
  if (!value) throw new Error("useJob must be used inside <JobProvider>");
  return value;
}
