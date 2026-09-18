import { EventEmitter } from "events";
import { cleanTables } from "./clean";
import { inferDateOrder } from "./dates";
import { loadSampleTables, parseWorkbook } from "./ingest";
import { mapTablesWithAi, profileMappingsWithAi } from "./mapping";
import { fieldLabel } from "./labels";
import { POLICY_SUMMARY } from "./policy";
import { reconcile } from "./reconcile";
import { cleanCorrection, repairFailure } from "./repair";
import { collapseSpace, id, nowIso, sleep } from "./text";
import type {
  CanonicalRecord,
  Employee,
  Escalation,
  FieldMapping,
  JobPhase,
  JobSnapshot,
  JobStats,
  ResolveInput,
  SourceTable,
  TargetField,
} from "./types";
import { collectRowIssues, validateRecords, type ValidationFailure } from "./validate";
import { listTargetEmployees, pushEmployee, rollbackJob } from "../target/store";

const PACE = 70;

export class MigrationJob extends EventEmitter {
  id: string;
  clientName = "Northwind People Ops";
  targetSystem = "Darwinbox (mock)";
  phase: JobPhase = "idle";
  createdAt = nowIso();
  tables: SourceTable[] = [];
  mappings: FieldMapping[] = [];
  records: CanonicalRecord[] = [];
  escalations: Escalation[] = [];
  events: JobSnapshot["events"] = [];
  mappingOverrides: Record<string, TargetField | null> = {};
  valueOverrides: Record<string, Partial<Employee>> = {};
  dropped = new Set<string>();
  running = false;
  profiled = false;
  /** Fields this job has already tried to repair a second time. */
  repairTried = new Set<string>();

  constructor() {
    super();
    this.id = id("job");
    this.setMaxListeners(50);
  }

  snapshot(): JobSnapshot {
    return {
      id: this.id,
      clientName: this.clientName,
      targetSystem: this.targetSystem,
      phase: this.phase,
      createdAt: this.createdAt,
      files: this.tables.map((t) => ({
        name: t.fileName,
        rows: t.rows.length,
        columns: t.columns,
      })),
      mappings: this.mappings,
      escalations: this.escalations,
      records: this.records,
      events: this.events,
      stats: this.stats(),
      policy: POLICY_SUMMARY,
    };
  }

  stats(): JobStats {
    return {
      files: this.tables.length,
      sourceRows: this.tables.reduce((n, t) => n + t.rows.length, 0),
      uniquePeople: this.records.filter((r) => r.status !== "dropped").length,
      autoMapped: this.mappings.filter((m) => m.status === "auto").length,
      ignoredColumns: this.mappings.filter((m) => m.status === "ignored").length,
      escalationsOpen: this.escalations.filter((e) => e.status === "open").length,
      escalationsResolved: this.escalations.filter((e) => e.status !== "open").length,
      ready: this.records.filter((r) => r.status === "ready").length,
      blocked: this.records.filter((r) => r.status === "blocked").length,
      dropped: this.records.filter((r) => r.status === "dropped").length,
      pushed: this.records.filter((r) => r.status === "pushed").length,
      failed: this.records.filter((r) => r.status === "failed").length,
      rolledBack: this.records.filter((r) => r.status === "rolled_back").length,
    };
  }

  log(level: JobSnapshot["events"][number]["level"], message: string, detail?: Record<string, unknown>) {
    this.events.push({
      id: id("evt"),
      at: nowIso(),
      level,
      phase: this.phase,
      message,
      detail,
    });
    if (this.events.length > 250) this.events.splice(0, this.events.length - 250);
    this.emit("change");
  }

  setPhase(phase: JobPhase) {
    this.phase = phase;
    this.emit("change");
  }

  async loadSamples() {
    this.tables = loadSampleTables();
  }

  loadUploads(files: Array<{ name: string; buffer: Buffer }>) {
    this.tables = files.map((file) => parseWorkbook(file.name, file.buffer));
  }

