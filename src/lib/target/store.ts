import type { Employee } from "../agent/types";
import { isoToDmy } from "../agent/dates";

export interface TargetRecord extends Employee {
  targetId: string;
  jobId: string;
  updatedAt: string;
}

const g = globalThis as unknown as {
  __targetStore?: {
    rows: Map<string, TargetRecord>;
    failedOnce: Set<string>;
  };
};

function bucket() {
  if (!g.__targetStore) {
    g.__targetStore = { rows: new Map(), failedOnce: new Set() };
  }
  return g.__targetStore;
}

export function listTargetEmployees(jobId?: string): TargetRecord[] {
  const rows = Array.from(bucket().rows.values());
  return jobId ? rows.filter((row) => row.jobId === jobId) : rows;
}

export function pushEmployee(
  jobId: string,
  data: Employee,
): { ok: true; targetId: string } | { ok: false; error: string; retryable: boolean } {
  const store = bucket();
  if (data.email === "samir.khan@northwind.com" && !store.failedOnce.has(data.email)) {
    store.failedOnce.add(data.email);
    return { ok: false, error: "Target API 503: employee service briefly unavailable", retryable: true };
  }
  const existing = Array.from(store.rows.values()).find((row) => row.email === data.email);
  // Email is the tenant's identity key. The same person re-pushed is an
  // update; a different legacy id on that email is a real conflict.
  if (existing && existing.legacyId && data.legacyId && existing.legacyId !== data.legacyId) {
    return {
      ok: false,
      error: `409: ${data.email} already belongs to ${existing.legacyId} in target`,
      retryable: false,
    };
  }
  const targetId = existing?.targetId ?? `DBX-${data.legacyId || crypto.randomUUID().slice(0, 8).toUpperCase()}`;
  const record: TargetRecord = {
    ...data,
    hireDate: isoToDmy(data.hireDate) || data.hireDate,
    dateOfBirth: isoToDmy(data.dateOfBirth) || data.dateOfBirth,
    targetId,
    jobId,
    updatedAt: new Date().toISOString(),
  };
  store.rows.set(targetId, record);
  return { ok: true, targetId };
}

export function rollbackJob(jobId: string): number {
  const store = bucket();
  // A rolled-back tenant should behave like a fresh one, including the
  // transient failure the next run is expected to hit.
  store.failedOnce.clear();
  let count = 0;
  for (const [id, row] of store.rows) {
    if (row.jobId === jobId) {
      store.rows.delete(id);
      count += 1;
    }
  }
  return count;
}

export function getTarget(targetId: string): TargetRecord | undefined {
  return bucket().rows.get(targetId);
}

export function deleteTarget(targetId: string): boolean {
  return bucket().rows.delete(targetId);
}
