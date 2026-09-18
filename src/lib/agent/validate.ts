import { looksLikeEmail } from "./text";
import { REQUIRED_FIELDS, type CanonicalRecord } from "./types";
import type { CleanIssue, CleanedRow } from "./clean";

export interface ValidationFailure {
  recordId: string;
  field: string;
  message: string;
  original?: string;
  options?: string[];
  kind: CleanIssue["kind"] | "missing";
  name: string;
}

function nameOf(record: CanonicalRecord): string {
  return (
    [record.data.firstName, record.data.lastName].filter(Boolean).join(" ") ||
    record.data.email ||
    record.data.legacyId ||
    record.id
  );
}

export function collectRowIssues(rows: CleanedRow[], records: CanonicalRecord[]): ValidationFailure[] {
  const failures: ValidationFailure[] = [];
  const byFileRow = new Map<string, CanonicalRecord>();
  records.forEach((record) => {
    record.sourceRows.forEach((src) => {
      byFileRow.set(`${src.file}:${src.rowNumber}`, record);
    });
  });

  for (const row of rows) {
    const record = byFileRow.get(`${row.file}:${row.rowNumber}`);
    if (!record || record.status === "dropped") continue;
    for (const issue of row.issues) {
      failures.push({
        recordId: record.id,
        field: issue.field,
        message: issue.message,
        original: issue.original,
        options: issue.options,
        kind: issue.kind,
        name: nameOf(record),
      });
    }
  }
  return failures;
}

export function validateRecords(records: CanonicalRecord[]): ValidationFailure[] {
  const failures: ValidationFailure[] = [];
  const emails = new Map<string, string>();

  for (const record of records) {
    if (record.status === "dropped") continue;
    for (const field of REQUIRED_FIELDS) {
      const value = record.data[field];
      if (!value) {
        failures.push({
          recordId: record.id,
          field,
          kind: "missing",
          message: `Required field ${field} is still empty after cleanup.`,
          name: nameOf(record),
        });
      }
    }
    if (record.data.email && !looksLikeEmail(record.data.email)) {
      failures.push({
        recordId: record.id,
        field: "email",
        kind: "invalid_email",
        original: record.data.email,
        message: `Email ${record.data.email} is invalid.`,
        name: nameOf(record),
      });
    }
    if (record.data.email) {
      const prev = emails.get(record.data.email);
      if (prev && prev !== record.id) {
        failures.push({
          recordId: record.id,
          field: "email",
          kind: "missing",
          message: `Email ${record.data.email} collided with another identity after merge.`,
          name: nameOf(record),
        });
      } else {
        emails.set(record.data.email, record.id);
      }
    }
  }
  return failures;
}