  async start() {
    if (this.running) return;
    this.running = true;
    try {
      await this.pipeline();
    } catch (error) {
      this.setPhase("failed");
      this.log("error", error instanceof Error ? error.message : "Agent failed");
    } finally {
      this.running = false;
      this.emit("change");
    }
  }

  private async pipeline() {
    await this.ingestStage();
    await this.mapStage();
    if (this.hasOpenMappingEscalations()) {
      this.setPhase("awaiting_mapping");
      this.log("warn", "Column mapping is not finished. I will not migrate any rows yet.");
      return;
    }
    await this.rowStage();
  }

  private async ingestStage() {
    this.setPhase("ingesting");
    this.log("info", `Received ${this.tables.length} file(s).`);
    await sleep(PACE);
    for (const table of this.tables) {
      this.log("success", `Received ${table.fileName}: ${table.rows.length} rows, ${table.columns.length} columns.`);
      await sleep(PACE);
    }
  }

  private async mapStage() {
    this.setPhase("mapping");
    this.log(
      "info",
      "Sending each file's column names, the Darwinbox target schema, and 20-50 random rows to OpenRouter.",
    );
    this.mappings = await mapTablesWithAi(this.tables);
    this.applyMappingOverrides();

    const auto = this.mappings.filter((m) => m.status === "auto");
    const ignored = this.mappings.filter((m) => m.status === "ignored");
    const unsure = this.mappings.filter((m) => m.status === "escalated");
    this.log(
      "success",
      `OpenRouter auto-mapped ${auto.length} column(s). ${unsure.length} close call(s) need you. Ignored ${ignored.length} leftover column(s).`,
    );
    for (const mapping of auto) {
      this.log(
        "info",
        `${mapping.sourceFile} · ${mapping.sourceColumn} → ${mapping.targetField} (${Math.round(mapping.confidence * 100)}%, n=${mapping.sampleSize ?? "—"})`,
      );
    }
    for (const mapping of ignored) {
      this.log("info", `Ignored ${mapping.sourceFile} · ${mapping.sourceColumn}. ${mapping.reason}`);
    }
    for (const mapping of unsure) {
      this.upsertEscalation(`map:${mapping.id}`, {
        kind: "ambiguous_mapping",
        title: `Where should “${mapping.sourceColumn}” go?`,
        why: mapping.reason,
        suggestion: {
          label: `Map to ${mapping.targetField ?? mapping.candidates[0]?.field ?? "department"}`,
          payload: {
            mappingId: mapping.id,
            targetField: mapping.targetField ?? mapping.candidates[0]?.field ?? null,
          },
        },
        context: {
          mappingId: mapping.id,
          file: mapping.sourceFile,
          column: mapping.sourceColumn,
          samples: this.tables
            .find((t) => t.fileName === mapping.sourceFile)
            ?.rows.slice(0, 6)
            .map((row) => row[mapping.sourceColumn]),
          candidates: mapping.candidates.length
            ? mapping.candidates
            : mapping.targetField
              ? [{ field: mapping.targetField, score: mapping.confidence, reason: mapping.reason }]
              : [],
        },
      });
      this.log("warn", `Paused mapping for ${mapping.sourceFile} · ${mapping.sourceColumn}. ${mapping.reason}`);
    }
  }

  private async rowStage() {
    this.setPhase("profiling");
    this.log("info", "Column mapping is done. Now migrating rows.");
    this.log("info", "Asking OpenRouter for each mapped column's structure type (date order, email, enum, id).");
    this.mappings = await profileMappingsWithAi(this.tables, this.mappings);
    this.applyMappingOverrides();
    for (const mapping of this.mappings) {
      if (!mapping.structure || mapping.status === "ignored") continue;
      const table = this.tables.find((item) => item.fileName === mapping.sourceFile);
      if (
        (mapping.targetField === "hireDate" || mapping.targetField === "dateOfBirth" || mapping.structure.valueType === "date") &&
        !mapping.structure.dateOrder &&
        table
      ) {
        const inferred = inferDateOrder(table.rows.map((row) => row[mapping.sourceColumn] ?? ""));
        if (inferred === "DMY" || inferred === "MDY" || inferred === "YMD") {
          mapping.structure.dateOrder = inferred;
        } else {
          mapping.structure.dateOrder = "DMY";
        }
      }
      this.log(
        "success",
        `${mapping.sourceFile} · ${mapping.sourceColumn}: ${mapping.structure.valueType}${
          mapping.structure.format ? ` · ${mapping.structure.format}` : ""
        }${mapping.structure.dateOrder ? ` · ${mapping.structure.dateOrder}` : ""} (${Math.round(mapping.structure.confidence * 100)}%)`,
      );
    }
    this.profiled = true;

    await this.rebuild();
    if (this.hasOpenEscalations()) {
      this.setPhase("awaiting_human");
      this.log("warn", `I am confident about the rest. ${this.stats().escalationsOpen} item(s) need a human call.`);
      return;
    }
    await this.pushReady("auto");
  }

