import type { ReactElement } from "react";
import { cn } from "@/lib/utils";

const STYLES: Record<string, { pill: string; dot: string }> = {
  active: { pill: "bg-emerald-50 text-emerald-800 ring-emerald-200", dot: "bg-emerald-500" },
  scheduled: { pill: "bg-emerald-50 text-emerald-800 ring-emerald-200", dot: "bg-emerald-500" },
  escalated: { pill: "bg-amber-50 text-amber-900 ring-amber-200", dot: "bg-amber-500" },
  paused: { pill: "bg-sky-50 text-sky-900 ring-sky-200", dot: "bg-sky-500" },
  resolved: { pill: "bg-slate-100 text-slate-700 ring-slate-200", dot: "bg-slate-400" },
  completed: { pill: "bg-slate-100 text-slate-700 ring-slate-200", dot: "bg-slate-400" },
  cancelled: { pill: "bg-rose-50 text-rose-800 ring-rose-200", dot: "bg-rose-500" },
};

export const StatusBadge = ({ status, label }: { status: string; label: string }): ReactElement => {
  const style = STYLES[status] ?? { pill: "bg-slate-100 text-slate-700 ring-slate-200", dot: "bg-slate-400" };
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-2.5 py-0.5 text-xs font-medium ring-1 ring-inset",
        style.pill,
      )}
    >
      <span className={cn("size-1.5 rounded-full", style.dot)} aria-hidden />
      {label}
    </span>
  );
};
