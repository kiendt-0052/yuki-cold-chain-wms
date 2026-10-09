// Small presentational building blocks shared by every screen.
import type { ButtonHTMLAttributes, ReactNode } from "react";

export function PageHeader({ title, subtitle, actions }: { title: string; subtitle?: string; actions?: ReactNode }) {
  return (
    <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
      <div>
        <h1 className="text-xl font-bold text-brand-dark">{title}</h1>
        {subtitle && <p className="mt-1 text-sm text-slate-600">{subtitle}</p>}
      </div>
      {actions && <div className="flex gap-2">{actions}</div>}
    </div>
  );
}

export function Card({ title, children, className = "", actions }: {
  title?: string; children: ReactNode; className?: string; actions?: ReactNode;
}) {
  return (
    <section className={`rounded-lg border border-slate-200 bg-white p-4 shadow-sm ${className}`}>
      {(title || actions) && (
        <div className="mb-3 flex items-center justify-between gap-2">
          {title && <h2 className="font-semibold text-slate-800">{title}</h2>}
          {actions}
        </div>
      )}
      {children}
    </section>
  );
}

const TONES = {
  gray: "bg-slate-100 text-slate-700",
  green: "bg-emerald-100 text-emerald-800",
  red: "bg-red-100 text-red-800",
  amber: "bg-amber-100 text-amber-800",
  blue: "bg-sky-100 text-sky-800",
  teal: "bg-brand-soft text-brand-dark",
} as const;
export type Tone = keyof typeof TONES;

export function Badge({ tone = "gray", children }: { tone?: Tone; children: ReactNode }) {
  return <span className={`inline-block whitespace-nowrap rounded px-2 py-0.5 text-xs font-medium ${TONES[tone]}`}>{children}</span>;
}

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & { variant?: "primary" | "secondary" | "danger" };
export function Button({ variant = "primary", className = "", ...props }: ButtonProps) {
  const styles = {
    primary: "bg-brand text-white hover:bg-brand-dark",
    secondary: "border border-slate-300 bg-white text-slate-700 hover:bg-slate-50",
    danger: "bg-red-600 text-white hover:bg-red-700",
  }[variant];
  return (
    <button
      className={`rounded-md px-3 py-2 text-sm font-medium transition disabled:cursor-not-allowed disabled:opacity-50 ${styles} ${className}`}
      {...props}
    />
  );
}

export function Field({ label, required, error, children, hint }: {
  label: string; required?: boolean; error?: string; children: ReactNode; hint?: string;
}) {
  return (
    <label className="block text-sm">
      <span className="mb-1 block font-medium text-slate-700">
        {label}{required && <span className="ml-1 text-red-600">*</span>}
      </span>
      {children}
      {hint && !error && <span className="mt-1 block text-xs text-slate-500">{hint}</span>}
      {error && <span className="mt-1 block text-xs text-red-600">{error}</span>}
    </label>
  );
}

export const inputClass =
  "w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/30";

export function Alert({ tone = "red", title, children }: { tone?: "red" | "amber" | "green" | "blue"; title?: string; children: ReactNode }) {
  const styles = {
    red: "border-red-300 bg-red-50 text-red-900",
    amber: "border-amber-300 bg-amber-50 text-amber-900",
    green: "border-emerald-300 bg-emerald-50 text-emerald-900",
    blue: "border-sky-300 bg-sky-50 text-sky-900",
  }[tone];
  return (
    <div role="alert" className={`rounded-md border px-4 py-3 text-sm ${styles}`}>
      {title && <p className="mb-1 font-semibold">{title}</p>}
      {children}
    </div>
  );
}

export function Loading() {
  return <p className="py-8 text-center text-sm text-slate-500">読み込み中…</p>;
}

export function Table({ head, children, empty }: { head: ReactNode[]; children: ReactNode; empty?: boolean }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-slate-200 bg-slate-50 text-left text-xs text-slate-600">
            {head.map((h, i) => <th key={i} className="whitespace-nowrap px-3 py-2 font-semibold">{h}</th>)}
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">{children}</tbody>
      </table>
      {empty && <p className="py-6 text-center text-sm text-slate-500">データがありません</p>}
    </div>
  );
}

export const td = "px-3 py-2 align-top";