  async resolve(input: ResolveInput) {
    const escalation = this.escalations.find((e) => e.id === input.escalationId);
    if (!escalation || escalation.status !== "open") {
      throw new Error("Escalation is not open");
    }
    const payload = { ...(escalation.suggestion.payload ?? {}), ...(input.payload ?? {}) };
    const continueNow = !this.running;

    if (escalation.kind === "ambiguous_mapping") {
      const mappingId = String(payload.mappingId ?? escalation.context.mappingId);
      if (input.action === "reject") {
        this.mappingOverrides[mappingId] = null;
      } else {
        this.mappingOverrides[mappingId] = (payload.targetField as TargetField) ?? null;
      }
    } else if (escalation.kind === "ambiguous_structure") {
      const mappingId = String(payload.mappingId ?? escalation.context.mappingId);
      const mapping = this.mappings.find((item) => item.id === mappingId);
      if (mapping) {
        const dateOrder = String(payload.dateOrder ?? payload.value ?? mapping.structure?.dateOrder ?? "DMY") as
          | "DMY"
          | "MDY"
          | "YMD";
        mapping.structure = {
          valueType: mapping.structure?.valueType ?? "date",
          format: mapping.structure?.format,
          enumValues: mapping.structure?.enumValues,
          nullable: mapping.structure?.nullable,
          dateOrder,
          confidence: 1,
          reason: "Human set the date order",
        };
      }
    } else if (input.action === "reject") {
      const recordId = String(payload.recordId ?? escalation.context.recordId ?? "");
      if (recordId) this.dropped.add(recordId);
    } else {
      const recordId = String(payload.recordId ?? escalation.context.recordId ?? "");
      const field = String(payload.field ?? escalation.context.field ?? "") as keyof Employee;
      const value = String(payload.value ?? "");
      if (recordId && field && value) {
        this.valueOverrides[recordId] = {
          ...(this.valueOverrides[recordId] ?? {}),
          [field]: cleanCorrection(field, value),
        };
      }
    }

    escalation.status = input.action === "approve" ? "approved" : input.action === "correct" ? "corrected" : "rejected";
    escalation.resolution = { action: input.action, payload, at: nowIso() };
    this.log(
      input.action === "reject" ? "warn" : "success",
      `Human ${input.action}d: ${escalation.title}`,
      payload,
    );

    this.applyMappingOverrides();
    this.emit("change");
    if (!continueNow) return;

    if (this.hasOpenMappingEscalations()) {
      this.setPhase("awaiting_mapping");
      this.log("warn", `${this.stats().escalationsOpen} column(s) still need a mapping decision. Rows are waiting.`);
      return;
    }

    this.running = true;
    try {
      if (!this.profiled) {
        await this.rowStage();
        return;
      }
      await this.rebuild();
      if (this.hasOpenEscalations()) {
        this.setPhase("awaiting_human");
        this.log("warn", `${this.stats().escalationsOpen} decision(s) still open.`);
        return;
      }
      await this.pushReady("auto");
    } finally {
      this.running = false;
      this.emit("change");
    }
  }

  async retryFailed() {
    this.running = true;
    try {
      await this.pushReady("retry");
    } finally {
      this.running = false;
      this.emit("change");
    }
  }

