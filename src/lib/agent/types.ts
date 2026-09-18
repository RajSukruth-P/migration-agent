export type JobPhase =
  | "idle"
  | "ingesting"
  | "mapping"
  | "awaiting_mapping"
  | "profiling"
  | "cleaning"
  | "reconciling"
  | "validating"
  | "awaiting_human"
  | "pushing"
  | "complete"
  | "failed";
export type EscalationKind =
  | "ambiguous_mapping"
  | "ambiguous_structure"
  | "ambiguous_date"
  | "merge_conflict"
  | "validation_failure"
  | "unknown_enum";
export interface ColumnStructure {
  valueType: "string" | "email" | "date" | "enum" | "boolean" | "id" | "name" | "unknown";
  format?: string;
  dateOrder?: "DMY" | "MDY" | "YMD";
  enumValues?: string[];
  nullable?: boolean;
  confidence: number;
  reason: string;
}

export type EscalationStatus = "open" | "approved" | "corrected" | "rejected";

export interface Employee {
  firstName: string;
  lastName: string;
  email: string;
  address?: string;
  jobTitle?: string;
  department?: string;
  workLocation?: string;
  hireDate?: string;
  phoneNumber?: string;
  dateOfBirth?: string;
  legacyId?: string;
}

export const TARGET_FIELDS = [
  "firstName",
  "lastName",
  "email",
  "address",
  "jobTitle",
  "department",
  "workLocation",
  "hireDate",
  "phoneNumber",
  "dateOfBirth",
  "legacyId",
] as const;

export type TargetField = (typeof TARGET_FIELDS)[number] | "fullName";

export const REQUIRED_FIELDS: Array<keyof Employee> = ["firstName", "lastName", "email"];

export interface SourceTable {
  fileName: string;
  columns: string[];
  rows: Array<Record<string, string>>;
}

export interface MappingCandidate {
  field: TargetField;
  score: number;
  reason: string;
}

export interface FieldMapping {
  id: string;
  sourceFile: string;
  sourceColumn: string;
  targetField: TargetField | null;
  confidence: number;
  candidates: MappingCandidate[];
  status: "auto" | "escalated" | "human" | "ignored";
  reason: string;
  sampleSize?: number;
  structure?: ColumnStructure;
}

export interface SourceRef {
  file: string;
  rowNumber: number;
  values: Record<string, string>;
}

export interface CanonicalRecord {
  id: string;
  identityKey: string;
  sourceRows: SourceRef[];
  data: Partial<Employee>;
  issues: string[];
  blockedBy: string[];
  status: "ready" | "blocked" | "dropped" | "pushed" | "failed" | "rolled_back";
  push?: {
    attempts: number;
    ok: boolean;
    targetId?: string;
    error?: string;
    at?: string;
  };
}

export interface Escalation {
  id: string;
  kind: EscalationKind;
  status: EscalationStatus;
  title: string;
  why: string;
  suggestion: {
    label: string;
    payload: Record<string, unknown>;
  };
  context: Record<string, unknown>;
  createdAt: string;
  resolution?: {
    action: "approve" | "correct" | "reject";
    payload?: Record<string, unknown>;
    at: string;
  };
}

export interface AgentEvent {
  id: string;
  at: string;
  level: "info" | "success" | "warn" | "error";
  phase: JobPhase;
  message: string;
  detail?: Record<string, unknown>;
}

export interface JobStats {
  files: number;
  sourceRows: number;
  uniquePeople: number;
  autoMapped: number;
  ignoredColumns: number;
  escalationsOpen: number;
  escalationsResolved: number;
  ready: number;
  blocked: number;
  dropped: number;
  pushed: number;
  failed: number;
  rolledBack: number;
}

export interface JobSnapshot {
  id: string;
  clientName: string;
  targetSystem: string;
  phase: JobPhase;
  createdAt: string;
  files: Array<{ name: string; rows: number; columns: string[] }>;
  mappings: FieldMapping[];
  escalations: Escalation[];
  records: CanonicalRecord[];
  events: AgentEvent[];
  stats: JobStats;
  policy: string;
}

export interface ResolveInput {
  escalationId: string;
  action: "approve" | "correct" | "reject";
  payload?: Record<string, unknown>;
}
