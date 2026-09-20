import { POLICY } from "./policy";
import { TARGET_FIELD_NAMES, TARGET_SCHEMA } from "./schema";
import type { ColumnStructure, MappingCandidate, SourceTable, TargetField } from "./types";

const OPENROUTER_URL = "https://openrouter.ai/api/v1/chat/completions";

export function sampleRows<T>(rows: T[], min = POLICY.sampleMin, max = POLICY.sampleMax): T[] {
  if (rows.length <= max) return rows;
  const picked = [...rows];
  for (let i = picked.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [picked[i], picked[j]] = [picked[j]!, picked[i]!];
  }
  return picked.slice(0, Math.max(min, Math.min(max, picked.length)));
}

function apiKey(): string {
  return (process.env.OPENROUTER_API_KEY || "").trim();
}

function modelName(): string {
  return (process.env.OPENROUTER_MODEL || "openai/gpt-4o-mini").trim();
}

function parseJsonObject(text: string): Record<string, unknown> {
  const trimmed = text.trim().replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "");
  return JSON.parse(trimmed) as Record<string, unknown>;
}

function asConfidence(value: unknown): number {
  const n = Number(value);
  if (!Number.isFinite(n)) return 0;
  return n > 1 ? Math.min(1, n / 100) : Math.max(0, Math.min(1, n));
}

async function chatJson(messages: Array<{ role: string; content: string }>, maxTokens = 1800): Promise<Record<string, unknown>> {
  const key = apiKey();
  if (!key) {
    throw new Error("OPENROUTER_API_KEY is missing. Add it to migration-agent/.env.local.");
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 90000);
  try {
    const response = await fetch(OPENROUTER_URL, {
      method: "POST",
      signal: controller.signal,
      headers: {
        Authorization: `Bearer ${key}`,
        "Content-Type": "application/json",
        "HTTP-Referer": "http://localhost:3000",
        "X-Title": "Darwinbox Migration Agent",
      },
      body: JSON.stringify({
        model: modelName(),
        temperature: 0,
        max_tokens: maxTokens,
        response_format: { type: "json_object" },
        messages,
      }),
    });
    const raw = await response.text();
    if (!response.ok) {
      throw new Error("Could not complete column mapping. Please try again.");
    }
    const body = JSON.parse(raw) as {
      choices?: Array<{ message?: { content?: string } }>;
      error?: { message?: string };
    };
    if (body.error?.message) throw new Error("Could not complete column mapping. Please try again.");
    const content = body.choices?.[0]?.message?.content;
    if (!content) throw new Error("Could not complete column mapping. Please try again.");
    return parseJsonObject(content);
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") {
      throw new Error("Column mapping took too long. Please try again.");
    }
    throw error;
  } finally {
    clearTimeout(timer);
  }
}

export interface AiColumnMapping {
  sourceColumn: string;
  targetField: TargetField | "ignore" | null;
  confidence: number;
  reason: string;
  alternatives: MappingCandidate[];
}