  async rollback() {
    const count = rollbackJob(this.id);
    this.records.forEach((record) => {
      if (record.status === "pushed" || record.status === "failed" || record.status === "rolled_back") {
        record.status = "rolled_back";
        record.push = { attempts: record.push?.attempts ?? 0, ok: false, error: "Rolled back from target" };
      }
    });
    this.setPhase("complete");
    this.log("warn", `Rolled back ${count} employee(s) from the mock Darwinbox tenant.`);
    this.emit("change");
  }

  private applyMappingOverrides() {
    for (const mapping of this.mappings) {
      if (!(mapping.id in this.mappingOverrides)) continue;
      const field = this.mappingOverrides[mapping.id];
      mapping.targetField = field;
      mapping.status = field ? "human" : "ignored";
      mapping.reason = field ? `Human mapped this to ${field}` : "Human told me to ignore this column";
    }
  }

  private async rebuild() {
    this.setPhase("cleaning");
    await sleep(PACE);
    const cleaned = cleanTables(this.tables, this.mappings);
    const dateNotes = this.dateLocaleNotes();
    dateNotes.forEach((note) => this.log("success", note));
    this.log("info", "Normalized emails, names, enums, and dates I could parse.");

    this.setPhase("reconciling");
    await sleep(PACE);
    const result = reconcile(cleaned);
    this.records = result.records.map((record) => {
      if (this.dropped.has(record.id)) {
        return { ...record, status: "dropped" as const, blockedBy: [] };
      }
      const override = this.valueOverrides[record.id];
      const data = { ...record.data, ...override };
      const previous = this.records.find((r) => r.id === record.id);
      return {
        ...record,
        data,
        status: previous?.status === "pushed" ? "pushed" : record.status,
        push: previous?.push,
        issues: record.issues,
        blockedBy: [],
      };
    });
    if (result.droppedDuplicates) {
      this.log("success", `Dropped ${result.droppedDuplicates} exact duplicate row(s).`);
    }
    this.log(
      "success",
      `Reconciled ${cleaned.length} source rows into ${this.records.filter((r) => r.status !== "dropped").length} people using email, then employee id.`,
    );

    for (const conflict of result.conflicts) {
      const record = this.records.find((r) => r.id === conflict.identityKey);
      if (!record || record.status === "dropped") continue;
      if (this.valueOverrides[record.id]?.[conflict.field]) continue;
      this.upsertEscalation(`merge:${conflict.identityKey}:${conflict.field}`, {
        kind: "merge_conflict",
        title: `${fieldLabel(conflict.field)} disagrees for ${conflict.name}`,
        why: `Same person in multiple files, different ${fieldLabel(conflict.field)}. I will not pick a source of truth.`,
        suggestion: {
          label: `Use ${conflict.options[0]?.value}`,
          payload: {
            recordId: record.id,
            field: conflict.field,
            value: conflict.options[0]?.value,
          },
        },
        context: {
          recordId: record.id,
          field: conflict.field,
          name: conflict.name,
          email: conflict.email,
          legacyId: conflict.legacyId,
          options: conflict.options,
        },
      });
      record.status = "blocked";
      record.blockedBy.push(`merge:${conflict.field}`);
      this.log("warn", `${conflict.name}: ${conflict.field} conflict (${conflict.options.map((o) => o.value).join(" vs ")}).`);
    }

    this.setPhase("validating");
    await sleep(PACE);
    const openMappingFields = this.openMappingTargetHints();
    const mergeKeys = new Set(result.conflicts.map((c) => `${c.identityKey}:${c.field}`));
    const rowFailures = collectRowIssues(cleaned, this.records).filter((failure) => {
      const record = this.records.find((item) => item.id === failure.recordId);
      if (!record || record.status === "dropped") return false;
      const current = record.data[failure.field as keyof Employee];
      if (current && failure.kind !== "unknown_enum") return false;
      return true;
    });
    const covered = new Set(rowFailures.map((item) => `${item.recordId}:${item.field}`));
    const schemaFailures = validateRecords(this.records).filter((failure) => {
      if (covered.has(`${failure.recordId}:${failure.field}`)) return false;
      if (mergeKeys.has(`${failure.recordId}:${failure.field}`)) return false;
      return true;
    });
    const failures = [...rowFailures, ...schemaFailures].filter((failure) => {
      if (this.valueOverrides[failure.recordId]?.[failure.field as keyof Employee]) return false;
      if (openMappingFields.has(failure.field)) return false;
      return true;
    });

    const seen = new Set<string>();
    for (const failure of failures) {
      const fieldKey = `${failure.recordId}:${failure.field}`;
      if (seen.has(fieldKey)) continue;
      seen.add(fieldKey);
      const fp = `val:${failure.recordId}:${failure.field}`;
      const record = this.records.find((r) => r.id === failure.recordId);
      if (!record || record.status === "dropped") continue;
      if (this.trySecondAttempt(failure, record)) continue;
      const kind =
        failure.kind === "unknown_enum"
          ? "unknown_enum"
          : failure.kind === "ambiguous_date" || failure.kind === "unparseable_date"
            ? "ambiguous_date"
            : "validation_failure";
      this.upsertEscalation(fp, {
        kind,
        title: `${failure.name}: ${fieldLabel(failure.field)}`,
        why: failure.message,
        suggestion: {
          label: failure.options?.[0] ? `Use ${failure.options[0]}` : "Enter a value",
          payload: {
            recordId: record.id,
            field: failure.field,
            value: failure.options?.[0] ?? "",
          },
        },
        context: {
          recordId: record.id,
          field: failure.field,
          name: failure.name,
          original: failure.original,
          options: failure.options,
          sources: record.sourceRows,
        },
      });
      record.status = "blocked";
      record.blockedBy.push(fp);
    }

    this.records.forEach((record) => {
      if (record.status === "dropped" || record.status === "pushed" || record.status === "failed") return;
      if (record.blockedBy.length) {
        record.status = "blocked";
      } else {
        record.status = "ready";
      }
    });

    const ready = this.stats().ready;
    const blocked = this.stats().blocked;
    this.log(
      blocked ? "warn" : "success",
      `${ready} record(s) are clean. ${blocked} need a decision before they can move.`,
    );
    this.emit("change");
  }

