import type { CanonicalRecord } from "@/lib/agent/types";
import type { Tone } from "@/components/ui/primitives";

export function recordStatus(record: CanonicalRecord): { label: string; tone: Tone } {
  switch (record.status) {
    case "pushed":
      return { label: record.push?.targetId ?? "In Darwinbox", tone: "teal" };
    case "failed":
      return { label: "Push failed", tone: "danger" };
    case "blocked":
      return { label: "Needs you", tone: "accent" };
    case "rolled_back":
      return { label: "Rolled back", tone: "amber" };
    case "dropped":
      return { label: "Skipped", tone: "neutral" };
    default:
      return { label: "Ready to push", tone: "neutral" };
  }
}
