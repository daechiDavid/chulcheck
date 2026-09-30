import type { ButtonHTMLAttributes, ReactNode } from "react";
import type { Status } from "@contract/enums.ts";
import { STATUS_LABELS } from "@contract/api.ts";

export function Button({
  children,
  variant = "primary",
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: "primary" | "ghost" | "line" }) {
  const styles = {
    primary: "bg-ink text-paper hover:bg-pine",
    ghost: "bg-transparent text-ink hover:bg-black/5",
    line: "border border-line bg-card text-ink hover:border-ink",
  }[variant];
  return (
    <button
      {...props}
      className={`inline-flex min-h-12 items-center justify-center rounded-full px-5 text-[15px] font-medium transition disabled:cursor-not-allowed disabled:opacity-40 ${styles} ${props.className ?? ""}`}
    >
      {children}
    </button>
  );
}

export function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: ReactNode;
}) {
  return (
    <label className="block">
      <span className="mb-2 block text-sm font-medium">{label}</span>
      {children}
      {hint ? <span className="mt-1 block text-sm text-muted">{hint}</span> : null}
    </label>
  );
}

export const controlClass =
  "min-h-12 w-full rounded-2xl border border-line bg-white px-4 text-base outline-none placeholder:text-muted/70";

export function Banner({ children, tone = "warn" }: { children: ReactNode; tone?: "warn" | "error" | "ok" }) {
  const styles = {
    warn: "border-[#e7c9a0] bg-[#fff6ea] text-[#6a4a1d]",
    error: "border-[#efc3bb] bg-[#fff1ee] text-seal",
    ok: "border-[#c9ddd3] bg-[#f3faf6] text-pine",
  }[tone];
  return <div className={`rounded-2xl border px-4 py-3 text-sm leading-6 ${styles}`}>{children}</div>;
}

export function StatusBadge({ status, printed }: { status: Status; printed?: boolean }) {
  return (
    <span className="inline-flex flex-wrap gap-1">
      <span className="rounded-full bg-paper px-2.5 py-1 text-xs font-medium">{STATUS_LABELS[status]}</span>
      {printed ? <span className="rounded-full bg-seal/10 px-2.5 py-1 text-xs font-medium text-seal">출력됨</span> : null}
    </span>
  );
}