  /**
   * Cleanup already failed on this value once. Try a different strategy before
   * spending a human's attention on it; escalate only if this fails too.
   */
  private trySecondAttempt(failure: ValidationFailure, record: CanonicalRecord): boolean {
    const key = `${record.id}:${failure.field}`;
    if (this.repairTried.has(key)) return false;
    this.repairTried.add(key);

    const repair = repairFailure(failure, record);
    if (!repair) {
      record.issues.push(`${fieldLabel(failure.field)}: second attempt failed, so I asked you.`);
      this.log("warn", `${failure.name}: ${fieldLabel(failure.field)} failed twice. Escalating.`);
      return false;
    }

    this.valueOverrides[record.id] = {
      ...(this.valueOverrides[record.id] ?? {}),
      [repair.field]: repair.value,
    };
    (record.data as Record<string, string>)[repair.field] = repair.value;
    record.issues.push(repair.how);
    this.log("success", `${failure.name}: ${repair.how}.`);
    return true;
  }

  private openMappingTargetHints(): Set<string> {
    const fields = new Set<string>();
    for (const mapping of this.mappings) {
      if (mapping.status !== "escalated") continue;
      mapping.candidates.slice(0, 2).forEach((c) => {
        if (c.field === "fullName") {
          fields.add("firstName");
          fields.add("lastName");
        } else {
          fields.add(c.field);
        }
      });
    }
    return fields;
  }

