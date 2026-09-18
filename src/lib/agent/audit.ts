import { fieldLabel, humanizeFields } from "./labels";
import type { CanonicalRecord, Escalation, FieldMapping } from "./types";

export interface AuditStep {
  text: string;
  tone: "info" | "warn" | "ok";
}

export function auditFor(
  record: CanonicalRecord,
  mappings: FieldMapping[],
  escalations: Escalation[],
): AuditStep[] {
  const steps: AuditStep[] = [];
  const files = record.sourceRows.map((row) => ({
    file: row.file.replace(/\.(csv|xlsx|xls)$/i, ""),
    rowNumber: row.rowNumber,
    sourceFile: row.file,
    values: row.values,
  }));

  if (files.length) {
    steps.push({
      text: `Read ${files.map((row) => `${row.file} row ${row.rowNumber}`).join(" + ")}`,
      tone: "info",
    });
  }

  const mapped: string[] = [];
  for (const source of record.sourceRows) {
    for (const mapping of mappings) {
      if (mapping.sourceFile !== source.file || !mapping.targetField || mapping.status === "ignored") continue;
      if (!source.values[mapping.sourceColumn]) continue;
      const label = `${mapping.sourceColumn} → ${fieldLabel(mapping.targetField)}`;
      if (!mapped.includes(label)) mapped.push(label);
    }
  }
  if (mapped.length) {
    steps.push({
      text: `Mapped ${mapped.length} columns: ${mapped.slice(0, 3).join(", ")}${mapped.length > 3 ? "…" : ""}`,
      tone: "ok",
    });
  }

  if (files.length > 1) {
    steps.push({
      text: `Merged ${[...new Set(files.map((row) => row.file))].join(" + ")}`,
      tone: "ok",
    });
  }

  if (record.issues[0]) {
    steps.push({ text: humanizeFields(record.issues[0]), tone: "warn" });
  }

  for (const item of escalations) {
    const recordId = String(item.context.recordId ?? item.suggestion.payload.recordId ?? "");
    if (recordId !== record.id || !item.resolution) continue;
    const action = item.resolution.action === "reject" ? "Skipped" : "Human set";
    steps.push({ text: `${action}: ${item.title}`, tone: item.resolution.action === "reject" ? "warn" : "ok" });
  }

  if (record.status === "pushed" && record.push?.targetId) {
    steps.push({ text: `Pushed as ${record.push.targetId}`, tone: "ok" });
  } else if (record.status === "failed") {
    steps.push({ text: `Push failed${record.push?.error ? `: ${record.push.error}` : ""}`, tone: "warn" });
  } else if (record.status === "rolled_back") {
    steps.push({ text: "Rolled back from Darwinbox", tone: "warn" });
  } else if (record.status === "blocked") {
    steps.push({ text: "Waiting on a human decision", tone: "warn" });
  } else if (record.status === "ready") {
    steps.push({ text: "Ready to push", tone: "ok" });
  }

  return dedupe(steps).slice(0, 5);
}

export function auditSummary(record: CanonicalRecord): string {
  if (record.status === "blocked") return "Needs review";
  if (record.status === "failed") return "Push failed";
  if (record.status === "rolled_back") return "Rolled back";
  if (record.status === "pushed") return record.push?.targetId || "Pushed";
  if (record.sourceRows.length > 1) return "Mapped · merged";
  return "Mapped";
}

function dedupe(steps: AuditStep[]): AuditStep[] {
  const seen = new Set<string>();
  return steps.filter((step) => {
    if (seen.has(step.text)) return false;
    seen.add(step.text);
    return true;
  });
}
