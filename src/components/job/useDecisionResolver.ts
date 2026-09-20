"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useJob } from "./JobProvider";

/**
 * Answering an escalation can fail in two ways, and they read differently to a
 * consultant: the agent can refuse the value outright, or accept it and then
 * re-open the same question after re-validating. Track both per escalation.
 */
export function useDecisionResolver() {
  const { job, resolve } = useJob();
  const [rejections, setRejections] = useState<Record<string, string>>({});
  const [bounced, setBounced] = useState<string[]>([]);
  const answered = useRef(new Set<string>());
  const closedSinceAnswer = useRef(new Set<string>());

  const onResolve = useCallback(
    async (id: string, action: "approve" | "correct" | "reject", payload?: Record<string, unknown>) => {
      answered.current.add(id);
      setBounced((current) => current.filter((item) => item !== id));
      setRejections((current) => ({ ...current, [id]: "" }));
      const refusal = await resolve(id, action, payload);
      if (refusal) setRejections((current) => ({ ...current, [id]: refusal }));
    },
    [resolve],
  );

  useEffect(() => {
    if (!job) return;
    for (const item of job.escalations) {
      if (!answered.current.has(item.id)) continue;
      if (item.status !== "open") {
        closedSinceAnswer.current.add(item.id);
      } else if (closedSinceAnswer.current.delete(item.id)) {
        setBounced((current) => (current.includes(item.id) ? current : [...current, item.id]));
      }
    }
  }, [job]);

  return {
    onResolve,
    rejectionFor: (id: string) => rejections[id] ?? "",
    wasBounced: (id: string) => bounced.includes(id),
  };
}
