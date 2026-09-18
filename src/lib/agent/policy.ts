/**
 * Escalation policy.
 *
 * OpenRouter proposes mappings. The consultant is only asked when two
 * target fields are actually competing, or a required value would have
 * to be invented. Leftover source columns are ignored, not queued.
 */
export const POLICY = {
  /** Apply a mapping when the model is at least this sure. */
  autoMapMinConfidence: 0.8,
  /** Even below that, apply if the winner beats the runner-up by this much. */
  autoMapMinGap: 0.12,
  autoStructureMinConfidence: 0.8,
  sampleMin: 20,
  sampleMax: 50,
  similarValueAutoMerge: 0.82,
  dateOrderMinSignals: 3,
  optionalConflictMode: "keep_first_and_log" as const,
};

export const POLICY_SUMMARY = `OpenRouter maps columns from names plus 20-50 sample rows. I apply a mapping when confidence is ≥ 80%, or when one field clearly wins. I ignore leftover columns (notes, bank account, worker type, status) myself.

I only ask you when two Darwinbox fields are close, a date order cannot be inferred, files disagree on a required value, or I would have to invent a name or email.`;

export const DEPARTMENT_SYNONYMS: Record<string, string> = {
  "people operations": "People Ops",
  "people ops": "People Ops",
  "peopleop": "People Ops",
  hr: "People Ops",
  "human resources": "People Ops",
  gtm: "Go-To-Market",
  "go to market": "Go-To-Market",
  "go-to-market": "Go-To-Market",
  eng: "Engineering",
  engineering: "Engineering",
  finance: "Finance",
  sales: "Sales",
  product: "Product",
  legal: "Legal",
  marketing: "Marketing",
  design: "Design",
  platform: "Platform",
};
