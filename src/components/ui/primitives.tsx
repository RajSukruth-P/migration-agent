import type { ButtonHTMLAttributes, ReactNode } from "react";

export type Tone = "neutral" | "teal" | "accent" | "amber" | "danger";

const TONE_CHIP: Record<Tone, string> = {
  neutral: "bg-surface-sunk text-muted",
  teal: "bg-teal-soft text-teal",
  accent: "bg-accent-soft text-accent",
  amber: "bg-amber-soft text-amber",
  danger: "bg-danger-soft text-danger",
};

const TONE_TEXT: Record<Tone, string> = {
  neutral: "text-muted",
  teal: "text-teal",
  accent: "text-accent",
  amber: "text-amber",
  danger: "text-danger",
};

export function toneText(tone: Tone): string {
  return TONE_TEXT[tone];
}

export function Card({
  children,
  className = "",
  padded = true,
}: {
  children: ReactNode;
  className?: string;
  padded?: boolean;
}) {
  return (
    <section
      className={`rounded-xl border border-stroke bg-surface shadow-[0_1px_2px_rgba(27,36,48,0.04)] ${
        padded ? "p-5" : ""
      } ${className}`}
    >
      {children}
    </section>
  );
}

export function CardHeader({
  title,
  hint,
  action,
}: {
  title: ReactNode;
  hint?: ReactNode;
  action?: ReactNode;
}) {
  return (
    <div className="mb-4 flex items-start justify-between gap-4">
      <div className="min-w-0">
        <h2 className="text-sm font-semibold text-navy">{title}</h2>
        {hint ? <p className="mt-0.5 text-xs leading-5 text-muted">{hint}</p> : null}
      </div>
      {action ? <div className="shrink-0">{action}</div> : null}
    </div>
  );
}

export function Badge({
  children,
  tone = "neutral",
  className = "",
}: {
  children: ReactNode;
  tone?: Tone;
  className?: string;
}) {
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium ${TONE_CHIP[tone]} ${className}`}
    >
      {children}
    </span>
  );
}

export function Dot({ tone = "neutral", live = false }: { tone?: Tone; live?: boolean }) {
  const fill: Record<Tone, string> = {
    neutral: "bg-subtle",
    teal: "bg-teal",
    accent: "bg-accent",
    amber: "bg-amber",
    danger: "bg-danger",
  };
  return <span className={`inline-block h-1.5 w-1.5 rounded-full ${fill[tone]} ${live ? "live-dot" : ""}`} />;
}

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "secondary" | "ghost" | "danger";
  size?: "sm" | "md";
};

export function Button({ variant = "secondary", size = "md", className = "", ...props }: ButtonProps) {
  const base =
    "inline-flex items-center justify-center gap-1.5 rounded-lg font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-45";
  const sizes = { sm: "px-2.5 py-1.5 text-xs", md: "px-3.5 py-2 text-sm" };
  const variants = {
    primary: "bg-navy text-white hover:bg-[#2b3846]",
    secondary: "border border-stroke bg-surface text-navy hover:border-stroke-strong hover:bg-surface-muted",
    ghost: "text-muted hover:bg-surface-sunk hover:text-navy",
    danger: "border border-[#f0cfcb] bg-danger-soft text-danger hover:border-danger",
  };
  return <button className={`${base} ${sizes[size]} ${variants[variant]} ${className}`} {...props} />;
}

export function Stat({
  label,
  value,
  hint,
  tone = "neutral",
}: {
  label: string;
  value: ReactNode;
  hint?: string;
  tone?: Tone;
}) {
  return (
    <div className="rounded-xl border border-stroke bg-surface px-4 py-3">
      <p className="text-[11px] uppercase tracking-wide text-subtle">{label}</p>
      <p className={`mt-1 text-2xl font-semibold tabular-nums ${tone === "neutral" ? "text-navy" : TONE_TEXT[tone]}`}>
        {value}
      </p>
      {hint ? <p className="mt-0.5 text-xs text-muted">{hint}</p> : null}
    </div>
  );
}

export function Meter({ value, tone = "teal" }: { value: number; tone?: Tone }) {
  const fill: Record<Tone, string> = {
    neutral: "bg-subtle",
    teal: "bg-teal",
    accent: "bg-accent",
    amber: "bg-amber",
    danger: "bg-danger",
  };
  return (
    <span className="inline-block h-1.5 w-14 overflow-hidden rounded-full bg-surface-sunk align-middle">
      <span
        className={`block h-full rounded-full ${fill[tone]}`}
        style={{ width: `${Math.round(Math.max(0, Math.min(1, value)) * 100)}%` }}
      />
    </span>
  );
}

export function EmptyState({
  title,
  body,
  action,
}: {
  title: string;
  body: string;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center gap-2 px-6 py-14 text-center">
      <p className="text-sm font-medium text-navy">{title}</p>
      <p className="max-w-md text-sm leading-6 text-muted">{body}</p>
      {action ? <div className="mt-2">{action}</div> : null}
    </div>
  );
}

export function PageHeader({
  title,
  description,
  action,
}: {
  title: string;
  description: string;
  action?: ReactNode;
}) {
  return (
    <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
      <div>
        <h1 className="text-lg font-semibold text-navy">{title}</h1>
        <p className="mt-0.5 max-w-2xl text-sm leading-6 text-muted">{description}</p>
      </div>
      {action}
    </div>
  );
}

export function FilterChips<T extends string>({
  options,
  value,
  onChange,
}: {
  options: Array<{ value: T; label: string; count?: number }>;
  value: T;
  onChange: (next: T) => void;
}) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {options.map((option) => {
        const active = option.value === value;
        return (
          <button
            key={option.value}
            onClick={() => onChange(option.value)}
            className={`rounded-full border px-3 py-1 text-xs transition-colors ${
              active
                ? "border-navy bg-navy text-white"
                : "border-stroke bg-surface text-muted hover:border-stroke-strong hover:text-navy"
            }`}
          >
            {option.label}
            {option.count !== undefined ? (
              <span className={active ? "ml-1.5 text-white/70" : "ml-1.5 text-subtle"}>{option.count}</span>
            ) : null}
          </button>
        );
      })}
    </div>
  );
}
