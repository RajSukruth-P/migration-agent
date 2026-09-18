import { inferDateOrder, parseDate, type DateOrder } from "./dates";
import { DEPARTMENT_SYNONYMS } from "./policy";
import { collapseSpace, looksLikeEmail, normalizeKey, normalizePhone, splitName, titleCase } from "./text";
import type { Employee, FieldMapping, SourceTable, TargetField } from "./types";

export interface CleanIssue {
  field: string;
  kind: "ambiguous_date" | "unparseable_date" | "unknown_enum" | "missing" | "invalid_email" | "invalid_phone" | "name_split";
  original: string;
  message: string;
  options?: string[];
}

export interface CleanedRow {
  file: string;
  rowNumber: number;
  values: Record<string, string>;
  data: Partial<Employee>;
  issues: CleanIssue[];
}

function canonDept(value: string): string {
  const key = normalizeKey(value);
  return DEPARTMENT_SYNONYMS[key] ?? titleCase(value);
}

function applyDate(field: "hireDate" | "dateOfBirth", original: string, dateOrder: DateOrder): {
  value?: string;
  issue?: CleanIssue;
} {
  const parsed = parseDate(original, dateOrder === "unknown" ? "DMY" : dateOrder);
  if (parsed.iso) return { value: parsed.iso };
  if (parsed.ambiguous) {
    return {
      issue: {
        field,
        kind: "ambiguous_date",
        original,
        options: parsed.ambiguous,
        message: `"${original}" could be ${parsed.ambiguous[0]} or ${parsed.ambiguous[1]}, and this file has no clear DMY/MDY convention.`,
      },
    };
  }
  return {
    issue: {
      field,
      kind: "unparseable_date",
      original,
      message: `I cannot turn "${original}" into a date.`,
    },
  };
}

function applyScalar(
  field: TargetField,
  raw: string,
  dateOrder: DateOrder,
): { value?: string; issue?: CleanIssue } {
  const original = collapseSpace(raw);
  if (!original) return {};

  if (field === "email") {
    const email = original.toLowerCase();
    if (!looksLikeEmail(email)) {
      return {
        issue: {
          field,
          kind: "invalid_email",
          original,
          message: `"${original}" is not a usable email.`,
        },
      };
    }
    return { value: email };
  }

  if (field === "hireDate" || field === "dateOfBirth") {
    return applyDate(field, original, dateOrder);
  }

  if (field === "phoneNumber") {
    const phone = normalizePhone(original);
    if (!phone) {
      return {
        issue: {
          field,
          kind: "invalid_phone",
          original,
          message: `"${original}" does not look like a phone number.`,
        },
      };
    }
    return { value: phone };
  }

  if (field === "department") return { value: canonDept(original) };
  if (field === "legacyId") return { value: original.toUpperCase() };
  if (
    field === "firstName" ||
    field === "lastName" ||
    field === "jobTitle" ||
    field === "workLocation" ||
    field === "address"
  ) {
    return { value: titleCase(original) };
  }
  return { value: original };
}

function dateOrderFor(mapping: FieldMapping | undefined, table: SourceTable): DateOrder {
  if (mapping?.structure?.dateOrder) return mapping.structure.dateOrder;
  if (!mapping) return "DMY";
  const inferred = inferDateOrder(table.rows.map((row) => row[mapping.sourceColumn] ?? ""));
  return inferred === "unknown" ? "DMY" : inferred;
}

export function cleanTables(tables: SourceTable[], mappings: FieldMapping[]): CleanedRow[] {
  const cleaned: CleanedRow[] = [];

  for (const table of tables) {
    const fileMaps = mappings.filter(
      (m) => m.sourceFile === table.fileName && m.targetField && m.status !== "ignored" && m.status !== "escalated",
    );

    table.rows.forEach((values, index) => {
      const data: Partial<Employee> = {};
      const issues: CleanIssue[] = [];

      for (const mapping of fileMaps) {
        const raw = values[mapping.sourceColumn] ?? "";
        if (mapping.targetField === "fullName") {
          const split = splitName(raw);
          data.firstName = split.firstName;
          data.lastName = split.lastName || data.lastName;
          if (split.firstName && !split.lastName) {
            issues.push({
              field: "lastName",
              kind: "name_split",
              original: raw,
              message: `"${raw}" has no last name. I will not invent one.`,
            });
          }
          continue;
        }
        const order = dateOrderFor(mapping, table);
        const result = applyScalar(mapping.targetField as TargetField, raw, order);
        if (result.value) {
          (data as Record<string, string>)[mapping.targetField as string] = result.value;
        }
        if (result.issue) issues.push(result.issue);
      }

      cleaned.push({
        file: table.fileName,
        rowNumber: index + 2,
        values,
        data,
        issues,
      });
    });
  }

  return cleaned;
}

export { canonDept };
