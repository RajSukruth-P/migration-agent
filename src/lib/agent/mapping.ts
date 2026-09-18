import { POLICY } from "./policy";
import { normalizeKey } from "./text";
import type { FieldMapping, SourceTable, TargetField } from "./types";
import { aiMapFile, aiProfileFile } from "./llm";

function leftoverColumn(name: string): boolean {
  const key = normalizeKey(name);
  return /^(notes?|comment|remarks?|bank|acct|account|iban|ifsc|cost center|costcenter|cc|emp type|employment type|worker type|worker type|type|status|active|active flag|flag)$/.test(
    key,
  ) || /\b(bank|acct|note|comment|status|flag|cost center)\b/.test(key);
}

function decideFromAi(input: {
  sourceFile: string;
  sourceColumn: string;
  targetField: TargetField | "ignore" | null;
  confidence: number;
  reason: string;
  alternatives: FieldMapping["candidates"];
  sampleSize: number;
}): FieldMapping {
  const mappingId = `${input.sourceFile}::${input.sourceColumn}`;
  const candidates = [
    ...(input.targetField && input.targetField !== "ignore"
      ? [{ field: input.targetField, score: input.confidence, reason: input.reason }]
      : []),
    ...input.alternatives.filter((alt) => alt.field && alt.field !== input.targetField && alt.field !== ("ignore" as TargetField)),
  ].slice(0, 4);
  const second = candidates[1];
  const gap = input.confidence - (second?.score ?? 0);

  const base = {
    id: mappingId,
    sourceFile: input.sourceFile,
    sourceColumn: input.sourceColumn,
    candidates,
    sampleSize: input.sampleSize,
  };

  if (!input.targetField || input.targetField === "ignore" || leftoverColumn(input.sourceColumn)) {
    return {
      ...base,
      targetField: null,
      confidence: input.confidence,
      status: "ignored",
      reason: leftoverColumn(input.sourceColumn)
        ? `Leftover source column, not in Darwinbox. ${input.reason}`
        : `OpenRouter ignored this column (${Math.round(input.confidence * 100)}%): ${input.reason}`,
    };
  }

  const closeCall = Boolean(second && second.score >= 0.55 && gap < POLICY.autoMapMinGap);
  const strongEnough = input.confidence >= POLICY.autoMapMinConfidence || gap >= POLICY.autoMapMinGap;

  if (strongEnough && !closeCall) {
    return {
      ...base,
      targetField: input.targetField,
      confidence: input.confidence,
      status: "auto",
      reason: `OpenRouter mapped this at ${Math.round(input.confidence * 100)}%: ${input.reason}`,
    };
  }

  return {
    ...base,
    targetField: input.targetField,
    confidence: input.confidence,
    status: "escalated",
    reason: closeCall
      ? `"${input.sourceColumn}" could be ${input.targetField} (${Math.round(input.confidence * 100)}%) or ${second?.field} (${Math.round((second?.score ?? 0) * 100)}%). Too close to pick silently.`
      : `OpenRouter suggested ${input.targetField} at ${Math.round(input.confidence * 100)}% without a clear winner. ${input.reason}`,
  };
}

export async function mapTablesWithAi(tables: SourceTable[]): Promise<FieldMapping[]> {
  const mappings: FieldMapping[] = [];
  for (const table of tables) {
    const result = await aiMapFile(table);
    for (const column of result.mappings) {
      mappings.push(
        decideFromAi({
          sourceFile: table.fileName,
          sampleSize: result.sampleSize,
          ...column,
        }),
      );
    }
  }
  return mappings;
}

export async function profileMappingsWithAi(
  tables: SourceTable[],
  mappings: FieldMapping[],
): Promise<FieldMapping[]> {
  const next = mappings.map((mapping) => ({ ...mapping }));
  for (const table of tables) {
    const fileMaps = next.filter((mapping) => mapping.sourceFile === table.fileName);
    const structures = await aiProfileFile(
      table,
      fileMaps.map((mapping) => ({
        sourceColumn: mapping.sourceColumn,
        targetField: mapping.status === "ignored" ? null : mapping.targetField,
      })),
    );
    for (const mapping of fileMaps) {
      const structure = structures[mapping.sourceColumn];
      if (structure) mapping.structure = structure;
    }
  }
  return next;
}
