import { POLICY } from "./policy";
import { canonDept } from "./clean";
import { collapseSpace, normalizeKey, pickRicher, similarity } from "./text";
import type { CanonicalRecord, Employee, SourceRef } from "./types";
import type { CleanIssue, CleanedRow } from "./clean";

export interface MergeConflict {
  identityKey: string;
  field: keyof Employee;
  options: Array<{ value: string; from: string }>;
  name: string;
  email?: string;
  legacyId?: string;
}

export interface ReconcileResult {
  records: CanonicalRecord[];
  conflicts: MergeConflict[];
  droppedDuplicates: number;
}

function identityKey(data: Partial<Employee>): string {
  if (data.email) return `email:${normalizeKey(data.email)}`;
  if (data.legacyId) return `id:${normalizeKey(data.legacyId)}`;
  return `anon:${normalizeKey(`${data.firstName ?? ""} ${data.lastName ?? ""}`)}:${Math.random()}`;
}

function displayName(data: Partial<Employee>): string {
  return collapseSpace(`${data.firstName ?? ""} ${data.lastName ?? ""}`) || data.email || data.legacyId || "Unknown";
}

function similarEnough(a: string, b: string, field: keyof Employee): boolean {
  if (normalizeKey(a) === normalizeKey(b)) return true;
  if (field === "department") {
    return similarity(canonDept(a), canonDept(b)) >= POLICY.similarValueAutoMerge;
  }
  if (field === "jobTitle" || field === "workLocation" || field === "address" || field === "firstName" || field === "lastName") {
    const richer = pickRicher(a, b);
    if (normalizeKey(richer) === normalizeKey(a) || normalizeKey(richer) === normalizeKey(b)) {
      if (similarity(a, b) >= 0.72) return true;
    }
    return similarity(a, b) >= POLICY.similarValueAutoMerge;
  }
  return false;
}

const REQUIRED = new Set<keyof Employee>(["firstName", "lastName", "email"]);

export function reconcile(rows: CleanedRow[]): ReconcileResult {
  const groups = new Map<string, CleanedRow[]>();
  const seenExact = new Set<string>();
  let droppedDuplicates = 0;

  for (const row of rows) {
    const fingerprint = JSON.stringify({
      ...row.data,
      file: undefined,
    });
    const exactKey = `${identityKey(row.data)}::${fingerprint}`;
    if (seenExact.has(exactKey)) {
      droppedDuplicates += 1;
      continue;
    }
    seenExact.add(exactKey);
    const key = identityKey(row.data);
    const list = groups.get(key) ?? [];
    list.push(row);
    groups.set(key, list);
  }

  const records: CanonicalRecord[] = [];
  const conflicts: MergeConflict[] = [];

  for (const [key, group] of groups) {
    const data: Partial<Employee> = {};
    const issues: string[] = [];
    const sourceRows: SourceRef[] = group.map((row) => ({
      file: row.file,
      rowNumber: row.rowNumber,
      values: row.values,
    }));
    const fieldSources: Partial<Record<keyof Employee, Array<{ value: string; from: string }>>> = {};

    for (const row of group) {
      (Object.entries(row.data) as Array<[keyof Employee, string | undefined]>).forEach(([field, value]) => {
        if (!value) return;
        const list = fieldSources[field] ?? [];
        list.push({ value, from: `${row.file} row ${row.rowNumber}` });
        fieldSources[field] = list;
      });
      row.issues.forEach((issue: CleanIssue) => {
        issues.push(issue.message);
      });
    }

    (Object.entries(fieldSources) as Array<[keyof Employee, Array<{ value: string; from: string }>]>).forEach(
      ([field, options]) => {
        const uniqueVals = new Map<string, { value: string; from: string }>();
        options.forEach((opt) => {
          const k = normalizeKey(opt.value);
          if (!uniqueVals.has(k)) uniqueVals.set(k, opt);
        });
        const distinct = Array.from(uniqueVals.values());
        const values = distinct.map((d) => d.value);
        if (distinct.length === 1) {
          (data as Record<string, string>)[field] = distinct[0].value;
          return;
        }
        if (field === "legacyId") {
          const preferred =
            distinct.find((item) => /^NW-/i.test(item.value)) ?? distinct[0];
          (data as Record<string, string>)[field] = preferred.value;
          issues.push(
            `Kept legacy id ${preferred.value}; email already identified the person (${values.join(" vs ")}).`,
          );
          return;
        }
        let merged = values[0] ?? "";
        let allSimilar = true;
        for (let i = 1; i < values.length; i += 1) {
          if (!similarEnough(merged, values[i] ?? "", field)) {
            allSimilar = false;
            break;
          }
          merged = pickRicher(merged, values[i] ?? "");
        }
        if (allSimilar) {
          (data as Record<string, string>)[field] = field === "department" ? canonDept(merged) : merged;
          issues.push(`Merged similar ${field} values: ${values.join(" · ")}`);
          return;
        }
        if (!REQUIRED.has(field)) {
          (data as Record<string, string>)[field] = values[0] ?? "";
          issues.push(`Optional ${field} disagreed (${values.join(" vs ")}); kept first and did not escalate.`);
          return;
        }
        conflicts.push({
          identityKey: key,
          field,
          options: distinct,
          name: displayName({ ...data, firstName: data.firstName ?? group[0]?.data.firstName, lastName: data.lastName ?? group[0]?.data.lastName, email: data.email ?? group[0]?.data.email }),
          email: data.email ?? group[0]?.data.email,
          legacyId: data.legacyId ?? group[0]?.data.legacyId,
        });
      },
    );

    records.push({
      id: key,
      identityKey: key,
      sourceRows,
      data,
      issues,
      blockedBy: [],
      status: "ready",
    });
  }

  return { records, conflicts, droppedDuplicates };
}
