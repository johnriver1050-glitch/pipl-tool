import { type ReactNode } from "react";

type Variant =
  | "default"
  | "blue"
  | "green"
  | "amber"
  | "red"
  | "purple"
  | "orange"
  | "slate"
  | "teal";

const VARIANTS: Record<Variant, string> = {
  default: "bg-slate-100 text-slate-700 border-slate-200",
  blue: "bg-blue-50 text-blue-700 border-blue-200",
  green: "bg-emerald-50 text-emerald-700 border-emerald-200",
  amber: "bg-amber-50 text-amber-700 border-amber-200",
  red: "bg-red-50 text-red-700 border-red-200",
  purple: "bg-purple-50 text-purple-700 border-purple-200",
  orange: "bg-orange-50 text-orange-700 border-orange-200",
  slate: "bg-slate-100 text-slate-600 border-slate-200",
  teal: "bg-teal-50 text-teal-700 border-teal-200",
};

export function Badge({
  variant = "default",
  children,
  className = "",
}: {
  variant?: Variant;
  children: ReactNode;
  className?: string;
}) {
  return (
    <span
      className={`inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full border ${VARIANTS[variant]} ${className}`}
    >
      {children}
    </span>
  );
}
