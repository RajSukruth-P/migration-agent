import { parseDate } from "./dates";
import { fieldLabel } from "./labels";
import { collapseSpace, looksLikeEmail, normalizeKey, normalizePhone, splitName, titleCase } from "./text";
import type { CanonicalRecord, Employee, SourceRef } from "./types";
import type { ValidationFailure } from "./validate";

export interface RepairResult {
  field: keyof Employee;
  value: string;
  how: string;
}

/**
 * A second attempt only gets to read columns that mean the same thing as the
 * field it is filling. Without this a job title donates a surname and a date
 * of birth lands in Hire Date.
 */
const COLUMN_HINTS: Partial<Record<keyof Employee, { allow: RegExp; deny?: RegExp }>> = {
  firstName: { allow: /\bname\b/, deny: /user ?name|file ?name|company|dept|department|title|role|location/ },
  lastName: { allow: /\bname\b/, deny: /user ?name|file ?name|company|dept|department|title|role|location/ },
  email: { allow: /mail/ },
  phoneNumber: { allow: /phone|mobile|contact|tel/ },
  hireDate: { allow: /hire|join|start|doj|employ/, deny: /birth|dob|end|exit|term/ },
  dateOfBirth: { allow: /birth|dob/ },
  jobTitle: { allow: /title|role|designation|position/, deny: /dept|department/ },
  department: { allow: /dept|department|org|division|function/ },
  workLocation: { allow: /location|office|site|city|branch/ },
  address: { allow: /address|street|residence/ },
  legacyId: { allow: /\bid\b|code|number|emp/ },
};

function relevantValues(record: CanonicalRecord, field: keyof Employee): Array<{ value: string; source: SourceRef }> {
  const hint = COLUMN_HINTS[field];
  const found: Array<{ value: string; source: SourceRef }> = [];
  for (const source of record.sourceRows) {
    for (const [column, raw] of Object.entries(source.values)) {
      const value = collapseSpace(raw ?? "");
      if (!value) continue;
      if (hint) {
        const key = normalizeKey(column);
        if (hint.deny?.test(key)) continue;
        if (!hint.allow.test(key)) continue;
      }
      found.push({ value, source });
    }
  }
  return found;
}

function fileOf(source: SourceRef): string {
  return source.file.replace(/\.(csv|xlsx|xls)$/i, "");
}

/**
 * Second attempt at a value the first cleanup pass could not fix.
 *
 * Cleanup works one source row at a time under the column's inferred
 * convention. This pass is allowed to look across every row that merged into
 * the person, and to try date orders the file-level convention ruled out.
 * A field only escalates if this fails too.
 */
export function repairFailure(failure: ValidationFailure, record: CanonicalRecord): RepairResult | null {
  const field = failure.field as keyof Employee;

  if (field === "hireDate" || field === "dateOfBirth") return repairDate(field, record);
  if (field === "email") return repairEmail(record);
  if (field === "firstName" || field === "lastName") return repairName(field, record);
  if (field === "phoneNumber") return repairPhone(record);
  return repairText(field, record);
}

function repairDate(field: "hireDate" | "dateOfBirth", record: CanonicalRecord): RepairResult | null {
  for (const { value, source } of relevantValues(record, field)) {
    for (const order of ["DMY", "MDY", "YMD"] as const) {
      const parsed = parseDate(value, order);
      if (parsed.iso) {
        return {
          field,
          value: parsed.iso,
          how: `Read ${fieldLabel(field)} “${value}” from ${fileOf(source)} as ${order === "MDY" ? "month-first" : order === "YMD" ? "year-first" : "day-first"}`,
        };
      }
    }
  }
  return null;
}

function repairEmail(record: CanonicalRecord): RepairResult | null {
  for (const { value, source } of relevantValues(record, "email")) {
    const repaired = value
      .toLowerCase()
      .replace(/^mailto:/, "")
      .replace(/\s+at\s+/g, "@")
      .replace(/\s+dot\s+/g, ".")
      .replace(/\s+/g, "")
      .replace(/\.{2,}/g, ".");
    if (!looksLikeEmail(repaired)) continue;
    return {
      field: "email",
      value: repaired,
      how:
        repaired === value.toLowerCase()
          ? `Found Email ${repaired} in ${fileOf(source)}`
          : `Repaired “${value}” into ${repaired}`,
    };
  }
  return null;
}

function repairName(field: "firstName" | "lastName", record: CanonicalRecord): RepairResult | null {
  for (const { value, source } of relevantValues(record, field)) {
    if (value.includes("@") || /\d/.test(value)) continue;
    const split = splitName(value);
    if (!split.firstName || !split.lastName) continue;
    const found = field === "firstName" ? split.firstName : split.lastName;
    return {
      field,
      value: found,
      how: `Took ${fieldLabel(field)} from “${value}” in ${fileOf(source)}`,
    };
  }
  return null;
}

function repairPhone(record: CanonicalRecord): RepairResult | null {
  for (const { value, source } of relevantValues(record, "phoneNumber")) {
    if (value.includes("@")) continue;
    const phone = normalizePhone(value);
    if (!phone) continue;
    return {
      field: "phoneNumber",
      value: phone,
      how: `Normalized Phone Number “${value}” from ${fileOf(source)}`,
    };
  }
  return null;
}

/**
 * A human correction is the last thing standing between a bad value and the
 * tenant, so it gets the same shape check the agent holds itself to.
 */
export function cleanCorrection(field: keyof Employee, raw: string): string {
  const value = collapseSpace(raw);
  if (!value) throw new Error(`${fieldLabel(field)} cannot be empty.`);

  if (field === "email") {
    const email = value.toLowerCase();
    if (!looksLikeEmail(email)) throw new Error(`"${value}" is not a valid email address.`);
    return email;
  }
  if (field === "hireDate" || field === "dateOfBirth") {
    const parsed = parseDate(value, "DMY");
    if (!parsed.iso) throw new Error(`I cannot read "${value}" as a date. Use DD/MM/YYYY.`);
    return parsed.iso;
  }
  if (field === "phoneNumber") {
    const phone = normalizePhone(value);
    if (!phone) throw new Error(`"${value}" is not a valid phone number.`);
    return phone;
  }
  if (field === "firstName" || field === "lastName") {
    if (value.includes("@") || /\d/.test(value)) {
      throw new Error(`"${value}" does not look like a ${fieldLabel(field)}.`);
    }
    return titleCase(value);
  }
  return value;
}

function repairText(field: keyof Employee, record: CanonicalRecord): RepairResult | null {
  if (record.data[field]) return null;
  for (const { value, source } of relevantValues(record, field)) {
    const shaped = collapseSpace(titleCase(value));
    if (!shaped) continue;
    return {
      field,
      value: shaped,
      how: `Filled ${fieldLabel(field)} from ${fileOf(source)}`,
    };
  }
  return null;
}
