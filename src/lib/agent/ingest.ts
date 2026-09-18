import fs from "fs";
import path from "path";
import * as XLSX from "xlsx";
import type { SourceTable } from "./types";

function parseCsv(text: string): Array<Record<string, string>> {
  const input = text.replace(/^\uFEFF/, "").replace(/\r\n/g, "\n").replace(/\r/g, "\n");
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let inQuotes = false;

  for (let i = 0; i < input.length; i += 1) {
    const char = input[i];
    const next = input[i + 1];
    if (inQuotes) {
      if (char === '"' && next === '"') {
        cell += '"';
        i += 1;
      } else if (char === '"') {
        inQuotes = false;
      } else {
        cell += char;
      }
      continue;
    }
    if (char === '"') {
      inQuotes = true;
    } else if (char === ",") {
      row.push(cell);
      cell = "";
    } else if (char === "\n") {
      row.push(cell);
      rows.push(row);
      row = [];
      cell = "";
    } else {
      cell += char;
    }
  }
  if (cell.length || row.length) {
    row.push(cell);
    rows.push(row);
  }

  const header = (rows[0] ?? []).map((h) => h.trim());
  return rows.slice(1).filter((r) => r.some((c) => c.trim())).map((r) => {
    const record: Record<string, string> = {};
    header.forEach((key, index) => {
      record[key] = (r[index] ?? "").trim();
    });
    return record;
  });
}

function cellString(value: unknown): string {
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return value.toISOString().slice(0, 10);
  }
  return String(value ?? "").trim();
}

function sheetToRows(sheet: XLSX.WorkSheet): Array<Record<string, string>> {
  const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, {
    defval: "",
    raw: false,
  });
  return rows.map((row) => {
    const record: Record<string, string> = {};
    Object.entries(row).forEach(([key, value]) => {
      record[String(key).trim()] = cellString(value);
    });
    return record;
  });
}

export function parseWorkbook(fileName: string, buffer: Buffer): SourceTable {
  const ext = path.extname(fileName).toLowerCase();
  let rows: Array<Record<string, string>>;
  if (ext === ".csv" || ext === ".txt") {
    rows = parseCsv(buffer.toString("utf8"));
  } else {
    const wb = XLSX.read(buffer, { type: "buffer", cellDates: true, raw: false });
    const sheetName = wb.SheetNames[0];
    if (!sheetName) {
      rows = [];
    } else {
      rows = sheetToRows(wb.Sheets[sheetName]);
    }
  }
  const columns = rows[0] ? Object.keys(rows[0]) : [];
  return { fileName: path.basename(fileName), columns, rows };
}

export function loadSampleTables(): SourceTable[] {
  const dir = path.join(process.cwd(), "data/samples");
  const files = ["legacy_hr.csv", "payroll.xlsx", "contractors.csv"];
  return files.map((name) => {
    const filePath = path.join(dir, name);
    return parseWorkbook(name, fs.readFileSync(filePath));
  });
}
