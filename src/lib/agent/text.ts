export function normalizeKey(value: string): string {
  return value
    .toLowerCase()
    .replace(/[_./\\-]+/g, " ")
    .replace(/[^a-z0-9 ]+/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

export function collapseSpace(value: string): string {
  return value.replace(/\s+/g, " ").trim();
}

export function titleCase(value: string): string {
  const trimmed = collapseSpace(value);
  if (!trimmed) return "";
  if (trimmed.includes("@")) return trimmed.toLowerCase();
  const words = trimmed.split(" ");
  const mostlyUpper =
    trimmed === trimmed.toUpperCase() && /[A-Z]/.test(trimmed);
  const mostlyLower =
    trimmed === trimmed.toLowerCase() && /[a-z]/.test(trimmed);
  if (!mostlyUpper && !mostlyLower) return trimmed;
  return words
    .map((word) => {
      if (word.length <= 4 && word === word.toUpperCase()) return word;
      return word.charAt(0).toUpperCase() + word.slice(1).toLowerCase();
    })
    .join(" ");
}

export function tokens(value: string): string[] {
  return normalizeKey(value).split(" ").filter(Boolean);
}

export function levenshtein(a: string, b: string): number {
  if (a === b) return 0;
  if (!a.length) return b.length;
  if (!b.length) return a.length;
  const row = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i += 1) {
    let prev = i - 1;
    row[0] = i;
    for (let j = 1; j <= b.length; j += 1) {
      const next = row[j] ?? 0;
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      row[j] = Math.min((row[j] ?? 0) + 1, (row[j - 1] ?? 0) + 1, prev + cost);
      prev = next;
    }
  }
  return row[b.length] ?? 0;
}

export function similarity(a: string, b: string): number {
  const left = normalizeKey(a);
  const right = normalizeKey(b);
  if (!left || !right) return 0;
  if (left === right) return 1;
  const max = Math.max(left.length, right.length);
  return 1 - levenshtein(left, right) / max;
}

export function tokenOverlap(a: string, b: string): number {
  const left = new Set(tokens(a));
  const right = new Set(tokens(b));
  if (!left.size || !right.size) return 0;
  let hit = 0;
  left.forEach((token) => {
    if (right.has(token)) hit += 1;
  });
  return hit / Math.max(left.size, right.size);
}

export function looksLikeEmail(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim());
}

export function normalizePhone(value: string): string | undefined {
  const trimmed = collapseSpace(value);
  if (!trimmed) return undefined;
  const hasPlus = trimmed.startsWith("+");
  const digits = trimmed.replace(/\D/g, "");
  if (digits.length < 8 || digits.length > 15) return undefined;
  return hasPlus ? `+${digits}` : digits;
}

export function splitName(fullName: string): { firstName: string; lastName: string } {
  const cleaned = titleCase(fullName);
  if (!cleaned) return { firstName: "", lastName: "" };
  if (cleaned.includes(",")) {
    const [last, ...rest] = cleaned.split(",").map((part) => part.trim());
    return { firstName: rest.join(" "), lastName: last ?? "" };
  }
  const parts = cleaned.split(" ").filter(Boolean);
  if (parts.length === 1) return { firstName: parts[0] ?? "", lastName: "" };
  return {
    firstName: parts[0] ?? "",
    lastName: parts.slice(1).join(" "),
  };
}

export function pickRicher(a: string, b: string): string {
  if (!a) return b;
  if (!b) return a;
  if (normalizeKey(b).includes(normalizeKey(a)) && b.length > a.length) return b;
  if (normalizeKey(a).includes(normalizeKey(b)) && a.length > b.length) return a;
  return a.length >= b.length ? a : b;
}

export function unique<T>(items: T[]): T[] {
  return Array.from(new Set(items));
}

export function nowIso(): string {
  return new Date().toISOString();
}

export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export function id(prefix: string): string {
  return `${prefix}_${crypto.randomUUID().slice(0, 8)}`;
}