export async function aiMapFile(table: SourceTable): Promise<{
  sampleSize: number;
  mappings: AiColumnMapping[];
}> {
  const rows = sampleRows(table.rows);
  const payload = {
    sourceFile: table.fileName,
    sourceColumns: table.columns,
    sampleRowCount: rows.length,
    sampleRows: rows,
    targetSchema: TARGET_SCHEMA,
  };

  const result = await chatJson(
    [
      {
        role: "system",
        content: `You are an HR data-migration mapper. Map each SOURCE column to exactly one TARGET field from this list: ${TARGET_FIELD_NAMES.join(", ")}.
Rules:
- Use column names AND the sample values.
- Use 0.97-0.99 for obvious mappings (email, first/last name, hire date, phone, department, job title, work location, address, DOB, source employee id → legacyId).
- Use fullName only when a single source column holds a complete person name that must be split.
- Use ignore for leftover columns (bank account, notes, employment type, status flags, cost center). Confidence for ignore can be 0.99.
- Do not map two source columns to the same target unless one is a duplicate; then ignore the weaker one.
- Only go below 0.80 when two Darwinbox fields are genuinely competing (example: Role_or_Dept → department vs jobTitle).
- confidence is 0-1.
- Reply JSON only: {"mappings":[{"sourceColumn":"","targetField":"","confidence":0.0,"reason":"","alternatives":[{"field":"","score":0.0,"reason":""}]}]}
- Include every source column exactly once.`,
      },
      { role: "user", content: JSON.stringify(payload) },
    ],
    2200,
  );

  const rawMappings = Array.isArray(result.mappings) ? result.mappings : [];
  const byColumn = new Map<string, AiColumnMapping>();
  for (const item of rawMappings) {
    const row = item as Record<string, unknown>;
    const sourceColumn = String(row.sourceColumn ?? "");
    if (!sourceColumn) continue;
    const target = String(row.targetField ?? "ignore");
    const alternatives = Array.isArray(row.alternatives)
      ? (row.alternatives as Array<Record<string, unknown>>).map((alt) => ({
          field: String(alt.field ?? "ignore") as TargetField,
          score: asConfidence(alt.score ?? alt.confidence),
          reason: String(alt.reason ?? ""),
        }))
      : [];
    byColumn.set(sourceColumn, {
      sourceColumn,
      targetField: TARGET_FIELD_NAMES.includes(target as (typeof TARGET_FIELD_NAMES)[number])
        ? (target as TargetField | "ignore")
        : "ignore",
      confidence: asConfidence(row.confidence),
      reason: String(row.reason ?? "Mapped from the source column."),
      alternatives,
    });
  }

  const mappings = table.columns.map((column) => {
    return (
      byColumn.get(column) ?? {
        sourceColumn: column,
        targetField: "ignore" as const,
        confidence: 0,
        reason: "Model omitted this column; treating it as leftover.",
        alternatives: [],
      }
    );
  });

  return { sampleSize: rows.length, mappings };
}

export async function aiProfileFile(
  table: SourceTable,
  mappedColumns: Array<{ sourceColumn: string; targetField: TargetField | null }>,
): Promise<Record<string, ColumnStructure>> {
  const active = mappedColumns.filter((item) => item.targetField);
  if (!active.length) return {};
  const rows = sampleRows(table.rows);
  const result = await chatJson(
    [
      {
        role: "system",
        content: `You infer the physical structure of HR source columns from sample values.
For each column return valueType (string|email|date|enum|boolean|id|name|unknown), format (e.g. DD/MM/YYYY, email, free-text), dateOrder (DMY|MDY|YMD|null), enumValues (array or null), nullable, confidence 0-1, reason.
If date order is clear from the samples, confidence should be 0.97+. Only go below 0.80 when the same values could be both DMY and MDY with no unambiguous dates in the file.
Reply JSON: {"columns":[{"sourceColumn":"","valueType":"","format":"","dateOrder":null,"enumValues":null,"nullable":true,"confidence":0.0,"reason":""}]}`,
      },
      {
        role: "user",
        content: JSON.stringify({
          sourceFile: table.fileName,
          columns: active,
          sampleRows: rows.map((row) => {
            const slice: Record<string, string> = {};
            active.forEach((col) => {
              slice[col.sourceColumn] = row[col.sourceColumn] ?? "";
            });
            return slice;
          }),
        }),
      },
    ],
    1600,
  );

  const columns = Array.isArray(result.columns) ? result.columns : [];
  const structures: Record<string, ColumnStructure> = {};
  for (const item of columns) {
    const row = item as Record<string, unknown>;
    const sourceColumn = String(row.sourceColumn ?? "");
    if (!sourceColumn) continue;
    const dateOrder = String(row.dateOrder ?? "") as ColumnStructure["dateOrder"];
    structures[sourceColumn] = {
      valueType: String(row.valueType ?? "unknown") as ColumnStructure["valueType"],
      format: row.format ? String(row.format) : undefined,
      dateOrder: dateOrder === "DMY" || dateOrder === "MDY" || dateOrder === "YMD" ? dateOrder : undefined,
      enumValues: Array.isArray(row.enumValues) ? row.enumValues.map((v) => String(v)) : undefined,
      nullable: Boolean(row.nullable),
      confidence: asConfidence(row.confidence),
      reason: String(row.reason ?? "Inferred from the column values."),
    };
  }
  return structures;
}
