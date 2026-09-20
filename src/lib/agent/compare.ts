import { isoToDmy } from "./dates";
import { fieldLabel } from "./labels";
import { TARGET_FIELDS, type CanonicalRecord, type Employee, type FieldMapping } from "./types";

export interface FieldComparison {
  field: string;
  label: string;
  original: string;
  originColumn: string;
  originFile: string;
  migrated: string;
  changed: boolean;
}

export function sourceFiles(record: CanonicalRecord): string[] {
  return [...new Set(record.sourceRows.map((row) => shortFile(row.file)))];
}

export function shortFile(file: string): string {
  return file.replace(/\.(csv|xlsx|xls)$/i, "");
}

export function compareRecord(record: CanonicalRecord, mappings: FieldMapping[]): FieldComparison[] {
  const rows: FieldComparison[] = [];

  for (const field of TARGET_FIELDS) {
    const migrated = display(field, record.data[field as keyof Employee]);
    const origin = findOrigin(record, mappings, field);
    if (!migrated && !origin.value) continue;
    rows.push({
      field,
      label: fieldLabel(field),
      original: origin.value,
      originColumn: origin.column,
      originFile: origin.file,
      migrated,
      changed: normalize(origin.value) !== normalize(migrated),
    });
  }

  return rows;
}

function findOrigin(
  record: CanonicalRecord,
  mappings: FieldMapping[],
  field: string,
): { value: string; column: string; file: string } {
  for (const source of record.sourceRows) {
    for (const mapping of mappings) {
      if (mapping.sourceFile !== source.file || mapping.status === "ignored") continue;
      const hits =
        mapping.targetField === field ||
        (mapping.targetField === "fullName" && (field === "firstName" || field === "lastName"));
      if (!hits) continue;
      const raw = (source.values[mapping.sourceColumn] ?? "").trim();
      if (!raw) continue;
      return { value: raw, column: mapping.sourceColumn, file: shortFile(source.file) };
    }
  }
  return { value: "", column: "", file: "" };
}

function display(field: string, value?: string): string {
  if (!value) return "";
  if (field === "hireDate" || field === "dateOfBirth") return isoToDmy(value) || value;
  return value;
}

function normalize(value: string): string {
  return value.replace(/\s+/g, " ").trim().toLowerCase();
}
