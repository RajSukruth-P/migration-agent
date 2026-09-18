import { POLICY } from "./policy";

export type DateOrder = "DMY" | "MDY" | "YMD" | "unknown";

const MONTHS: Record<string, number> = {
  jan: 1,
  january: 1,
  feb: 2,
  february: 2,
  mar: 3,
  march: 3,
  apr: 4,
  april: 4,
  may: 5,
  jun: 6,
  june: 6,
  jul: 7,
  july: 7,
  aug: 8,
  august: 8,
  sep: 9,
  sept: 9,
  september: 9,
  oct: 10,
  october: 10,
  nov: 11,
  november: 11,
  dec: 12,
  december: 12,
};

export interface DateParse {
  iso?: string;
  ambiguous?: [string, string];
  unparseable?: boolean;
  usedOrder?: DateOrder;
}

function pad(n: number): string {
  return String(n).padStart(2, "0");
}

function iso(year: number, month: number, day: number): string | undefined {
  if (year < 1950 || year > 2100) return undefined;
  const date = new Date(Date.UTC(year, month - 1, day));
  if (
    date.getUTCFullYear() !== year ||
    date.getUTCMonth() !== month - 1 ||
    date.getUTCDate() !== day
  ) {
    return undefined;
  }
  return `${year}-${pad(month)}-${pad(day)}`;
}

function yearOf(raw: string): number {
  if (raw.length === 2) {
    const n = Number(raw);
    return n >= 70 ? 1900 + n : 2000 + n;
  }
  return Number(raw);
}

function fromParts(a: number, b: number, year: number, order: "DMY" | "MDY"): string | undefined {
  if (order === "DMY") return iso(year, b, a);
  return iso(year, a, b);
}

function slashParts(value: string): string[] | null {
  const match = value.trim().match(/^(\d{1,4})[/-](\d{1,2})[/-](\d{1,4})$/);
  if (!match) return null;
  return [match[1], match[2], match[3]];
}

export function parseDate(raw: string, prefer: DateOrder = "unknown"): DateParse {
  const value = raw.trim();
  if (!value) return { unparseable: true };

  if (/^\d{4,6}(\.\d+)?$/.test(value)) {
    const serial = Number(value);
    if (serial >= 20000 && serial <= 60000) {
      const utc = Date.UTC(1899, 11, 30) + Math.round(serial) * 86400000;
      const date = new Date(utc);
      const parsed = iso(date.getUTCFullYear(), date.getUTCMonth() + 1, date.getUTCDate());
      return parsed ? { iso: parsed, usedOrder: "YMD" } : { unparseable: true };
    }
  }

  const isoMatch = value.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (isoMatch) {
    const parsed = iso(Number(isoMatch[1]), Number(isoMatch[2]), Number(isoMatch[3]));
    return parsed ? { iso: parsed, usedOrder: "YMD" } : { unparseable: true };
  }

  const ymdSlash = value.match(/^(\d{4})[/-](\d{1,2})[/-](\d{1,2})$/);
  if (ymdSlash) {
    const parsed = iso(Number(ymdSlash[1]), Number(ymdSlash[2]), Number(ymdSlash[3]));
    return parsed ? { iso: parsed, usedOrder: "YMD" } : { unparseable: true };
  }

  const named = value.match(
    /^(\d{1,2})[ .-]([A-Za-z]{3,9})[ .,-](\d{2,4})$|^([A-Za-z]{3,9})\s+(\d{1,2}),?\s+(\d{2,4})$|^(\d{1,2})\s+([A-Za-z]{3,9})\s+(\d{2,4})$/,
  );
  if (named) {
    const day = Number(named[1] || named[5] || named[7]);
    const monthName = (named[2] || named[4] || named[8] || "").toLowerCase();
    const year = yearOf(named[3] || named[6] || named[9] || "");
    const month = MONTHS[monthName];
    if (month) {
      const parsed = iso(year, month, day);
      return parsed ? { iso: parsed, usedOrder: "DMY" } : { unparseable: true };
    }
  }

  const dotted = value.match(/^(\d{1,2})\.(\d{1,2})\.(\d{2,4})$/);
  if (dotted) {
    const a = Number(dotted[1]);
    const b = Number(dotted[2]);
    const year = yearOf(dotted[3] ?? "");
    return resolveNumeric(a, b, year, prefer);
  }

  const parts = slashParts(value);
  if (parts) {
    const [p1, p2, p3] = parts;
    if ((p1 ?? "").length === 4) {
      const parsed = iso(Number(p1), Number(p2), Number(p3));
      return parsed ? { iso: parsed, usedOrder: "YMD" } : { unparseable: true };
    }
    return resolveNumeric(Number(p1), Number(p2), yearOf(p3 ?? ""), prefer);
  }

  return { unparseable: true };
}

function resolveNumeric(a: number, b: number, year: number, prefer: DateOrder): DateParse {
  const dmy = fromParts(a, b, year, "DMY");
  const mdy = fromParts(a, b, year, "MDY");
  if (dmy && !mdy) return { iso: dmy, usedOrder: "DMY" };
  if (mdy && !dmy) return { iso: mdy, usedOrder: "MDY" };
  if (dmy && mdy) {
    if (dmy === mdy) return { iso: dmy, usedOrder: prefer === "MDY" ? "MDY" : "DMY" };
    if (prefer === "DMY") return { iso: dmy, usedOrder: "DMY" };
    if (prefer === "MDY") return { iso: mdy, usedOrder: "MDY" };
    return { ambiguous: [dmy, mdy] };
  }
  return { unparseable: true };
}

export function inferDateOrder(values: string[]): DateOrder {
  let dmy = 0;
  let mdy = 0;
  for (const value of values) {
    if (!value.trim()) continue;
    const parsed = parseDate(value, "unknown");
    if (parsed.usedOrder === "DMY") dmy += 1;
    if (parsed.usedOrder === "MDY") mdy += 1;
  }
  if (dmy >= POLICY.dateOrderMinSignals && mdy === 0) return "DMY";
  if (mdy >= POLICY.dateOrderMinSignals && dmy === 0) return "MDY";
  return "unknown";
}

export function isoToDmy(iso?: string): string {
  if (!iso) return "";
  const match = iso.trim().match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) return iso;
  return `${match[3]}/${match[2]}/${match[1]}`;
}