  private dateLocaleNotes(): string[] {
    const notes: string[] = [];
    for (const table of this.tables) {
      const mapping = this.mappings.find(
        (m) =>
          m.sourceFile === table.fileName &&
          (m.targetField === "hireDate" || m.targetField === "dateOfBirth") &&
          m.status !== "ignored",
      );
      if (!mapping) continue;
      const aiOrder = mapping.structure?.dateOrder;
      if (aiOrder === "DMY") notes.push(`${table.fileName}: OpenRouter typed hire dates as day-first (${mapping.structure?.format ?? "DMY"}).`);
      else if (aiOrder === "MDY") notes.push(`${table.fileName}: OpenRouter typed hire dates as month-first (${mapping.structure?.format ?? "MDY"}).`);
      else if (aiOrder === "YMD") notes.push(`${table.fileName}: OpenRouter typed hire dates as ISO-like (YMD).`);
      else {
        const order = inferDateOrder(table.rows.map((row) => row[mapping.sourceColumn] ?? ""));
        if (order === "DMY") notes.push(`${table.fileName}: inferred day-first dates from unambiguous values (e.g. 23/07/2018).`);
        if (order === "MDY") notes.push(`${table.fileName}: inferred month-first dates from unambiguous values (e.g. 07/23/2018).`);
      }
    }
    return notes;
  }

  private upsertEscalation(
    fingerprint: string,
    body: Omit<Escalation, "id" | "status" | "createdAt">,
  ) {
    const existing = this.escalations.find((item) => item.id === fingerprint);
    if (existing) {
      if (existing.status === "open") return;
      const recordId = String(body.context.recordId ?? "");
      const field = String(body.context.field ?? "") as keyof Employee;
      if (existing.kind === "ambiguous_mapping" || existing.kind === "ambiguous_structure") return;
      if (recordId && this.dropped.has(recordId)) return;
      if (recordId && field && this.valueOverrides[recordId]?.[field]) return;
      existing.status = "open";
      existing.resolution = undefined;
      existing.why = body.why;
      existing.suggestion = body.suggestion;
      existing.context = body.context;
      return;
    }
    this.escalations.push({
      id: fingerprint,
      status: "open",
      createdAt: nowIso(),
      ...body,
    });
  }

  private hasOpenMappingEscalations() {
    return this.escalations.some(
      (item) =>
        item.status === "open" && (item.kind === "ambiguous_mapping" || item.kind === "ambiguous_structure"),
    );
  }

  private hasOpenEscalations() {
    return this.escalations.some((e) => e.status === "open");
  }

  async pushReady(reason: "auto" | "retry" | "manual") {
    const targets = this.records.filter((record) =>
      reason === "retry" ? record.status === "failed" : record.status === "ready" || record.status === "failed",
    );
    if (!targets.length) {
      this.setPhase("complete");
      this.log("info", "Nothing ready to push.");
      return;
    }
    this.setPhase("pushing");
    this.log("info", `${reason === "retry" ? "Retrying" : "Pushing"} ${targets.length} employee(s) to ${this.targetSystem}.`);
    for (const record of targets) {
      await sleep(40);
      const data = record.data as Employee;
      const result = pushEmployee(this.id, data);
      record.push = {
        attempts: (record.push?.attempts ?? 0) + 1,
        ok: result.ok,
        targetId: result.ok ? result.targetId : undefined,
        error: result.ok ? undefined : result.error,
        at: nowIso(),
      };
      record.status = result.ok ? "pushed" : "failed";
      this.log(
        result.ok ? "success" : "error",
        result.ok
          ? `Upserted ${collapseSpace(`${data.firstName} ${data.lastName}`)} → ${result.targetId}`
          : `Failed ${data.email}: ${result.error}`,
      );
    }
    const failed = this.records.filter((r) => r.status === "failed").length;
    this.setPhase("complete");
    this.log(
      failed ? "warn" : "success",
      failed
        ? `Push finished with ${failed} failure(s). Retry is available; rollback will delete this job’s rows from the mock tenant.`
        : `All ready records are in ${this.targetSystem}. ${listTargetEmployees(this.id).length} row(s) live.`,
    );
  }
}

const g = globalThis as unknown as { __jobs?: Map<string, MigrationJob> };

export function jobStore(): Map<string, MigrationJob> {
  if (!g.__jobs) g.__jobs = new Map();
  return g.__jobs;
}

export function saveJob(job: MigrationJob) {
  jobStore().set(job.id, job);
}

export function getJob(id: string): MigrationJob | undefined {
  return jobStore().get(id);
}
